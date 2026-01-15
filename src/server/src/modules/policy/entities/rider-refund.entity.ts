import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Policy } from './policy.entity.js';

/**
 * Refund status enum
 */
export enum RefundStatus {
  PENDING = 'PENDING',           // Refund created, awaiting approval
  APPROVED = 'APPROVED',         // Approved, ready for payout
  PROCESSING = 'PROCESSING',     // Payout in progress (M-Pesa B2C initiated)
  COMPLETED = 'COMPLETED',       // Refund paid to rider
  FAILED = 'FAILED',             // Payout failed
  CANCELLED = 'CANCELLED',       // Refund cancelled
}

/**
 * Refund payout method
 */
export enum RefundPayoutMethod {
  MPESA = 'MPESA',               // M-Pesa B2C
  WALLET = 'WALLET',             // Credit to rider wallet
  BANK = 'BANK',                 // Bank transfer
}

/**
 * Rider Refund Entity
 *
 * Tracks refund requests from policy cancellations.
 * Links to GL account 2101 (Refund Payable to Riders).
 *
 * Workflow:
 * PENDING -> APPROVED -> PROCESSING -> COMPLETED
 *                                   -> FAILED
 */
@Entity('rider_refunds')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class RiderRefund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique refund reference number
   * Format: REF-YYYYMMDD-XXXX
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  refundNumber!: string;

  /**
   * User/Rider receiving the refund
   */
  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  /**
   * Policy being cancelled/refunded
   */
  @Column({ type: 'uuid' })
  policyId!: string;

  @ManyToOne(() => Policy, { nullable: true })
  @JoinColumn({ name: 'policyId' })
  policy?: Policy;

  /**
   * Total refund amount (in cents) - 90% of premium
   */
  @Column({ type: 'bigint' })
  refundAmountCents!: bigint;

  /**
   * Reversal fee (in cents) - 10% of premium
   */
  @Column({ type: 'bigint' })
  reversalFeeCents!: bigint;

  /**
   * Original premium amount (in cents)
   */
  @Column({ type: 'bigint' })
  originalAmountCents!: bigint;

  /**
   * Number of days paid (for calculation purposes)
   */
  @Column({ type: 'int', default: 0 })
  daysPaid!: number;

  /**
   * Current status
   */
  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.PENDING,
  })
  status!: RefundStatus;

  /**
   * Payout method
   */
  @Column({
    type: 'enum',
    enum: RefundPayoutMethod,
    default: RefundPayoutMethod.MPESA,
  })
  payoutMethod!: RefundPayoutMethod;

  /**
   * Phone number for M-Pesa payout
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  payoutPhone?: string;

  /**
   * M-Pesa transaction ID (from B2C response)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  mpesaTransactionId?: string;

  /**
   * M-Pesa conversation ID (from B2C request)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  mpesaConversationId?: string;

  /**
   * Reason for cancellation/refund
   */
  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  /**
   * Journal entry ID for accounting
   */
  @Column({ type: 'uuid', nullable: true })
  journalEntryId?: string;

  /**
   * User who approved the refund
   */
  @Column({ type: 'uuid', nullable: true })
  approvedBy?: string;

  /**
   * Approval timestamp
   */
  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  /**
   * User who processed the payout
   */
  @Column({ type: 'uuid', nullable: true })
  processedBy?: string;

  /**
   * Payout timestamp
   */
  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  /**
   * Completion timestamp
   */
  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  /**
   * Failure reason (if status is FAILED)
   */
  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  /**
   * Additional metadata
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  // ===========================
  // Helper Methods
  // ===========================

  /**
   * Get refund amount in KES
   */
  getRefundAmountInKes(): number {
    return Number(this.refundAmountCents) / 100;
  }

  /**
   * Get reversal fee in KES
   */
  getReversalFeeInKes(): number {
    return Number(this.reversalFeeCents) / 100;
  }

  /**
   * Get original amount in KES
   */
  getOriginalAmountInKes(): number {
    return Number(this.originalAmountCents) / 100;
  }

  /**
   * Check if refund can be approved
   */
  canApprove(): boolean {
    return this.status === RefundStatus.PENDING;
  }

  /**
   * Check if refund can be processed (payout)
   */
  canProcess(): boolean {
    return this.status === RefundStatus.APPROVED;
  }

  /**
   * Check if refund is complete
   */
  isComplete(): boolean {
    return this.status === RefundStatus.COMPLETED;
  }

  /**
   * Check if refund failed
   */
  isFailed(): boolean {
    return this.status === RefundStatus.FAILED;
  }
}
