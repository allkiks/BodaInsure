import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';
import { OtpPurpose } from '../entities/otp.entity.js';
import { DeviceType } from '../entities/session.entity.js';
import { UserStatus, UserRole, Language } from '../entities/user.entity.js';
import { normalizePhoneToE164 } from '../../../common/utils/phone.util.js';
import { SmsService } from '../../notification/services/sms.service.js';
import {
  RegisterDto,
  RegisterResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  AdminLoginDto,
  AdminLoginResponseDto,
} from '../dto/index.js';

export interface JwtPayload {
  sub: string; // User ID
  phone: string;
  role: string;
  organizationId?: string;
}

/**
 * Auth Service
 * Orchestrates registration, login, OTP verification, and token management
 *
 * Per GAP-003: Integrated with SMS service for OTP delivery
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SmsService))
    private readonly smsService: SmsService,
  ) {}

  /**
   * Register a new user
   * Per FEAT-AUTH-001
   */
  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RegisterResponseDto> {
    // Validate terms acceptance
    if (!dto.termsAccepted) {
      throw new BadRequestException('You must accept the terms of service');
    }

    const normalizedPhone = normalizePhoneToE164(dto.phone);

    // Check if phone already registered
    const existingUser = await this.userService.findByPhone(normalizedPhone);
    if (existingUser) {
      if (existingUser.status === UserStatus.PENDING) {
        // User exists but not verified - resend OTP
        const otpResult = await this.otpService.generateOtp(
          normalizedPhone,
          OtpPurpose.REGISTRATION,
          existingUser.id,
          ipAddress,
          userAgent,
        );

        if (!otpResult.success) {
          return {
            status: 'RATE_LIMITED',
            otpSent: false,
            message: otpResult.message,
          };
        }

        // Send SMS with OTP per GAP-003
        await this.sendOtpSms(normalizedPhone, otpResult.otp!, 'registration');

        return {
          status: 'SUCCESS',
          userId: existingUser.id,
          otpSent: true,
          message: 'Verification code sent to your phone',
        };
      }

      return {
        status: 'DUPLICATE',
        otpSent: false,
        message: 'Phone number already registered. Please log in instead.',
      };
    }

    // Create new user
    const user = await this.userService.createUser({
      phone: normalizedPhone,
      language: dto.language ?? Language.ENGLISH,
      termsAccepted: dto.termsAccepted,
    });

    // Generate and send OTP
    const otpResult = await this.otpService.generateOtp(
      normalizedPhone,
      OtpPurpose.REGISTRATION,
      user.id,
      ipAddress,
      userAgent,
    );

    if (!otpResult.success) {
      return {
        status: 'ERROR',
        userId: user.id,
        otpSent: false,
        message: otpResult.message,
      };
    }

    // Send SMS with OTP per GAP-003
    await this.sendOtpSms(normalizedPhone, otpResult.otp!, 'registration');

    return {
      status: 'SUCCESS',
      userId: user.id,
      otpSent: true,
      message: 'Verification code sent to your phone',
    };
  }

  /**
   * Verify OTP and complete registration/login
   * Per FEAT-AUTH-002
   */
  async verifyOtp(
    dto: VerifyOtpDto,
    deviceType: DeviceType = DeviceType.MOBILE_APP,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<VerifyOtpResponseDto> {
    const normalizedPhone = normalizePhoneToE164(dto.phone);

    // First try registration OTP, then login OTP
    let verifyResult = await this.otpService.verifyOtp(
      normalizedPhone,
      dto.otp,
      OtpPurpose.REGISTRATION,
    );

    let purpose = OtpPurpose.REGISTRATION;

    if (!verifyResult.success) {
      // Try login OTP
      verifyResult = await this.otpService.verifyOtp(
        normalizedPhone,
        dto.otp,
        OtpPurpose.LOGIN,
      );
      purpose = OtpPurpose.LOGIN;
    }

    if (!verifyResult.success) {
      return {
        status: verifyResult.message.includes('expired')
          ? 'EXPIRED_OTP'
          : verifyResult.message.includes('Maximum')
            ? 'MAX_ATTEMPTS'
            : 'INVALID_OTP',
        attemptsRemaining: verifyResult.attemptsRemaining,
        message: verifyResult.message,
      };
    }

    // Get or activate user
    const user = await this.userService.findByPhone(normalizedPhone);
    if (!user) {
      return {
        status: 'ERROR',
        message: 'User not found',
      };
    }

    // Activate user if this was registration
    if (purpose === OtpPurpose.REGISTRATION && user.status === UserStatus.PENDING) {
      await this.userService.activateUser(user.id);
      user.status = UserStatus.ACTIVE;
    }

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Create session
    const sessionTokens = await this.sessionService.createSession({
      userId: user.id,
      deviceType,
      ipAddress,
      userAgent,
    });

    // Generate JWT
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getExpiresInSeconds();

    return {
      status: 'SUCCESS',
      accessToken,
      refreshToken: sessionTokens.refreshToken,
      expiresIn,
      user: {
        id: user.id,
        phone: user.phone,
        status: user.status,
        kycStatus: user.kycStatus,
      },
      message: 'Verification successful',
    };
  }

  /**
   * Login existing user
   * Per FEAT-AUTH-003
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    const normalizedPhone = normalizePhoneToE164(dto.phone);

    // Find user
    const user = await this.userService.findByPhone(normalizedPhone);
    if (!user) {
      return {
        status: 'USER_NOT_FOUND',
        message: 'Account not found. Please register first.',
      };
    }

    // Check account status
    if (user.status === UserStatus.SUSPENDED) {
      return {
        status: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      };
    }

    if (user.status === UserStatus.DEACTIVATED) {
      return {
        status: 'USER_NOT_FOUND',
        message: 'Account not found. Please register first.',
      };
    }

    // Check if account is locked
    const lockStatus = await this.userService.isAccountLocked(user.id);
    if (lockStatus.isLocked) {
      return {
        status: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to too many failed attempts.',
        lockedUntil: lockStatus.lockedUntil,
      };
    }

    // Generate and send OTP
    const otpResult = await this.otpService.generateOtp(
      normalizedPhone,
      OtpPurpose.LOGIN,
      user.id,
      ipAddress,
      userAgent,
    );

    if (!otpResult.success) {
      return {
        status: 'RATE_LIMITED',
        message: otpResult.message,
      };
    }

    // Send SMS with OTP per GAP-003
    await this.sendOtpSms(normalizedPhone, otpResult.otp!, 'login');

    return {
      status: 'OTP_SENT',
      message: 'Verification code sent to your phone',
    };
  }

  /**
   * Admin login with username/password
   * This flow is specifically for admin accounts (PLATFORM_ADMIN, INSURANCE_ADMIN, KBA_ADMIN, SACCO_ADMIN)
   * Coexists with the phone/OTP flow for regular users
   */
  async adminLogin(
    dto: AdminLoginDto,
    deviceType: DeviceType = DeviceType.WEB,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminLoginResponseDto> {
    // Find user by username
    const user = await this.userService.findByUsername(dto.username);
    if (!user) {
      this.logger.warn(`Admin login failed: username not found - ${dto.username}`);
      return {
        status: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    // Verify this is an admin account (has password hash)
    if (!user.passwordHash) {
      this.logger.warn(`Admin login failed: user has no password - ${dto.username}`);
      return {
        status: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    // Verify the user has an admin role
    const adminRoles = [
      UserRole.PLATFORM_ADMIN,
      UserRole.INSURANCE_ADMIN,
      UserRole.KBA_ADMIN,
      UserRole.SACCO_ADMIN,
    ];
    if (!adminRoles.includes(user.role as UserRole)) {
      this.logger.warn(`Admin login failed: user is not admin - ${dto.username}`);
      return {
        status: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    // Check account status
    if (user.status === UserStatus.SUSPENDED) {
      return {
        status: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      };
    }

    if (user.status === UserStatus.DEACTIVATED) {
      return {
        status: 'ACCOUNT_INACTIVE',
        message: 'Account is no longer active.',
      };
    }

    // Check if account is locked
    const lockStatus = await this.userService.isAccountLocked(user.id);
    if (lockStatus.isLocked) {
      return {
        status: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to too many failed attempts.',
        lockedUntil: lockStatus.lockedUntil,
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      // Record failed login attempt
      const lockResult = await this.userService.recordFailedLogin(user.id);
      this.logger.warn(`Admin login failed: invalid password - ${dto.username}`);

      if (lockResult.isLocked) {
        return {
          status: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed attempts.',
          lockedUntil: lockResult.lockedUntil,
        };
      }

      return {
        status: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    // Ensure user is active (might be PENDING for some reason)
    if (user.status !== UserStatus.ACTIVE) {
      return {
        status: 'ACCOUNT_INACTIVE',
        message: 'Account is not active. Please contact support.',
      };
    }

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Create session
    const sessionTokens = await this.sessionService.createSession({
      userId: user.id,
      deviceType,
      ipAddress,
      userAgent,
    });

    // Generate JWT
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getExpiresInSeconds();

    this.logger.log(`Admin login successful: ${dto.username}`);

    return {
      status: 'SUCCESS',
      message: 'Login successful',
      accessToken,
      refreshToken: sessionTokens.refreshToken,
      expiresIn,
      user: {
        id: user.id,
        username: user.username!,
        role: user.role,
        status: user.status,
      },
    };
  }

  /**
   * Refresh access token
   * Per FEAT-AUTH-004
   */
  async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    const session = await this.sessionService.validateRefreshToken(
      dto.refreshToken,
    );

    if (!session || !session.user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check user status
    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active');
    }

    // Generate new JWT
    const payload: JwtPayload = {
      sub: session.user.id,
      phone: session.user.phone,
      role: session.user.role,
      organizationId: session.user.organizationId,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getExpiresInSeconds();

    return {
      accessToken,
      expiresIn,
    };
  }

  /**
   * Logout user (revoke session)
   */
  async logout(refreshToken: string): Promise<void> {
    const session =
      await this.sessionService.validateRefreshToken(refreshToken);

    if (session) {
      await this.sessionService.revokeSession(session.id, 'User logout');
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<number> {
    return this.sessionService.revokeAllUserSessions(
      userId,
      'User logout from all devices',
    );
  }

  /**
   * Validate JWT payload and return user
   */
  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.userService.findById(payload.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  /**
   * Get JWT expiry in seconds
   */
  private getExpiresInSeconds(): number {
    const expiresIn = this.configService.get<string>('app.jwt.expiresIn', '30d');

    // Parse duration string (e.g., '30d', '1h', '60m')
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match || !match[1] || !match[2]) {
      return 30 * 24 * 60 * 60; // Default 30 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60;
      case 'h':
        return value * 60 * 60;
      case 'm':
        return value * 60;
      case 's':
        return value;
      default:
        return 30 * 24 * 60 * 60;
    }
  }

  /**
   * Send OTP via SMS
   * Per GAP-003: Complete SMS service integration
   */
  private async sendOtpSms(
    phone: string,
    otp: string,
    purpose: 'registration' | 'login',
  ): Promise<void> {
    const message = purpose === 'registration'
      ? `Welcome to BodaInsure! Your verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`
      : `Your BodaInsure login code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

    try {
      const result = await this.smsService.send({
        to: phone,
        message,
      });

      if (result.success) {
        this.logger.log(
          `OTP SMS sent: phone=${phone.slice(-4)} purpose=${purpose} messageId=${result.messageId}`,
        );
      } else {
        this.logger.error(
          `OTP SMS failed: phone=${phone.slice(-4)} purpose=${purpose} error=${result.error}`,
        );
        // Don't throw - OTP is still generated, user can retry
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`OTP SMS error: phone=${phone.slice(-4)} ${errorMessage}`);
      // Don't throw - allow registration/login to continue
      // In production, consider implementing retry logic
    }
  }
}
