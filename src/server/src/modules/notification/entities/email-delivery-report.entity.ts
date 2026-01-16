import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Email delivery status enum
 */
export enum EmailDeliveryStatus {
  SENT = 'Sent',
  DELIVERED = 'Delivered',
  OPENED = 'Opened',
  CLICKED = 'Clicked',
  BOUNCED = 'Bounced',
  COMPLAINED = 'Complained',
  FAILED = 'Failed',
  DEFERRED = 'Deferred',
}

/**
 * Email bounce type
 */
export enum EmailBounceType {
  SOFT = 'Soft',
  HARD = 'Hard',
  TRANSIENT = 'Transient',
  PERMANENT = 'Permanent',
}

/**
 * Email Delivery Report Entity
 * Tracks email delivery status and engagement metrics
 *
 * Per GAP-E01: Email delivery tracking for audit compliance
 */
@Entity('email_delivery_reports')
@Index(['messageId'])
@Index(['recipient'])
@Index(['status', 'receivedAt'])
@Index(['provider', 'receivedAt'])
export class EmailDeliveryReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** External message ID from SMTP/provider */
  @Column({ name: 'message_id', type: 'varchar', length: 200 })
  messageId!: string;

  /** Email provider used */
  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  /** Delivery status */
  @Column({
    type: 'enum',
    enum: EmailDeliveryStatus,
  })
  status!: EmailDeliveryStatus;

  /** Recipient email address */
  @Column({ type: 'varchar', length: 255 })
  recipient!: string;

  /** Email subject (for reference) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  subject?: string;

  /** Bounce type if bounced */
  @Column({
    name: 'bounce_type',
    type: 'enum',
    enum: EmailBounceType,
    nullable: true,
  })
  bounceType?: EmailBounceType;

  /** Failure/bounce reason */
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string;

  /** SMTP response code */
  @Column({ name: 'smtp_code', type: 'varchar', length: 10, nullable: true })
  smtpCode?: string;

  /** Retry count at time of report */
  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  /** Related notification ID */
  @Column({ name: 'notification_id', type: 'uuid', nullable: true })
  notificationId?: string;

  /** Raw webhook/callback payload */
  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown>;

  /** When the report was received */
  @CreateDateColumn({ name: 'received_at', type: 'timestamp with time zone' })
  receivedAt!: Date;

  /** When email was sent */
  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt?: Date;

  /** When email was delivered */
  @Column({ name: 'delivered_at', type: 'timestamp with time zone', nullable: true })
  deliveredAt?: Date;

  /** When email was opened */
  @Column({ name: 'opened_at', type: 'timestamp with time zone', nullable: true })
  openedAt?: Date;

  /** When email was clicked */
  @Column({ name: 'clicked_at', type: 'timestamp with time zone', nullable: true })
  clickedAt?: Date;

  /**
   * Check if delivery was successful
   */
  isSuccessful(): boolean {
    return [
      EmailDeliveryStatus.SENT,
      EmailDeliveryStatus.DELIVERED,
      EmailDeliveryStatus.OPENED,
      EmailDeliveryStatus.CLICKED,
    ].includes(this.status);
  }

  /**
   * Check if delivery failed
   */
  isFailed(): boolean {
    return [
      EmailDeliveryStatus.BOUNCED,
      EmailDeliveryStatus.COMPLAINED,
      EmailDeliveryStatus.FAILED,
    ].includes(this.status);
  }

  /**
   * Check if delivery is pending/deferred
   */
  isPending(): boolean {
    return this.status === EmailDeliveryStatus.DEFERRED;
  }

  /**
   * Check if this is a hard bounce (permanent failure)
   */
  isHardBounce(): boolean {
    return (
      this.status === EmailDeliveryStatus.BOUNCED &&
      (this.bounceType === EmailBounceType.HARD ||
        this.bounceType === EmailBounceType.PERMANENT)
    );
  }
}
