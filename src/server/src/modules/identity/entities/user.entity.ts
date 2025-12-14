import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity.js';
import { EncryptedColumnTransformer } from '../../../common/transformers/encrypted-column.transformer.js';

/**
 * User status enum
 * Tracks the lifecycle state of a user account
 */
export enum UserStatus {
  PENDING = 'PENDING', // Registered but OTP not verified
  ACTIVE = 'ACTIVE', // Verified and active
  SUSPENDED = 'SUSPENDED', // Temporarily suspended
  LOCKED = 'LOCKED', // Locked due to security (too many attempts)
  DEACTIVATED = 'DEACTIVATED', // User-requested deactivation
}

/**
 * User roles per CLAUDE.md specification
 */
export enum UserRole {
  RIDER = 'rider',
  SACCO_ADMIN = 'sacco_admin',
  KBA_ADMIN = 'kba_admin',
  INSURANCE_ADMIN = 'insurance_admin',
  PLATFORM_ADMIN = 'platform_admin',
}

/**
 * KYC status enum
 */
export enum KycStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  INCOMPLETE = 'INCOMPLETE',
}

/**
 * Supported languages
 */
export enum Language {
  ENGLISH = 'en',
  SWAHILI = 'sw',
}

/**
 * Gender enum
 */
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

/**
 * User Entity
 * Core user account data per DR-DATA-001 requirements
 *
 * PII Classification (per CLAUDE.md Section 6.2):
 * - national_id: HIGH - requires encryption
 * - kra_pin: HIGH - requires encryption
 * - phone: MEDIUM - encrypted at rest
 * - full_name: MEDIUM - encrypted at rest
 * - email: MEDIUM - encrypted at rest
 * - date_of_birth: MEDIUM - encrypted at rest
 */
@Entity('users')
@Index(['phone'], { unique: true })
@Index(['nationalId'], { unique: true, where: '"national_id" IS NOT NULL' })
@Index(['status'])
@Index(['role'])
@Index(['kycStatus'])
@Index(['createdAt'])
export class User extends BaseEntity {
  /**
   * Phone number in E.164 format (+254...)
   * Primary identifier for authentication
   * Classification: MEDIUM
   *
   * NOTE: Not encrypted at field level because it's the primary authentication
   * identifier and requires indexing for lookup. Database-level encryption
   * (TDE) should be used for at-rest encryption of this field.
   */
  @Column({
    name: 'phone',
    type: 'varchar',
    length: 20,
    unique: true,
  })
  phone!: string;

  /**
   * National ID number
   * Classification: HIGH - stored encrypted
   * Format: 8 digits for Kenyan IDs
   * Per NFR-SEC-003: Field-level encryption required
   */
  @Column({
    name: 'national_id',
    type: 'varchar',
    length: 500, // Increased for encrypted content
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  nationalId?: string;

  /**
   * Full legal name as per ID
   * Classification: MEDIUM - encrypted at rest
   * Per NFR-SEC-003: Field-level encryption for PII
   */
  @Column({
    name: 'full_name',
    type: 'varchar',
    length: 500, // Increased for encrypted content
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  fullName?: string;

  /**
   * Email address (optional)
   * Classification: MEDIUM - encrypted at rest
   * Per NFR-SEC-003: Field-level encryption for PII
   */
  @Column({
    name: 'email',
    type: 'varchar',
    length: 500, // Increased for encrypted content
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  email?: string;

  /**
   * KRA PIN Certificate number
   * Classification: HIGH - stored encrypted
   * Format: A followed by 9 digits (e.g., A123456789Z)
   * Per NFR-SEC-003: Field-level encryption required
   */
  @Column({
    name: 'kra_pin',
    type: 'varchar',
    length: 500, // Increased for encrypted content
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  kraPin?: string;

  /**
   * Date of birth
   * Classification: MEDIUM
   */
  @Column({
    name: 'date_of_birth',
    type: 'date',
    nullable: true,
  })
  dateOfBirth?: Date;

  /**
   * Gender
   * Classification: LOW
   */
  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  /**
   * Account status
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status!: UserStatus;

  /**
   * User role for RBAC
   */
  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.RIDER,
  })
  role!: UserRole;

  /**
   * KYC verification status
   */
  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  kycStatus!: KycStatus;

  /**
   * Preferred language for communications
   */
  @Column({
    name: 'language',
    type: 'enum',
    enum: Language,
    default: Language.ENGLISH,
  })
  language!: Language;

  /**
   * Timestamp when user accepted terms of service
   * Required per CR-DPA-001 consent management
   */
  @Column({
    name: 'terms_accepted_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  termsAcceptedAt?: Date;

  /**
   * Timestamp when user gave consent for data processing
   * Required per Data Protection Act 2019
   */
  @Column({
    name: 'consent_given_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  consentGivenAt?: Date;

  /**
   * Last successful login timestamp
   */
  @Column({
    name: 'last_login_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lastLoginAt?: Date;

  /**
   * Count of failed login attempts (for lockout)
   */
  @Column({
    name: 'failed_login_attempts',
    type: 'int',
    default: 0,
  })
  failedLoginAttempts!: number;

  /**
   * Timestamp when account was locked
   */
  @Column({
    name: 'locked_until',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lockedUntil?: Date;

  /**
   * Organization ID (SACCO or umbrella body)
   * References organization module
   */
  @Column({
    name: 'organization_id',
    type: 'uuid',
    nullable: true,
  })
  organizationId?: string;

  /**
   * Notification preferences - opt out of reminders
   */
  @Column({
    name: 'reminder_opt_out',
    type: 'boolean',
    default: false,
  })
  reminderOptOut!: boolean;
}
