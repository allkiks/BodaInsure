import { Injectable, Logger } from '@nestjs/common';
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
import {
  DEFAULT_PASSWORD,
  SALT_ROUNDS,
  SUPERUSER_CONFIG,
  ROLE_PHONE_OFFSETS,
  BASE_PHONE_NUMBER,
  COUNTRY_CODE,
} from '../../../database/seeds/index.js';

/**
 * Seeded User Information
 * Used for displaying seed results
 */
export interface SeededUserInfo {
  role: UserRole;
  username: string;
  phone: string;
  created: boolean;
  restored: boolean;
}

/**
 * Seeding result from user seeder
 */
export interface UserSeedingResult {
  success: boolean;
  seededCount: number;
  createdCount: number;
  restoredCount: number;
  existingCount: number;
  users: SeededUserInfo[];
  error?: string;
}

/**
 * Seeder Service
 *
 * Handles seeding of essential user data:
 * - Default SUPERUSER account (system admin)
 * - One default user per role with deterministic phone numbers
 *
 * Seed data is sourced from: src/database/seeds/users.seed.ts
 *
 * Phone Number Assignment:
 * - SUPERUSER: +254000000000 (system account)
 * - RIDER: +254722000000
 * - SACCO_ADMIN: +254722000001
 * - KBA_ADMIN: +254722000002
 * - INSURANCE_ADMIN: +254722000003
 * - PLATFORM_ADMIN: +254722000004
 *
 * All seeded users have the default password from seed data.
 *
 * This service is called by SeedingRunnerService after migrations complete.
 * All seeding operations are idempotent - safe to run multiple times.
 */
@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  // Track seeded users for display
  private seededUsers: SeededUserInfo[] = [];

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Run user seeding
   * Called by SeedingRunnerService
   */
  async seed(): Promise<UserSeedingResult> {
    this.logger.log('Starting user seeding...');
    this.seededUsers = [];

    try {
      // Seed SUPERUSER (system account)
      await this.seedSuperuser();

      // Seed one user per role with deterministic phone numbers
      await this.seedRoleUsers();

      // Display seed results
      this.displaySeedResults();

      const createdCount = this.seededUsers.filter(u => u.created).length;
      const restoredCount = this.seededUsers.filter(u => u.restored).length;
      const existingCount = this.seededUsers.filter(u => !u.created && !u.restored).length;

      this.logger.log('User seeding completed successfully');

      return {
        success: true,
        seededCount: this.seededUsers.length,
        createdCount,
        restoredCount,
        existingCount,
        users: [...this.seededUsers],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('User seeding failed', error);
      return {
        success: false,
        seededCount: 0,
        createdCount: 0,
        restoredCount: 0,
        existingCount: 0,
        users: [],
        error: errorMessage,
      };
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
      where: { username: SUPERUSER_CONFIG.username },
      withDeleted: true, // Include soft-deleted records
    });

    if (existingUser) {
      // If soft-deleted, restore it
      if (existingUser.deletedAt) {
        this.logger.log('Restoring soft-deleted SUPERUSER account');
        existingUser.deletedAt = undefined;
        existingUser.status = UserStatus.ACTIVE;
        await this.userRepository.save(existingUser);

        this.seededUsers.push({
          role: UserRole.PLATFORM_ADMIN,
          username: SUPERUSER_CONFIG.username,
          phone: SUPERUSER_CONFIG.phone,
          created: false,
          restored: true,
        });
        return;
      }

      // Already exists, track it for display
      this.seededUsers.push({
        role: UserRole.PLATFORM_ADMIN,
        username: SUPERUSER_CONFIG.username,
        phone: SUPERUSER_CONFIG.phone,
        created: false,
        restored: false,
      });
      return;
    }

    // Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // Create the SUPERUSER account
    const superuser = this.userRepository.create({
      phone: SUPERUSER_CONFIG.phone,
      username: SUPERUSER_CONFIG.username,
      passwordHash,
      role: SUPERUSER_CONFIG.role,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
      language: Language.ENGLISH,
      isSystemAccount: SUPERUSER_CONFIG.isSystemAccount,
      termsAcceptedAt: new Date(),
      consentGivenAt: new Date(),
      failedLoginAttempts: 0,
      reminderOptOut: SUPERUSER_CONFIG.reminderOptOut,
    });

    await this.userRepository.save(superuser);

    this.seededUsers.push({
      role: UserRole.PLATFORM_ADMIN,
      username: SUPERUSER_CONFIG.username,
      phone: SUPERUSER_CONFIG.phone,
      created: true,
      restored: false,
    });
  }

  /**
   * Seeds one user per role with deterministic phone numbers
   * Phone numbers start from 0722000000 and increment by role
   */
  private async seedRoleUsers(): Promise<void> {
    const roles = Object.values(UserRole);

    for (const role of roles) {
      await this.seedUserForRole(role);
    }
  }

  /**
   * Seeds a single user for a specific role
   * Uses deterministic phone number based on role offset
   */
  private async seedUserForRole(role: UserRole): Promise<void> {
    const offset = ROLE_PHONE_OFFSETS[role];
    const phoneNumber = BASE_PHONE_NUMBER + offset;
    const phone = `${COUNTRY_CODE}${phoneNumber}`;
    const username = `0${phoneNumber}`; // Local format as username (e.g., 0722000000)

    // Check if user already exists by phone
    const existingUser = await this.userRepository.findOne({
      where: { phone },
      withDeleted: true,
    });

    if (existingUser) {
      // If soft-deleted, restore it
      if (existingUser.deletedAt) {
        this.logger.log(`Restoring soft-deleted ${role} user: ${username}`);
        existingUser.deletedAt = undefined;
        existingUser.status = UserStatus.ACTIVE;
        await this.userRepository.save(existingUser);

        this.seededUsers.push({
          role,
          username,
          phone,
          created: false,
          restored: true,
        });
        return;
      }

      // Already exists, track for display
      this.seededUsers.push({
        role,
        username,
        phone,
        created: false,
        restored: false,
      });
      return;
    }

    // Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // Riders must start with PENDING KYC status (no documents uploaded yet)
    // Admin roles (platform_admin, kba_admin, sacco_admin, insurance_admin) don't require KYC
    const kycStatus = role === UserRole.RIDER ? KycStatus.PENDING : KycStatus.APPROVED;

    // Create the user
    const user = this.userRepository.create({
      phone,
      username,
      passwordHash,
      role,
      status: UserStatus.ACTIVE,
      kycStatus,
      language: Language.ENGLISH,
      isSystemAccount: false,
      termsAcceptedAt: new Date(),
      consentGivenAt: new Date(),
      failedLoginAttempts: 0,
      reminderOptOut: false,
    });

    await this.userRepository.save(user);

    this.seededUsers.push({
      role,
      username,
      phone,
      created: true,
      restored: false,
    });
  }

  /**
   * Displays the seed results in a formatted table
   */
  private displaySeedResults(): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    this.logger.log('║                          SEEDED USERS SUMMARY                                 ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    this.logger.log('║  Role              │ Username      │ Phone           │ Status                 ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    for (const user of this.seededUsers) {
      const rolePadded = user.role.padEnd(17);
      const usernamePadded = user.username.padEnd(13);
      const phonePadded = user.phone.padEnd(15);
      const status = user.created ? 'CREATED' : user.restored ? 'RESTORED' : 'EXISTS';
      const statusPadded = status.padEnd(22);
      this.logger.log(`║  ${rolePadded} │ ${usernamePadded} │ ${phonePadded} │ ${statusPadded}║`);
    }

    this.logger.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Default Password: ${DEFAULT_PASSWORD.padEnd(57)}║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════════════════════╝');
    this.logger.log('');

    // Log warning about changing default passwords
    const createdCount = this.seededUsers.filter(u => u.created).length;
    const restoredCount = this.seededUsers.filter(u => u.restored).length;

    if (createdCount > 0 || restoredCount > 0) {
      this.logger.warn('IMPORTANT: Change all default passwords immediately after first login!');
    }
  }

  /**
   * Manual method to ensure SUPERUSER exists
   * Can be called from admin endpoints or CLI commands
   */
  async ensureSuperuserExists(): Promise<{ created: boolean; message: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { username: SUPERUSER_CONFIG.username },
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
      where: { username: SUPERUSER_CONFIG.username },
    });

    if (!superuser) {
      return {
        success: false,
        message: 'SUPERUSER account not found',
      };
    }

    superuser.passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
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

  /**
   * Gets the list of seeded users (for programmatic access)
   */
  getSeededUsers(): SeededUserInfo[] {
    return [...this.seededUsers];
  }

  /**
   * Gets the default password (for testing/documentation purposes)
   */
  getDefaultPassword(): string {
    return DEFAULT_PASSWORD;
  }
}
