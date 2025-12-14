import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Batch processing status
 */
export enum BatchStatus {
  /** Batch created, waiting to start */
  PENDING = 'PENDING',
  /** Currently processing */
  PROCESSING = 'PROCESSING',
  /** All items processed successfully */
  COMPLETED = 'COMPLETED',
  /** Some items failed */
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  /** Batch processing failed */
  FAILED = 'FAILED',
  /** Batch was cancelled */
  CANCELLED = 'CANCELLED',
}

/**
 * Batch schedule - which daily batch this is
 * Per module_architecture.md: 08:00, 14:00, 20:00 EAT
 */
export enum BatchSchedule {
  BATCH_1 = 'BATCH_1', // 08:00 EAT
  BATCH_2 = 'BATCH_2', // 14:00 EAT
  BATCH_3 = 'BATCH_3', // 20:00 EAT
  MANUAL = 'MANUAL',   // Manually triggered
}

/**
 * Policy Batch Entity
 * Tracks batch processing of policy issuance
 *
 * Per module_architecture.md - Batch Processing Schedule
 */
@Entity('policy_batches')
@Index(['status', 'scheduledFor'])
@Index(['batchDate', 'schedule'], { unique: true })
export class PolicyBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Batch reference number (human-readable) */
  @Column({ name: 'batch_number', type: 'varchar', length: 50 })
  @Index({ unique: true })
  batchNumber!: string;

  /** Which scheduled batch (BATCH_1, BATCH_2, BATCH_3, MANUAL) */
  @Column({
    type: 'enum',
    enum: BatchSchedule,
  })
  schedule!: BatchSchedule;

  /** Date this batch is for (YYYY-MM-DD) */
  @Column({ name: 'batch_date', type: 'date' })
  batchDate!: Date;

  /** Current status */
  @Column({
    type: 'enum',
    enum: BatchStatus,
    default: BatchStatus.PENDING,
  })
  status!: BatchStatus;

  /** When this batch is scheduled to run */
  @Column({ name: 'scheduled_for', type: 'timestamp with time zone' })
  scheduledFor!: Date;

  /** When batch processing started */
  @Column({ name: 'started_at', type: 'timestamp with time zone', nullable: true })
  startedAt?: Date;

  /** When batch processing completed */
  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  /** Payment window start (payments after this time are included) */
  @Column({ name: 'payment_window_start', type: 'timestamp with time zone' })
  paymentWindowStart!: Date;

  /** Payment window end (payments before this time are included) */
  @Column({ name: 'payment_window_end', type: 'timestamp with time zone' })
  paymentWindowEnd!: Date;

  /** Total number of policies in this batch */
  @Column({ name: 'total_policies', type: 'int', default: 0 })
  totalPolicies!: number;

  /** Number of policies successfully processed */
  @Column({ name: 'processed_count', type: 'int', default: 0 })
  processedCount!: number;

  /** Number of policies that failed */
  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount!: number;

  /** Number of 1-month policies in batch */
  @Column({ name: 'one_month_count', type: 'int', default: 0 })
  oneMonthCount!: number;

  /** Number of 11-month policies in batch */
  @Column({ name: 'eleven_month_count', type: 'int', default: 0 })
  elevenMonthCount!: number;

  /** Total premium amount in batch (cents) */
  @Column({ name: 'total_premium', type: 'bigint', default: 0 })
  totalPremium!: number;

  /** Processing duration in milliseconds */
  @Column({ name: 'processing_duration_ms', type: 'bigint', nullable: true })
  processingDurationMs?: number;

  /** Error details if batch failed */
  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: Record<string, unknown>;

  /** List of failed policy IDs with reasons */
  @Column({ name: 'failed_policies', type: 'jsonb', nullable: true })
  failedPolicies?: Array<{ policyId: string; error: string }>;

  /** User who triggered manual batch (if applicable) */
  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy?: string;

  /** Notes or comments about this batch */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Check if batch is complete
   */
  isComplete(): boolean {
    return (
      this.status === BatchStatus.COMPLETED ||
      this.status === BatchStatus.COMPLETED_WITH_ERRORS ||
      this.status === BatchStatus.FAILED ||
      this.status === BatchStatus.CANCELLED
    );
  }

  /**
   * Check if batch is currently processing
   */
  isProcessing(): boolean {
    return this.status === BatchStatus.PROCESSING;
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.totalPolicies === 0) return 0;
    return Math.round((this.processedCount / this.totalPolicies) * 100);
  }

  /**
   * Get total premium in KES
   */
  getTotalPremiumInKes(): number {
    return Number(this.totalPremium) / 100;
  }

  /**
   * Get processing duration in seconds
   */
  getProcessingDurationSeconds(): number | null {
    if (!this.processingDurationMs) return null;
    return Math.round(Number(this.processingDurationMs) / 1000);
  }

  /**
   * Generate batch number in format: BATCH-YYYYMMDD-N
   */
  static generateBatchNumber(date: Date, schedule: BatchSchedule): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const scheduleNum = schedule === BatchSchedule.BATCH_1 ? '1' :
                        schedule === BatchSchedule.BATCH_2 ? '2' :
                        schedule === BatchSchedule.BATCH_3 ? '3' : 'M';
    return `BATCH-${year}${month}${day}-${scheduleNum}`;
  }
}
