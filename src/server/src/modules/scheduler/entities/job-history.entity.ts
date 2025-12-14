import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job, JobStatus } from './job.entity.js';

/**
 * Job History Entity
 * Tracks individual job execution history
 */
@Entity('job_history')
@Index(['jobId', 'startedAt'])
@Index(['startedAt'])
export class JobHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Reference to job */
  @Column({ name: 'job_id', type: 'uuid' })
  @Index()
  jobId!: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job?: Job;

  /** Job name (snapshot) */
  @Column({ name: 'job_name', type: 'varchar', length: 100 })
  jobName!: string;

  /** Execution status */
  @Column({
    type: 'enum',
    enum: JobStatus,
  })
  @Index()
  status!: JobStatus;

  /** Start time */
  @Column({ name: 'started_at', type: 'timestamp with time zone' })
  startedAt!: Date;

  /** End time */
  @Column({ name: 'ended_at', type: 'timestamp with time zone', nullable: true })
  endedAt?: Date;

  /** Duration in milliseconds */
  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs?: number;

  /** Execution result */
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

  /** Error message */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /** Triggered by (user ID or 'system') */
  @Column({ name: 'triggered_by', type: 'varchar', length: 100, default: 'system' })
  triggeredBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
