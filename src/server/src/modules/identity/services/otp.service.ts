import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import { Otp, OtpPurpose, OtpStatus } from '../entities/otp.entity.js';
import { OTP_CONFIG } from '../../../common/constants/index.js';

export interface GenerateOtpResult {
  success: boolean;
  otp?: string;
  otpId?: string;
  message: string;
  retryAfter?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
  userId?: string;
}

/**
 * OTP Service
 * Handles OTP generation, storage, verification, and rate limiting
 *
 * Per FEAT-AUTH-002 and FR-AUTH-002:
 * - 6-digit OTP
 * - Valid for 5 minutes
 * - Maximum 5 verification attempts per OTP
 * - Maximum 3 OTP requests per phone per hour
 * - OTP stored as hash
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
  ) {}

  /**
   * Generate and store a new OTP
   */
  async generateOtp(
    phone: string,
    purpose: OtpPurpose,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<GenerateOtpResult> {
    // Check rate limiting (max 3 OTPs per hour per phone)
    const rateLimitCheck = await this.checkRateLimit(phone);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: `Too many OTP requests. Please wait ${rateLimitCheck.retryAfter} seconds.`,
        retryAfter: rateLimitCheck.retryAfter,
      };
    }

    // Invalidate any existing pending OTPs for this phone/purpose
    await this.invalidateExistingOtps(phone, purpose);

    // Generate 6-digit OTP
    const otpCode = this.generateOtpCode();

    // Hash the OTP before storing
    const codeHash = this.hashOtp(otpCode);

    // Calculate expiry time
    const expiresAt = new Date(
      Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000,
    );

    // Create OTP record
    const otp = this.otpRepository.create({
      phone,
      codeHash,
      purpose,
      status: OtpStatus.PENDING,
      attempts: 0,
      expiresAt,
      userId,
      ipAddress,
      userAgent,
    });

    await this.otpRepository.save(otp);

    this.logger.log(
      `OTP generated for phone ***${phone.slice(-4)} purpose=${purpose}`,
    );

    return {
      success: true,
      otp: otpCode, // Return plaintext OTP for sending via SMS
      otpId: otp.id,
      message: 'OTP generated successfully',
    };
  }

  /**
   * Verify an OTP code
   */
  async verifyOtp(
    phone: string,
    otpCode: string,
    purpose: OtpPurpose,
  ): Promise<VerifyOtpResult> {
    // Find the latest pending OTP for this phone/purpose
    const otp = await this.otpRepository.findOne({
      where: {
        phone,
        purpose,
        status: OtpStatus.PENDING,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!otp) {
      return {
        success: false,
        message: 'No pending OTP found. Please request a new one.',
      };
    }

    // Check if OTP is expired
    if (otp.expiresAt < new Date()) {
      otp.status = OtpStatus.EXPIRED;
      await this.otpRepository.save(otp);
      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
      };
    }

    // Check if max attempts exceeded
    if (otp.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
      otp.status = OtpStatus.EXHAUSTED;
      await this.otpRepository.save(otp);
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
        attemptsRemaining: 0,
      };
    }

    // Increment attempt count
    otp.attempts += 1;

    // Verify the OTP
    const codeHash = this.hashOtp(otpCode);
    if (codeHash !== otp.codeHash) {
      await this.otpRepository.save(otp);
      const remaining = OTP_CONFIG.MAX_ATTEMPTS - otp.attempts;
      return {
        success: false,
        message: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        attemptsRemaining: remaining,
      };
    }

    // OTP verified successfully
    otp.status = OtpStatus.VERIFIED;
    otp.verifiedAt = new Date();
    await this.otpRepository.save(otp);

    this.logger.log(`OTP verified for phone ***${phone.slice(-4)}`);

    return {
      success: true,
      message: 'OTP verified successfully',
      userId: otp.userId,
    };
  }

  /**
   * Check if resend is allowed (60 second cooldown)
   */
  async canResendOtp(phone: string, purpose: OtpPurpose): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    const lastOtp = await this.otpRepository.findOne({
      where: {
        phone,
        purpose,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!lastOtp) {
      return { allowed: true };
    }

    const cooldownEnd = new Date(
      lastOtp.createdAt.getTime() + OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000,
    );

    if (new Date() < cooldownEnd) {
      const retryAfter = Math.ceil(
        (cooldownEnd.getTime() - Date.now()) / 1000,
      );
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  /**
   * Check rate limit (max 3 OTPs per hour)
   */
  private async checkRateLimit(phone: string): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentOtpCount = await this.otpRepository.count({
      where: {
        phone,
        createdAt: MoreThan(oneHourAgo),
      },
    });

    if (recentOtpCount >= OTP_CONFIG.MAX_REQUESTS_PER_HOUR) {
      // Find oldest OTP in the last hour to calculate retry time
      const oldestRecentOtp = await this.otpRepository.findOne({
        where: {
          phone,
          createdAt: MoreThan(oneHourAgo),
        },
        order: {
          createdAt: 'ASC',
        },
      });

      if (oldestRecentOtp) {
        const retryAfter = Math.ceil(
          (oldestRecentOtp.createdAt.getTime() + 60 * 60 * 1000 - Date.now()) / 1000,
        );
        return { allowed: false, retryAfter };
      }
    }

    return { allowed: true };
  }

  /**
   * Invalidate existing pending OTPs for a phone/purpose
   */
  private async invalidateExistingOtps(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    await this.otpRepository.update(
      {
        phone,
        purpose,
        status: OtpStatus.PENDING,
      },
      {
        status: OtpStatus.EXPIRED,
      },
    );
  }

  /**
   * Generate a cryptographically secure 6-digit OTP
   */
  private generateOtpCode(): string {
    // Generate random bytes and convert to 6-digit number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    const otp = (randomNumber % 900000) + 100000; // Ensures 6 digits
    return otp.toString();
  }

  /**
   * Hash OTP using SHA-256
   */
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Clean up expired OTPs (for scheduled job)
   * Deletes OTPs older than 24 hours per DR-DATA retention policy
   */
  async cleanupExpiredOtps(): Promise<number> {
    const deleteResult = await this.otpRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', {
        cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .execute();

    return deleteResult.affected ?? 0;
  }
}
