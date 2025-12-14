import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReportDefinition, ReportFormat } from './report-definition.entity.js';

/**
 * Report status
 */
export enum ReportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

/**
 * Generated Report Entity
 * Stores generated report instances
 */
@Entity('generated_reports')
@Index(['userId', 'status'])
@Index(['createdAt'])
export class GeneratedReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Reference to report definition */
  @Column({ name: 'report_definition_id', type: 'uuid' })
  @Index()
  reportDefinitionId!: string;

  @ManyToOne(() => ReportDefinition)
  @JoinColumn({ name: 'report_definition_id' })
  reportDefinition?: ReportDefinition;

  /** Report name (snapshot from definition) */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Report format */
  @Column({
    type: 'enum',
    enum: ReportFormat,
  })
  format!: ReportFormat;

  /** Report status */
  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  @Index()
  status!: ReportStatus;

  /** Parameters used for this report */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  parameters?: Record<string, unknown>;

  /** Date range for report */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: Date;

  /** Organization filter */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  @Index()
  organizationId?: string;

  /** File URL (for exports) */
  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl?: string;

  /** File size in bytes */
  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize?: number;

  /** Record count */
  @Column({ name: 'record_count', type: 'integer', nullable: true })
  recordCount?: number;

  /** Report data (for JSON reports) */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  data?: Record<string, unknown>;

  /** Error message if failed */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /** Processing time in milliseconds */
  @Column({ name: 'processing_time_ms', type: 'integer', nullable: true })
  processingTimeMs?: number;

  /** User who requested the report */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  /** Expiration date */
  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;
}
