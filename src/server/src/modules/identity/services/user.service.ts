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

  /**
   * Grace period for account deletion (30 days)
   * Per Data Protection Act 2019 and CLAUDE.md Section 6.3
   */
  private readonly DELETION_GRACE_PERIOD_DAYS = 30;

  /**
   * Schedule account deletion with grace period
   * Per Data Protection Act 2019: Right to Deletion
   */
  async scheduleDeletion(
    userId: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    deletionScheduledFor: Date;
    message: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already scheduled
    if (user.deletionScheduledFor) {
      return {
        success: false,
        deletionScheduledFor: user.deletionScheduledFor,
        message: 'Account deletion is already scheduled.',
      };
    }

    // Schedule deletion for 30 days from now
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + this.DELETION_GRACE_PERIOD_DAYS);

    user.deletionScheduledFor = deletionDate;
    user.deletionReason = reason ?? 'User requested deletion';
    user.status = UserStatus.DEACTIVATED;

    await this.userRepository.save(user);

    this.logger.log(
      `Account deletion scheduled: ***${user.phone.slice(-4)} scheduled for ${deletionDate.toISOString()}`,
    );

    return {
      success: true,
      deletionScheduledFor: deletionDate,
      message: `Your account deletion has been scheduled for ${deletionDate.toLocaleDateString()}. You can cancel this request by contacting support within the grace period.`,
    };
  }

  /**
   * Cancel scheduled deletion
   * User can cancel within the grace period by logging in or contacting support
   */
  async cancelDeletion(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.deletionScheduledFor) {
      return {
        success: false,
        message: 'No deletion is scheduled for this account.',
      };
    }

    // Check if grace period has expired
    if (user.deletionScheduledFor < new Date()) {
      return {
        success: false,
        message: 'The grace period has expired. Account cannot be restored.',
      };
    }

    // Cancel the deletion
    user.deletionScheduledFor = undefined;
    user.deletionReason = undefined;
    user.status = UserStatus.ACTIVE;

    await this.userRepository.save(user);

    this.logger.log(`Account deletion cancelled: ***${user.phone.slice(-4)}`);

    return {
      success: true,
      message: 'Your account deletion request has been cancelled. Your account is now active.',
    };
  }

  /**
   * Get deletion status for a user
   */
  async getDeletionStatus(userId: string): Promise<{
    isScheduled: boolean;
    deletionScheduledFor?: Date;
    daysRemaining?: number;
    reason?: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.deletionScheduledFor) {
      return { isScheduled: false };
    }

    const now = new Date();
    const daysRemaining = Math.ceil(
      (user.deletionScheduledFor.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      isScheduled: true,
      deletionScheduledFor: user.deletionScheduledFor,
      daysRemaining: Math.max(0, daysRemaining),
      reason: user.deletionReason,
    };
  }

  /**
   * Process scheduled deletions (called by scheduler)
   * Permanently deletes accounts whose grace period has expired
   */
  async processScheduledDeletions(): Promise<number> {
    const now = new Date();

    // Find users with expired grace period
    const usersToDelete = await this.userRepository.find({
      where: {
        deletionScheduledFor: now,
        status: UserStatus.DEACTIVATED,
      },
    });

    // Filter to only those past their deletion date
    const expiredUsers = usersToDelete.filter(
      user => user.deletionScheduledFor && user.deletionScheduledFor <= now,
    );

    let deletedCount = 0;

    for (const user of expiredUsers) {
      try {
        await this.userRepository.softDelete(user.id);
        deletedCount++;
        this.logger.log(`Account permanently deleted: ***${user.phone.slice(-4)}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete account: ***${user.phone.slice(-4)}`,
          error,
        );
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Processed ${deletedCount} scheduled account deletions`);
    }

    return deletedCount;
  }
}
