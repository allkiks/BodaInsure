import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserStatus,
  UserRole,
  KycStatus,
  Language,
} from '../entities/user.entity.js';

/**
 * Seeder Service
 *
 * Handles seeding of essential data on application startup:
 * - Default SUPERUSER account
 * - System roles validation
 *
 * This service implements OnModuleInit to run automatically on startup.
 * All seeding operations are idempotent - safe to run multiple times.
 */
@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  // Default SUPERUSER credentials
  private readonly SUPERUSER_USERNAME = 'SUPERUSER';
  private readonly SUPERUSER_PASSWORD = 'ChangeMe123!';
  private readonly SUPERUSER_PHONE = '+254000000000'; // System phone number

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Runs on module initialization (application startup)
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Starting database seeding...');

    try {
      await this.seedSuperuser();
      await this.logAvailableRoles();
      this.logger.log('Database seeding completed successfully');
    } catch (error) {
      this.logger.error('Database seeding failed', error);
      // Don't throw - allow application to start even if seeding fails
      // The SUPERUSER can be created manually if needed
    }
  }

  /**
   * Seeds the SUPERUSER account
   * Idempotent - will not create duplicate if already exists
   * Will re-create if the account was deleted
   */
  private async seedSuperuser(): Promise<void> {
    // Check if SUPERUSER already exists
    const existingUser = await this.userRepository.findOne({
      where: { username: this.SUPERUSER_USERNAME },
      withDeleted: true, // Include soft-deleted records
    });

    if (existingUser) {
      // If soft-deleted, restore it
      if (existingUser.deletedAt) {
        this.logger.log('Restoring soft-deleted SUPERUSER account');
        existingUser.deletedAt = undefined;
        existingUser.status = UserStatus.ACTIVE;
        await this.userRepository.save(existingUser);
        this.logger.log('SUPERUSER account restored');
        return;
      }

      this.logger.log('SUPERUSER account already exists, skipping seed');
      return;
    }

    // Hash the default password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(this.SUPERUSER_PASSWORD, saltRounds);

    // Create the SUPERUSER account
    const superuser = this.userRepository.create({
      phone: this.SUPERUSER_PHONE,
      username: this.SUPERUSER_USERNAME,
      passwordHash,
      role: UserRole.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      language: Language.ENGLISH,
      isSystemAccount: true,
      termsAcceptedAt: new Date(),
      consentGivenAt: new Date(),
      failedLoginAttempts: 0,
      reminderOptOut: true, // System account doesn't need reminders
    });

    await this.userRepository.save(superuser);
    this.logger.log('SUPERUSER account created successfully');
    this.logger.warn(
      'IMPORTANT: Change the default SUPERUSER password immediately after first login!',
    );
  }

  /**
   * Logs available system roles
   * Roles are defined as enums, not stored in database
   */
  private async logAvailableRoles(): Promise<void> {
    const roles = Object.values(UserRole);
    this.logger.log(`Available system roles: ${roles.join(', ')}`);
  }

  /**
   * Manual method to ensure SUPERUSER exists
   * Can be called from admin endpoints or CLI commands
   */
  async ensureSuperuserExists(): Promise<{ created: boolean; message: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { username: this.SUPERUSER_USERNAME },
    });

    if (existingUser) {
      return {
        created: false,
        message: 'SUPERUSER account already exists',
      };
    }

    await this.seedSuperuser();
    return {
      created: true,
      message: 'SUPERUSER account created successfully',
    };
  }

  /**
   * Resets the SUPERUSER password to the default
   * Use with caution - only for emergency recovery
   */
  async resetSuperuserPassword(): Promise<{ success: boolean; message: string }> {
    const superuser = await this.userRepository.findOne({
      where: { username: this.SUPERUSER_USERNAME },
    });

    if (!superuser) {
      return {
        success: false,
        message: 'SUPERUSER account not found',
      };
    }

    const saltRounds = 10;
    superuser.passwordHash = await bcrypt.hash(this.SUPERUSER_PASSWORD, saltRounds);
    superuser.failedLoginAttempts = 0;
    superuser.lockedUntil = undefined;
    superuser.status = UserStatus.ACTIVE;

    await this.userRepository.save(superuser);

    this.logger.warn('SUPERUSER password has been reset to default');
    return {
      success: true,
      message: 'SUPERUSER password reset to default. Change it immediately!',
    };
  }
}
