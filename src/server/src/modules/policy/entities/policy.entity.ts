import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Policy type - the two-policy model
 * Per product requirements:
 * - ONE_MONTH: Issued after deposit (1,048 KES)
 * - ELEVEN_MONTH: Issued after 30th daily payment
 */
export enum PolicyType {
  ONE_MONTH = 'ONE_MONTH',
  ELEVEN_MONTH = 'ELEVEN_MONTH',
}

/**
 * Policy status lifecycle
 * Per module_architecture.md
 */
export enum PolicyStatus {
  /** Triggered by payment, awaiting batch processing */
  PENDING_ISSUANCE = 'PENDING_ISSUANCE',
  /** Processing in current batch */
  PROCESSING = 'PROCESSING',
  /** Issued and currently providing coverage */
  ACTIVE = 'ACTIVE',
  /** Less than 30 days until expiry */
  EXPIRING = 'EXPIRING',
  /** Coverage period ended */
  EXPIRED = 'EXPIRED',
  /** Policy lapsed due to payment default (for 1-month if daily not started) */
  LAPSED = 'LAPSED',
  /** Cancelled by user or admin */
  CANCELLED = 'CANCELLED',
}

/**
 * Policy Entity
 * Represents an insurance policy for a bodaboda rider
 *
 * Per FEAT-POL-001, FEAT-POL-002, FEAT-POL-003
 */
@Entity('policies')
@Index(['userId', 'status'])
@Index(['policyNumber'], { unique: true, where: '"policy_number" IS NOT NULL' })
@Index(['status', 'expiresAt'])
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User who owns this policy */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  /** Policy type (1-month or 11-month) */
  @Column({
    name: 'policy_type',
    type: 'enum',
    enum: PolicyType,
  })
  policyType!: PolicyType;

  /** Current policy status */
  @Column({
    type: 'enum',
    enum: PolicyStatus,
    default: PolicyStatus.PENDING_ISSUANCE,
  })
  status!: PolicyStatus;

  /** Official policy number from underwriter (assigned during batch processing) */
  @Column({ name: 'policy_number', type: 'varchar', length: 50, nullable: true })
  policyNumber?: string;

  /** Certificate number (if different from policy number) */
  @Column({ name: 'certificate_number', type: 'varchar', length: 50, nullable: true })
  certificateNumber?: string;

  /** Batch ID this policy was processed in */
  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId?: string;

  /** Transaction ID that triggered this policy */
  @Column({ name: 'triggering_transaction_id', type: 'uuid', nullable: true })
  triggeringTransactionId?: string;

  /** Premium amount in cents */
  @Column({ name: 'premium_amount', type: 'bigint', default: 0 })
  premiumAmount!: number;

  /** Currency */
  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency!: string;

  /** Coverage start date */
  @Column({ name: 'coverage_start', type: 'timestamp with time zone', nullable: true })
  coverageStart?: Date;

  /** Coverage end date */
  @Column({ name: 'coverage_end', type: 'timestamp with time zone', nullable: true })
  coverageEnd?: Date;

  /** Expiry date (same as coverage_end, used for indexing) */
  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  @Index()
  expiresAt?: Date;

  /** When policy was issued */
  @Column({ name: 'issued_at', type: 'timestamp with time zone', nullable: true })
  issuedAt?: Date;

  /** When policy was activated (moved to ACTIVE status) */
  @Column({ name: 'activated_at', type: 'timestamp with time zone', nullable: true })
  activatedAt?: Date;

  /** When policy was cancelled (if applicable) */
  @Column({ name: 'cancelled_at', type: 'timestamp with time zone', nullable: true })
  cancelledAt?: Date;

  /** Cancellation reason */
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason?: string;

  /** Previous policy ID (for renewals) */
  @Column({ name: 'previous_policy_id', type: 'uuid', nullable: true })
  previousPolicyId?: string;

  /** Next policy ID (for renewals) */
  @Column({ name: 'next_policy_id', type: 'uuid', nullable: true })
  nextPolicyId?: string;

  /** Vehicle registration number (from KYC) */
  @Column({ name: 'vehicle_registration', type: 'varchar', length: 20, nullable: true })
  vehicleRegistration?: string;

  /** Insured person's full name */
  @Column({ name: 'insured_name', type: 'varchar', length: 100, nullable: true })
  insuredName?: string;

  /** National ID of insured */
  @Column({ name: 'national_id', type: 'varchar', length: 20, nullable: true })
  nationalId?: string;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Check if policy is currently active
   */
  isActive(): boolean {
    return this.status === PolicyStatus.ACTIVE || this.status === PolicyStatus.EXPIRING;
  }

  /**
   * Check if policy is pending issuance
   */
  isPending(): boolean {
    return this.status === PolicyStatus.PENDING_ISSUANCE || this.status === PolicyStatus.PROCESSING;
  }

  /**
   * Check if policy has expired
   */
  isExpired(): boolean {
    return this.status === PolicyStatus.EXPIRED;
  }

  /**
   * Get days until expiry
   */
  getDaysUntilExpiry(): number | null {
    if (!this.expiresAt) return null;
    const now = new Date();
    const diff = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get premium amount in KES
   */
  getPremiumInKes(): number {
    return Number(this.premiumAmount) / 100;
  }

  /**
   * Get policy duration in months
   */
  getDurationMonths(): number {
    return this.policyType === PolicyType.ONE_MONTH ? 1 : 11;
  }
}
