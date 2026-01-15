import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { EscrowTracking } from './escrow-tracking.entity.js';

/**
 * Remittance Batch Type
 */
export enum RemittanceBatchType {
  /** Same-day remittance for Day 1 deposits */
  DAY_1_IMMEDIATE = 'DAY_1_IMMEDIATE',
  /** Month-end bulk remittance for accumulated premiums */
  MONTHLY_BULK = 'MONTHLY_BULK',
}

/**
 * Remittance Batch Status
 */
export enum RemittanceBatchStatus {
  /** Batch created, awaiting approval */
  PENDING = 'PENDING',
  /** Approved, ready for processing */
  APPROVED = 'APPROVED',
  /** Being processed (bank transfer initiated) */
  PROCESSING = 'PROCESSING',
  /** Successfully completed */
  COMPLETED = 'COMPLETED',
  /** Failed (requires investigation) */
  FAILED = 'FAILED',
}

/**
 * Remittance Batch Entity
 *
 * Groups escrow records for batch remittance to the underwriter.
 *
 * Per Accounting_Remediation.md - Epic 5
 *
 * Batch Types:
 * - DAY_1_IMMEDIATE: Created daily for same-day Day 1 deposit remittances
 * - MONTHLY_BULK: Created monthly for accumulated Days 2-31 premiums
 */
@Entity('remittance_batches')
@Index(['batchType'])
@Index(['status'])
@Index(['batchDate'])
export class RemittanceBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique batch number (e.g., RB-20240115-001) */
  @Column({ name: 'batch_number', type: 'varchar', length: 50, unique: true })
  batchNumber!: string;

  /** Type of remittance batch */
  @Column({
    name: 'batch_type',
    type: 'enum',
    enum: RemittanceBatchType,
  })
  batchType!: RemittanceBatchType;

  /** Date of the batch */
  @Column({ name: 'batch_date', type: 'date' })
  batchDate!: Date;

  /** Total premium amount in cents */
  @Column({ name: 'total_premium_amount', type: 'bigint', default: 0 })
  totalPremiumAmount!: number;

  /** Total number of escrow records in batch */
  @Column({ name: 'total_records', type: 'int', default: 0 })
  totalRecords!: number;

  /** Current batch status */
  @Column({
    type: 'enum',
    enum: RemittanceBatchStatus,
    default: RemittanceBatchStatus.PENDING,
  })
  status!: RemittanceBatchStatus;

  /** User who approved the batch */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  /** When the batch was approved */
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  /** When the batch was processed (bank transfer completed) */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  /** Bank reference for the remittance */
  @Column({ name: 'bank_reference', type: 'varchar', length: 100, nullable: true })
  bankReference?: string;

  /** Journal entry created for this batch remittance */
  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId?: string;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /** Escrow records in this batch */
  @OneToMany(() => EscrowTracking, (escrow) => escrow.remittanceBatch)
  escrowRecords?: EscrowTracking[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get total premium amount in KES
   */
  getTotalPremiumInKes(): number {
    return Number(this.totalPremiumAmount) / 100;
  }

  /**
   * Check if batch can be approved
   */
  canBeApproved(): boolean {
    return this.status === RemittanceBatchStatus.PENDING && this.totalRecords > 0;
  }

  /**
   * Check if batch can be processed
   */
  canBeProcessed(): boolean {
    return this.status === RemittanceBatchStatus.APPROVED;
  }

  /**
   * Check if batch is a Day 1 immediate batch
   */
  isDay1Batch(): boolean {
    return this.batchType === RemittanceBatchType.DAY_1_IMMEDIATE;
  }

  /**
   * Check if batch is a monthly bulk batch
   */
  isMonthlyBulkBatch(): boolean {
    return this.batchType === RemittanceBatchType.MONTHLY_BULK;
  }
}
