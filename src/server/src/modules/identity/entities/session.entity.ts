import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity.js';
import { User } from './user.entity.js';

/**
 * Session/Device type enum
 */
export enum DeviceType {
  MOBILE_APP = 'MOBILE_APP',
  WEB = 'WEB',
  USSD = 'USSD',
}

/**
 * Session status enum
 */
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

/**
 * Session Entity
 * Manages user sessions and refresh tokens
 *
 * Per FEAT-AUTH-004 and FR-AUTH-003:
 * - Mobile app sessions: 30 days (SESSION_CONFIG.MOBILE_EXPIRY_DAYS)
 * - Web portal sessions: 30 minutes idle (SESSION_CONFIG.WEB_EXPIRY_MINUTES)
 * - USSD sessions: 180 seconds (SESSION_CONFIG.USSD_TIMEOUT_SECONDS)
 *
 * Retention: 90 days per DR-DATA retention policy for session logs
 */
@Entity('sessions')
@Index(['userId', 'status'])
@Index(['refreshTokenHash'], { unique: true })
@Index(['expiresAt'])
@Index(['createdAt'])
export class Session extends BaseEntity {
  /**
   * User this session belongs to
   */
  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  /**
   * Hashed refresh token (never store plaintext)
   */
  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  refreshTokenHash!: string;

  /**
   * Device type that created this session
   */
  @Column({
    name: 'device_type',
    type: 'enum',
    enum: DeviceType,
  })
  deviceType!: DeviceType;

  /**
   * Session status
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status!: SessionStatus;

  /**
   * When this session expires
   */
  @Column({
    name: 'expires_at',
    type: 'timestamp with time zone',
  })
  expiresAt!: Date;

  /**
   * Last activity timestamp (for idle timeout)
   */
  @Column({
    name: 'last_activity_at',
    type: 'timestamp with time zone',
    default: () => 'NOW()',
  })
  lastActivityAt!: Date;

  /**
   * IP address of session creation
   */
  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ipAddress?: string;

  /**
   * User agent string
   */
  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent?: string;

  /**
   * Device identifier (for mobile apps)
   */
  @Column({
    name: 'device_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deviceId?: string;

  /**
   * Device name/model (for display in account settings)
   */
  @Column({
    name: 'device_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deviceName?: string;

  /**
   * Reason for revocation (if revoked)
   */
  @Column({
    name: 'revoked_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  revokedReason?: string;

  /**
   * When this session was revoked
   */
  @Column({
    name: 'revoked_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  revokedAt?: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /**
   * Check if session is still valid
   */
  isValid(): boolean {
    return this.status === SessionStatus.ACTIVE && this.expiresAt > new Date();
  }

  /**
   * Check if session is expired due to idle timeout (web only)
   */
  isIdleExpired(idleTimeoutMinutes: number): boolean {
    if (this.deviceType !== DeviceType.WEB) {
      return false;
    }

    const idleThreshold = new Date(
      this.lastActivityAt.getTime() + idleTimeoutMinutes * 60 * 1000,
    );
    return new Date() > idleThreshold;
  }
}
