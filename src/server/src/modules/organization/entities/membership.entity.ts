import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity.js';

/**
 * Membership status
 */
export enum MembershipStatus {
  PENDING = 'PENDING', // Awaiting approval
  ACTIVE = 'ACTIVE', // Active member
  SUSPENDED = 'SUSPENDED', // Temporarily suspended
  EXPIRED = 'EXPIRED', // Membership expired
  REVOKED = 'REVOKED', // Membership revoked
}

/**
 * Member role within organization
 */
export enum MemberRole {
  MEMBER = 'MEMBER', // Regular member
  OFFICIAL = 'OFFICIAL', // Organization official
  ADMIN = 'ADMIN', // Organization administrator
  CHAIRPERSON = 'CHAIRPERSON', // Organization leader
  SECRETARY = 'SECRETARY',
  TREASURER = 'TREASURER',
}

/**
 * Membership Entity
 * Links users to organizations
 *
 * A user can belong to multiple organizations (e.g., KBA + local SACCO)
 */
@Entity('memberships')
@Index(['userId', 'organizationId'], { unique: true })
@Index(['organizationId', 'status'])
@Index(['memberNumber'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User ID (references identity.users) */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  /** Organization */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  /** Membership status */
  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.PENDING,
  })
  status!: MembershipStatus;

  /** Role within organization */
  @Column({
    type: 'enum',
    enum: MemberRole,
    default: MemberRole.MEMBER,
  })
  role!: MemberRole;

  /** Organization-specific member number */
  @Column({ name: 'member_number', type: 'varchar', length: 50, nullable: true })
  memberNumber?: string;

  /** Date joined */
  @Column({ name: 'joined_at', type: 'timestamp with time zone', nullable: true })
  joinedAt?: Date;

  /** Membership expiry date (if applicable) */
  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt?: Date;

  /** Approved by (user ID) */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  /** Approval date */
  @Column({ name: 'approved_at', type: 'timestamp with time zone', nullable: true })
  approvedAt?: Date;

  /** Suspension reason */
  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason?: string;

  /** Suspended by (user ID) */
  @Column({ name: 'suspended_by', type: 'uuid', nullable: true })
  suspendedBy?: string;

  /** Suspension date */
  @Column({ name: 'suspended_at', type: 'timestamp with time zone', nullable: true })
  suspendedAt?: Date;

  /** Primary organization flag (user's main organization) */
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  /** Membership fee paid (in cents) */
  @Column({ name: 'fee_paid', type: 'integer', default: 0 })
  feePaid!: number;

  /** Fee payment reference */
  @Column({ name: 'fee_reference', type: 'varchar', length: 100, nullable: true })
  feeReference?: string;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Check if membership is active
   */
  isActive(): boolean {
    if (this.status !== MembershipStatus.ACTIVE) {
      return false;
    }

    // Check expiry if set
    if (this.expiresAt && this.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Check if user has admin role
   */
  isAdmin(): boolean {
    return [MemberRole.ADMIN, MemberRole.CHAIRPERSON].includes(this.role);
  }

  /**
   * Check if user is an official
   */
  isOfficial(): boolean {
    return this.role !== MemberRole.MEMBER;
  }

  /**
   * Check if membership is expired
   */
  isExpired(): boolean {
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }

  /**
   * Get days until expiry (or negative if expired)
   */
  getDaysUntilExpiry(): number | null {
    if (!this.expiresAt) return null;

    const now = new Date();
    const diff = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
