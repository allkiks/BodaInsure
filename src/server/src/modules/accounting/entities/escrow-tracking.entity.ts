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
import { RemittanceBatch } from './remittance-batch.entity.js';

/**
 * Escrow Type
 * Determines remittance timing
 */
export enum EscrowType {
  /** Day 1 deposit - remitted same-day to Definite */
  DAY_1_IMMEDIATE = 'DAY_1_IMMEDIATE',
  /** Days 2-31 payments - accumulated for month-end bulk remittance */
  DAYS_2_31_ACCUMULATED = 'DAYS_2_31_ACCUMULATED',
}

/**
 * Remittance Status
 * Tracks the lifecycle of escrowed funds
 */
export enum RemittanceStatus {
  /** Payment received, awaiting remittance scheduling */
  PENDING = 'PENDING',
  /** Included in a remittance batch */
  SCHEDULED = 'SCHEDULED',
  /** Successfully remitted to underwriter */
  REMITTED = 'REMITTED',
  /** Returned to rider (policy cancellation/refund) */
  REFUNDED = 'REFUNDED',
}

/**
 * Escrow Tracking Entity
 *
 * Tracks premium funds held in escrow before remittance to the underwriter.
 *
 * Per Accounting_Remediation.md - Epic 5
 *
 * Business Rules:
 * - Day 1 payments (KES 1,045 premium): Remitted same-day to Definite
 * - Days 2-31 payments (KES 84 premium/day): Accumulated, remitted monthly
 * - Refunds: 90% returned to rider, 10% reversal fee distributed
 */
@Entity('escrow_tracking')
@Index(['riderId'])
@Index(['transactionId'])
@Index(['remittanceStatus'])
@Index(['remittanceBatchId'])
@Index(['escrowType'])
@Index(['createdAt'])
export class EscrowTracking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Rider who made the payment */
  @Column({ name: 'rider_id', type: 'uuid' })
  riderId!: string;

  /** Source payment transaction */
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  /** Payment day (1 for deposit, 2-31 for daily payments) */
  @Column({ name: 'payment_day', type: 'int' })
  paymentDay!: number;

  /** Premium amount in cents (portion going to underwriter) */
  @Column({ name: 'premium_amount', type: 'bigint' })
  premiumAmount!: number;

  /** Service fee amount in cents (KES 3 total) */
  @Column({ name: 'service_fee_amount', type: 'bigint' })
  serviceFeeAmount!: number;

  /** Escrow type determines remittance timing */
  @Column({
    name: 'escrow_type',
    type: 'enum',
    enum: EscrowType,
  })
  escrowType!: EscrowType;

  /** Current remittance status */
  @Column({
    name: 'remittance_status',
    type: 'enum',
    enum: RemittanceStatus,
    default: RemittanceStatus.PENDING,
  })
  remittanceStatus!: RemittanceStatus;

  /** Batch this escrow record belongs to (when scheduled/remitted) */
  @Column({ name: 'remittance_batch_id', type: 'uuid', nullable: true })
  remittanceBatchId?: string;

  @ManyToOne(() => RemittanceBatch, { nullable: true })
  @JoinColumn({ name: 'remittance_batch_id' })
  remittanceBatch?: RemittanceBatch;

  /** When funds were remitted to underwriter */
  @Column({ name: 'remitted_at', type: 'timestamptz', nullable: true })
  remittedAt?: Date;

  /** Bank reference for the remittance */
  @Column({ name: 'bank_reference', type: 'varchar', length: 100, nullable: true })
  bankReference?: string;

  /** Journal entry created for remittance */
  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId?: string;

  /** Transaction ID if this was refunded */
  @Column({ name: 'refund_transaction_id', type: 'uuid', nullable: true })
  refundTransactionId?: string;

  /** When funds were refunded */
  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt?: Date;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get premium amount in KES
   */
  getPremiumInKes(): number {
    return Number(this.premiumAmount) / 100;
  }

  /**
   * Get service fee amount in KES
   */
  getServiceFeeInKes(): number {
    return Number(this.serviceFeeAmount) / 100;
  }

  /**
   * Get total payment amount in KES
   */
  getTotalInKes(): number {
    return this.getPremiumInKes() + this.getServiceFeeInKes();
  }

  /**
   * Check if this escrow can be included in a remittance batch
   */
  canBeScheduled(): boolean {
    return this.remittanceStatus === RemittanceStatus.PENDING;
  }

  /**
   * Check if this escrow can be refunded
   */
  canBeRefunded(): boolean {
    return [RemittanceStatus.PENDING, RemittanceStatus.SCHEDULED].includes(
      this.remittanceStatus,
    );
  }

  /**
   * Check if this is a Day 1 immediate remittance
   */
  isDay1Immediate(): boolean {
    return this.escrowType === EscrowType.DAY_1_IMMEDIATE;
  }
}
