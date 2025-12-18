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
 * Seeder Service
 *
 * Handles seeding of essential data on application startup:
 * - Default SUPERUSER account (system admin)
 * - One default user per role with deterministic phone numbers
 *
 * Phone Number Assignment:
 * - SUPERUSER: +254000000000 (system account)
 * - RIDER: +254722000000
 * - SACCO_ADMIN: +254722000001
 * - KBA_ADMIN: +254722000002
 * - INSURANCE_ADMIN: +254722000003
 * - PLATFORM_ADMIN: +254722000004
 *
 * All seeded users have the default password: ChangeMe123!
 *
 * This service implements OnModuleInit to run automatically on startup.
 * All seeding operations are idempotent - safe to run multiple times.
 */
@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  // Default credentials
  private readonly DEFAULT_PASSWORD = 'ChangeMe123!';
  private readonly SALT_ROUNDS = 10;

  // SUPERUSER specific settings (system account)
  private readonly SUPERUSER_USERNAME = 'SUPERUSER';
  private readonly SUPERUSER_PHONE = '+254000000000';

  // Base phone number for role-based seeding (0722000000)
  private readonly BASE_PHONE_NUMBER = 722000000;
  private readonly COUNTRY_CODE = '+254';

  // Role to phone number offset mapping (deterministic assignment)
  private readonly ROLE_PHONE_OFFSETS: Record<UserRole, number> = {
    [UserRole.RIDER]: 0,
    [UserRole.SACCO_ADMIN]: 1,
    [UserRole.KBA_ADMIN]: 2,
    [UserRole.INSURANCE_ADMIN]: 3,
    [UserRole.PLATFORM_ADMIN]: 4,
  };

  // Track seeded users for display
  private seededUsers: SeededUserInfo[] = [];

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Runs on module initialization (application startup)
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Starting database seeding...');
    this.seededUsers = [];

    try {
      // Seed SUPERUSER (system account)
      await this.seedSuperuser();

      // Seed one user per role with deterministic phone numbers
      await this.seedRoleUsers();

      // Display seed results
      this.displaySeedResults();

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

        this.seededUsers.push({
          role: UserRole.PLATFORM_ADMIN,
          username: this.SUPERUSER_USERNAME,
          phone: this.SUPERUSER_PHONE,
          created: false,
          restored: true,
        });
        return;
      }

      // Already exists, track it for display
      this.seededUsers.push({
        role: UserRole.PLATFORM_ADMIN,
        username: this.SUPERUSER_USERNAME,
        phone: this.SUPERUSER_PHONE,
        created: false,
        restored: false,
      });
      return;
    }

    // Hash the default password
    const passwordHash = await bcrypt.hash(this.DEFAULT_PASSWORD, this.SALT_ROUNDS);

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

    this.seededUsers.push({
      role: UserRole.PLATFORM_ADMIN,
      username: this.SUPERUSER_USERNAME,
      phone: this.SUPERUSER_PHONE,
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
    const offset = this.ROLE_PHONE_OFFSETS[role];
    const phoneNumber = this.BASE_PHONE_NUMBER + offset;
    const phone = `${this.COUNTRY_CODE}${phoneNumber}`;
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
    const passwordHash = await bcrypt.hash(this.DEFAULT_PASSWORD, this.SALT_ROUNDS);

    // Create the user
    const user = this.userRepository.create({
      phone,
      username,
      passwordHash,
      role,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.APPROVED,
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
    this.logger.log(`║  Default Password: ${this.DEFAULT_PASSWORD.padEnd(57)}║`);
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

    superuser.passwordHash = await bcrypt.hash(this.DEFAULT_PASSWORD, this.SALT_ROUNDS);
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
    return this.DEFAULT_PASSWORD;
  }
}
