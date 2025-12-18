import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Notification channel type
 */
export enum NotificationChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

/**
 * Notification type/purpose
 */
export enum NotificationType {
  // Authentication
  OTP = 'OTP',

  // Payment related
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  // Policy related
  POLICY_ISSUED = 'POLICY_ISSUED',
  POLICY_EXPIRING = 'POLICY_EXPIRING',
  POLICY_EXPIRED = 'POLICY_EXPIRED',
  POLICY_DOCUMENT = 'POLICY_DOCUMENT',

  // KYC related
  KYC_APPROVED = 'KYC_APPROVED',
  KYC_REJECTED = 'KYC_REJECTED',

  // General
  WELCOME = 'WELCOME',
  ACCOUNT_UPDATE = 'ACCOUNT_UPDATE',
  SUPPORT = 'SUPPORT',
}

/**
 * Notification delivery status
 */
export enum NotificationStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

/**
 * Notification priority
 */
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Notification Entity
 * Tracks all notifications sent through the platform
 *
 * Per module_architecture.md notification requirements
 */
@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['status', 'scheduledFor'])
@Index(['channel', 'status'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User receiving the notification */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  /** Notification channel */
  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel!: NotificationChannel;

  /** Notification type/purpose */
  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: NotificationType,
  })
  notificationType!: NotificationType;

  /** Delivery status */
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  /** Priority level */
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority!: NotificationPriority;

  /** Recipient address (phone, email, etc.) */
  @Column({ type: 'varchar', length: 100 })
  recipient!: string;

  /** Message subject (for email/WhatsApp) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  subject?: string;

  /** Message content */
  @Column({ type: 'text' })
  content!: string;

  /** Template ID used (if any) */
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  /** Template variables used */
  @Column({ name: 'template_variables', type: 'jsonb', nullable: true })
  templateVariables?: Record<string, unknown>;

  /** Reference to related entity (policy, payment, etc.) */
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId?: string;

  /** Reference type */
  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType?: string;

  /** Scheduled delivery time (for delayed notifications) */
  @Column({ name: 'scheduled_for', type: 'timestamp with time zone', nullable: true })
  scheduledFor?: Date;

  /** When notification was sent to gateway */
  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt?: Date;

  /** When delivery was confirmed */
  @Column({ name: 'delivered_at', type: 'timestamp with time zone', nullable: true })
  deliveredAt?: Date;

  /** External message ID from gateway */
  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId?: string;

  /** Gateway/provider used */
  @Column({ type: 'varchar', length: 50, nullable: true })
  provider?: string;

  /** Cost of sending (in cents) */
  @Column({ type: 'integer', nullable: true })
  cost?: number;

  /** Error message if failed */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /** Retry count */
  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  /** Maximum retries allowed */
  @Column({ name: 'max_retries', type: 'integer', default: 3 })
  maxRetries!: number;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Check if notification can be retried
   */
  canRetry(): boolean {
    return (
      this.status === NotificationStatus.FAILED &&
      this.retryCount < this.maxRetries
    );
  }

  /**
   * Check if notification is pending or queued
   */
  isPending(): boolean {
    return (
      this.status === NotificationStatus.PENDING ||
      this.status === NotificationStatus.QUEUED
    );
  }

  /**
   * Check if notification was successfully delivered
   */
  isDelivered(): boolean {
    return (
      this.status === NotificationStatus.DELIVERED ||
      this.status === NotificationStatus.SENT
    );
  }

  /**
   * Mark as sent
   */
  markSent(externalId: string, provider: string): void {
    this.status = NotificationStatus.SENT;
    this.sentAt = new Date();
    this.externalId = externalId;
    this.provider = provider;
  }

  /**
   * Mark as delivered
   */
  markDelivered(): void {
    this.status = NotificationStatus.DELIVERED;
    this.deliveredAt = new Date();
  }

  /**
   * Mark as failed
   */
  markFailed(error: string): void {
    this.status = NotificationStatus.FAILED;
    this.errorMessage = error;
    this.retryCount++;
  }
}
