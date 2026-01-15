import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Audit event type
 */
export enum AuditEventType {
  // Authentication events
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  OTP_REQUESTED = 'OTP_REQUESTED',
  OTP_VERIFIED = 'OTP_VERIFIED',
  OTP_FAILED = 'OTP_FAILED',

  // KYC events
  KYC_DOCUMENT_UPLOADED = 'KYC_DOCUMENT_UPLOADED',
  KYC_APPROVED = 'KYC_APPROVED',
  KYC_REJECTED = 'KYC_REJECTED',

  // Payment events
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUND_COMPLETED = 'REFUND_COMPLETED',

  // Policy events
  POLICY_CREATED = 'POLICY_CREATED',
  POLICY_ACTIVATED = 'POLICY_ACTIVATED',
  POLICY_RENEWED = 'POLICY_RENEWED',
  POLICY_CANCELLED = 'POLICY_CANCELLED',
  POLICY_LAPSED = 'POLICY_LAPSED',
  POLICY_DOCUMENT_GENERATED = 'POLICY_DOCUMENT_GENERATED',

  // Organization events
  ORGANIZATION_CREATED = 'ORGANIZATION_CREATED',
  ORGANIZATION_VERIFIED = 'ORGANIZATION_VERIFIED',
  ORGANIZATION_SUSPENDED = 'ORGANIZATION_SUSPENDED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',

  // Admin events
  ADMIN_USER_SEARCH = 'ADMIN_USER_SEARCH',
  ADMIN_USER_UPDATE = 'ADMIN_USER_UPDATE',
  ADMIN_KYC_OVERRIDE = 'ADMIN_KYC_OVERRIDE',
  ADMIN_POLICY_OVERRIDE = 'ADMIN_POLICY_OVERRIDE',

  // Accounting events
  JOURNAL_ENTRY_CREATED = 'JOURNAL_ENTRY_CREATED',
  JOURNAL_ENTRY_POSTED = 'JOURNAL_ENTRY_POSTED',
  JOURNAL_ENTRY_REVERSED = 'JOURNAL_ENTRY_REVERSED',
  SETTLEMENT_CREATED = 'SETTLEMENT_CREATED',
  SETTLEMENT_APPROVED = 'SETTLEMENT_APPROVED',
  SETTLEMENT_PROCESSED = 'SETTLEMENT_PROCESSED',
  SETTLEMENT_CANCELLED = 'SETTLEMENT_CANCELLED',
  RECONCILIATION_CREATED = 'RECONCILIATION_CREATED',
  RECONCILIATION_ITEM_MATCHED = 'RECONCILIATION_ITEM_MATCHED',
  RECONCILIATION_ITEM_RESOLVED = 'RECONCILIATION_ITEM_RESOLVED',
  REMITTANCE_BATCH_CREATED = 'REMITTANCE_BATCH_CREATED',
  REMITTANCE_BATCH_APPROVED = 'REMITTANCE_BATCH_APPROVED',
  REMITTANCE_BATCH_PROCESSED = 'REMITTANCE_BATCH_PROCESSED',
  FINANCIAL_REPORT_GENERATED = 'FINANCIAL_REPORT_GENERATED',

  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  BATCH_STARTED = 'BATCH_STARTED',
  BATCH_COMPLETED = 'BATCH_COMPLETED',
  DATA_EXPORT = 'DATA_EXPORT',
}

/**
 * Audit Event Entity
 * Immutable record of all significant system events
 */
@Entity('audit_events')
@Index(['eventType', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['entityType', 'entityId'])
@Index(['createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Event type */
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: AuditEventType,
  })
  @Index()
  eventType!: AuditEventType;

  /** User who performed the action */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId?: string;

  /** Acting user (for admin actions on behalf of user) */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  /** Entity type (e.g., 'user', 'policy', 'payment') */
  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: true })
  entityType?: string;

  /** Entity ID */
  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string;

  /** Event description */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Event details (JSON) */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  details?: Record<string, unknown>;

  /** IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  /** User agent */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  /** Request ID for correlation */
  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId?: string;

  /** Session ID */
  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId?: string;

  /** Source channel (web, app, ussd, api) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  channel?: string;

  /** Outcome (success/failure) */
  @Column({ type: 'varchar', length: 20, default: 'success' })
  outcome!: string;

  /** Error message if failed */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
