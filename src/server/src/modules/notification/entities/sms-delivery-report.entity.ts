import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * SMS Delivery Status from providers
 * Per Africa's Talking API documentation
 */
export enum SmsDeliveryStatus {
  /** Message accepted by gateway */
  SENT = 'Sent',
  /** Message submitted to carrier */
  SUBMITTED = 'Submitted',
  /** Message queued at carrier (transient) */
  BUFFERED = 'Buffered',
  /** Message rejected by carrier */
  REJECTED = 'Rejected',
  /** Message delivered to handset */
  SUCCESS = 'Success',
  /** Message delivery failed */
  FAILED = 'Failed',
  /** Message expired before delivery */
  EXPIRED = 'Expired',
}

/**
 * Network codes for Kenyan carriers
 * Per Africa's Talking documentation
 */
export enum KenyanNetworkCode {
  SAFARICOM = '63902',
  AIRTEL = '63903',
  TELKOM = '63907',
  EQUITEL = '63909',
  FAIBA = '63910',
  UNKNOWN = 'UNKNOWN',
}

/**
 * SMS Delivery Report Entity
 * Tracks delivery status callbacks from SMS providers
 *
 * Per Africa's Talking delivery report callback:
 * - id: The message ID (ATXid_xxx)
 * - status: Delivery status (Success, Failed, Rejected, etc.)
 * - phoneNumber: Recipient phone number
 * - networkCode: Carrier network code
 * - failureReason: Reason for failure (if applicable)
 *
 * Per CLAUDE.md audit requirements - 7 year retention
 */
@Entity('sms_delivery_reports')
@Index(['messageId'])
@Index(['phoneNumber'])
@Index(['status', 'receivedAt'])
@Index(['provider', 'receivedAt'])
export class SmsDeliveryReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** External message ID from provider (e.g., ATXid_xxx) */
  @Column({ name: 'message_id', type: 'varchar', length: 100 })
  @Index()
  messageId!: string;

  /** SMS provider (africastalking, advantasms) */
  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  /** Delivery status */
  @Column({
    type: 'enum',
    enum: SmsDeliveryStatus,
  })
  status!: SmsDeliveryStatus;

  /** Recipient phone number (masked for logs, stored for auditing) */
  @Column({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber!: string;

  /** Network code (carrier identification) */
  @Column({ name: 'network_code', type: 'varchar', length: 20, nullable: true })
  networkCode?: string;

  /** Failure reason if status is Failed/Rejected */
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string;

  /** Retry number for this message (from provider) */
  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  /** Related notification ID (if tracked) */
  @Column({ name: 'notification_id', type: 'uuid', nullable: true })
  notificationId?: string;

  /** Cost of the message (parsed from provider response) */
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cost?: number;

  /** Currency of the cost */
  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency!: string;

  /** Raw callback payload for debugging */
  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown>;

  /** When the delivery report was received */
  @CreateDateColumn({ name: 'received_at', type: 'timestamp with time zone' })
  receivedAt!: Date;

  /** When the message was actually delivered (from provider) */
  @Column({ name: 'delivered_at', type: 'timestamp with time zone', nullable: true })
  deliveredAt?: Date;

  /**
   * Check if delivery was successful
   */
  isSuccessful(): boolean {
    return this.status === SmsDeliveryStatus.SUCCESS;
  }

  /**
   * Check if delivery is still pending
   */
  isPending(): boolean {
    return (
      this.status === SmsDeliveryStatus.SENT ||
      this.status === SmsDeliveryStatus.SUBMITTED ||
      this.status === SmsDeliveryStatus.BUFFERED
    );
  }

  /**
   * Check if delivery failed permanently
   */
  isFailed(): boolean {
    return (
      this.status === SmsDeliveryStatus.FAILED ||
      this.status === SmsDeliveryStatus.REJECTED ||
      this.status === SmsDeliveryStatus.EXPIRED
    );
  }

  /**
   * Get carrier name from network code
   */
  getCarrierName(): string {
    const carriers: Record<string, string> = {
      [KenyanNetworkCode.SAFARICOM]: 'Safaricom',
      [KenyanNetworkCode.AIRTEL]: 'Airtel Kenya',
      [KenyanNetworkCode.TELKOM]: 'Telkom Kenya',
      [KenyanNetworkCode.EQUITEL]: 'Equitel',
      [KenyanNetworkCode.FAIBA]: 'Faiba',
    };
    return carriers[this.networkCode ?? ''] ?? 'Unknown';
  }
}
