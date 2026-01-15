import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Job type
 */
export enum JobType {
  POLICY_BATCH = 'POLICY_BATCH',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  POLICY_EXPIRY_REMINDER = 'POLICY_EXPIRY_REMINDER',
  LAPSE_CHECK = 'LAPSE_CHECK',
  REPORT_GENERATION = 'REPORT_GENERATION',
  REPORT_CLEANUP = 'REPORT_CLEANUP',
  DATA_SYNC = 'DATA_SYNC',
  NOTIFICATION_RETRY = 'NOTIFICATION_RETRY',
  WALLET_RECONCILIATION = 'WALLET_RECONCILIATION',
  // Accounting jobs
  DAILY_SERVICE_FEE_SETTLEMENT = 'DAILY_SERVICE_FEE_SETTLEMENT',
  MONTHLY_COMMISSION_SETTLEMENT = 'MONTHLY_COMMISSION_SETTLEMENT',
  DAILY_MPESA_RECONCILIATION = 'DAILY_MPESA_RECONCILIATION',
  REMITTANCE_BATCH_PROCESSING = 'REMITTANCE_BATCH_PROCESSING',
  CUSTOM = 'CUSTOM',
}

/**
 * Job status
 */
export enum JobStatus {
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

/**
 * Job Entity
 * Represents a scheduled/executed job
 */
@Entity('jobs')
@Index(['type', 'status'])
@Index(['scheduledAt'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Job name */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Job type */
  @Column({
    type: 'enum',
    enum: JobType,
  })
  @Index()
  type!: JobType;

  /** Job status */
  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.SCHEDULED,
  })
  @Index()
  status!: JobStatus;

  /** Cron expression (if recurring) */
  @Column({ name: 'cron_expression', type: 'varchar', length: 50, nullable: true })
  cronExpression?: string;

  /** Is this a recurring job? */
  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring!: boolean;

  /** Job configuration/parameters */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  config?: Record<string, unknown>;

  /** Scheduled execution time */
  @Column({ name: 'scheduled_at', type: 'timestamp with time zone' })
  scheduledAt!: Date;

  /** Actual start time */
  @Column({ name: 'started_at', type: 'timestamp with time zone', nullable: true })
  startedAt?: Date;

  /** Completion time */
  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  /** Next run time (for recurring jobs) */
  @Column({ name: 'next_run_at', type: 'timestamp with time zone', nullable: true })
  nextRunAt?: Date;

  /** Execution duration in milliseconds */
  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs?: number;

  /** Result summary */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  result?: {
    processed?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    details?: Record<string, unknown>;
  };

  /** Error message if failed */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /** Error stack trace */
  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack?: string;

  /** Retry count */
  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  /** Maximum retries */
  @Column({ name: 'max_retries', type: 'integer', default: 3 })
  maxRetries!: number;

  /** Last retry at */
  @Column({ name: 'last_retry_at', type: 'timestamp with time zone', nullable: true })
  lastRetryAt?: Date;

  /** Created by user ID */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  /** Is job enabled? */
  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
