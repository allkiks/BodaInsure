import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity.js';
import { User } from './user.entity.js';

/**
 * OTP purpose enum
 */
export enum OtpPurpose {
  REGISTRATION = 'REGISTRATION',
  LOGIN = 'LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PHONE_CHANGE = 'PHONE_CHANGE',
}

/**
 * OTP status enum
 */
export enum OtpStatus {
  PENDING = 'PENDING', // Awaiting verification
  VERIFIED = 'VERIFIED', // Successfully verified
  EXPIRED = 'EXPIRED', // Time expired
  EXHAUSTED = 'EXHAUSTED', // Max attempts reached
}

/**
 * OTP Entity
 * Stores one-time passwords for phone verification
 *
 * Per FEAT-AUTH-002 and FR-AUTH-002:
 * - 6-digit OTP
 * - Valid for 5 minutes (OTP_CONFIG.EXPIRY_MINUTES)
 * - Maximum 5 verification attempts per OTP
 * - Maximum 3 OTP requests per phone per hour
 *
 * Security: OTP stored as hash, compared server-side
 * Retention: 24 hours per DR-DATA retention policy
 */
@Entity('otps')
@Index(['phone', 'purpose', 'status'])
@Index(['expiresAt'])
@Index(['createdAt'])
export class Otp extends BaseEntity {
  /**
   * Phone number this OTP was sent to (E.164 format)
   */
  @Column({
    name: 'phone',
    type: 'varchar',
    length: 20,
  })
  phone!: string;

  /**
   * Hashed OTP code (never store plaintext)
   * Original OTP is 6 digits
   */
  @Column({
    name: 'code_hash',
    type: 'varchar',
    length: 255,
  })
  codeHash!: string;

  /**
   * Purpose of this OTP
   */
  @Column({
    name: 'purpose',
    type: 'enum',
    enum: OtpPurpose,
  })
  purpose!: OtpPurpose;

  /**
   * Current status
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: OtpStatus,
    default: OtpStatus.PENDING,
  })
  status!: OtpStatus;

  /**
   * Number of verification attempts made
   * Max 5 per OTP_CONFIG.MAX_ATTEMPTS
   */
  @Column({
    name: 'attempts',
    type: 'int',
    default: 0,
  })
  attempts!: number;

  /**
   * When this OTP expires
   * Default: 5 minutes from creation
   */
  @Column({
    name: 'expires_at',
    type: 'timestamp with time zone',
  })
  expiresAt!: Date;

  /**
   * When this OTP was verified (if successful)
   */
  @Column({
    name: 'verified_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  verifiedAt?: Date;

  /**
   * User ID if this OTP is for an existing user (login)
   * Null for registration OTPs
   */
  @Column({
    name: 'user_id',
    type: 'uuid',
    nullable: true,
  })
  userId?: string;

  /**
   * IP address of request (for audit)
   */
  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ipAddress?: string;

  /**
   * User agent of request (for audit)
   */
  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent?: string;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /**
   * Check if OTP is still valid (not expired, not exhausted)
   */
  isValid(): boolean {
    return (
      this.status === OtpStatus.PENDING &&
      this.expiresAt > new Date() &&
      this.attempts < 5
    );
  }

  /**
   * Get remaining attempts
   */
  getRemainingAttempts(): number {
    return Math.max(0, 5 - this.attempts);
  }
}
