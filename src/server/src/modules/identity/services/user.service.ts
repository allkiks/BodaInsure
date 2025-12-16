import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  UserStatus,
  UserRole,
  KycStatus,
  Language,
} from '../entities/user.entity.js';
import { normalizePhoneToE164 } from '../../../common/utils/phone.util.js';

export interface CreateUserData {
  phone: string;
  language?: Language;
  termsAccepted: boolean;
}

/**
 * User Service
 * Handles user CRUD operations and status management
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user (registration)
   */
  async createUser(data: CreateUserData): Promise<User> {
    const normalizedPhone = normalizePhoneToE164(data.phone);

    // Check for existing user
    const existingUser = await this.userRepository.findOne({
      where: { phone: normalizedPhone },
    });

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    const user = this.userRepository.create({
      phone: normalizedPhone,
      status: UserStatus.PENDING,
      role: UserRole.RIDER,
      kycStatus: KycStatus.PENDING,
      language: data.language ?? Language.ENGLISH,
      termsAcceptedAt: data.termsAccepted ? new Date() : undefined,
      consentGivenAt: data.termsAccepted ? new Date() : undefined,
      failedLoginAttempts: 0,
      reminderOptOut: false,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User created: ***${normalizedPhone.slice(-4)}`);

    return savedUser;
  }

  /**
   * Find user by phone number
   */
  async findByPhone(phone: string): Promise<User | null> {
    const normalizedPhone = normalizePhoneToE164(phone);
    return this.userRepository.findOne({
      where: { phone: normalizedPhone },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find user by username (for admin authentication)
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  /**
   * Activate user after OTP verification
   */
  async activateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = UserStatus.ACTIVE;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;

    const updatedUser = await this.userRepository.save(user);
    this.logger.log(`User activated: ***${user.phone.slice(-4)}`);

    return updatedUser;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
    });
  }

  /**
   * Record failed login attempt
   */
  async recordFailedLogin(userId: string): Promise<{
    isLocked: boolean;
    lockedUntil?: Date;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return { isLocked: false };
    }

    user.failedLoginAttempts += 1;

    // Lock account after 5 failed attempts for 30 minutes
    if (user.failedLoginAttempts >= 5) {
      user.status = UserStatus.LOCKED;
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await this.userRepository.save(user);

      this.logger.warn(`User locked due to failed attempts: ***${user.phone.slice(-4)}`);

      return {
        isLocked: true,
        lockedUntil: user.lockedUntil,
      };
    }

    await this.userRepository.save(user);
    return { isLocked: false };
  }

  /**
   * Check if user account is locked
   */
  async isAccountLocked(userId: string): Promise<{
    isLocked: boolean;
    lockedUntil?: Date;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return { isLocked: false };
    }

    if (user.status !== UserStatus.LOCKED) {
      return { isLocked: false };
    }

    // Check if lock has expired
    if (user.lockedUntil && user.lockedUntil < new Date()) {
      // Unlock the account
      user.status = UserStatus.ACTIVE;
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      await this.userRepository.save(user);
      return { isLocked: false };
    }

    return {
      isLocked: true,
      lockedUntil: user.lockedUntil,
    };
  }

  /**
   * Check if user exists by phone
   */
  async existsByPhone(phone: string): Promise<boolean> {
    const normalizedPhone = normalizePhoneToE164(phone);
    const count = await this.userRepository.count({
      where: { phone: normalizedPhone },
    });
    return count > 0;
  }

  /**
   * Update user KYC status
   */
  async updateKycStatus(userId: string, kycStatus: KycStatus): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.kycStatus = kycStatus;
    return this.userRepository.save(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: Partial<Pick<User, 'fullName' | 'email' | 'nationalId' | 'kraPin' | 'dateOfBirth' | 'gender'>>,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, data);
    return this.userRepository.save(user);
  }

  /**
   * Soft delete user (for data subject deletion requests)
   */
  async softDeleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = UserStatus.DEACTIVATED;
    await this.userRepository.save(user);
    await this.userRepository.softDelete(userId);

    this.logger.log(`User soft deleted: ***${user.phone.slice(-4)}`);
  }
}
