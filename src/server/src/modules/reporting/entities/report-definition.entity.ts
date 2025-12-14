import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Report type
 */
export enum ReportType {
  ENROLLMENT = 'ENROLLMENT',
  PAYMENT = 'PAYMENT',
  POLICY = 'POLICY',
  ORGANIZATION = 'ORGANIZATION',
  FINANCIAL = 'FINANCIAL',
  CUSTOM = 'CUSTOM',
}

/**
 * Report format
 */
export enum ReportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  PDF = 'PDF',
}

/**
 * Report frequency
 */
export enum ReportFrequency {
  MANUAL = 'MANUAL',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/**
 * Report Definition Entity
 * Defines available reports and their configurations
 */
@Entity('report_definitions')
@Index(['type', 'isActive'])
export class ReportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Report name */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Report description */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Report type */
  @Column({
    type: 'enum',
    enum: ReportType,
  })
  @Index()
  type!: ReportType;

  /** Default format */
  @Column({
    name: 'default_format',
    type: 'enum',
    enum: ReportFormat,
    default: ReportFormat.JSON,
  })
  defaultFormat!: ReportFormat;

  /** Available formats */
  @Column({
    name: 'available_formats',
    type: 'simple-array',
    default: 'JSON,CSV',
  })
  availableFormats!: ReportFormat[];

  /** Report frequency */
  @Column({
    type: 'enum',
    enum: ReportFrequency,
    default: ReportFrequency.MANUAL,
  })
  frequency!: ReportFrequency;

  /** Query/configuration JSON */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  config?: {
    query?: string;
    parameters?: Record<string, unknown>;
    columns?: string[];
    filters?: Array<{
      field: string;
      type: string;
      options?: string[];
    }>;
  };

  /** Required roles to access this report */
  @Column({
    name: 'required_roles',
    type: 'simple-array',
    nullable: true,
  })
  requiredRoles?: string[];

  /** Organization scope (null = platform-wide) */
  @Column({
    name: 'organization_id',
    type: 'uuid',
    nullable: true,
  })
  @Index()
  organizationId?: string;

  /** Active flag */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Created by user ID */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
