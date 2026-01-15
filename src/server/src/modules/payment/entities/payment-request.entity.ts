import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../identity/entities/user.entity.js';
import { TransactionType } from './transaction.entity.js';

/**
 * Payment Request Status enum
 * Tracks the lifecycle of an M-Pesa STK Push request
 */
export enum PaymentRequestStatus {
  INITIATED = 'INITIATED',     // STK Push sent to M-Pesa
  SENT = 'SENT',               // M-Pesa accepted, prompt sent to user
  COMPLETED = 'COMPLETED',     // User completed payment
  FAILED = 'FAILED',           // Payment failed
  CANCELLED = 'CANCELLED',     // User cancelled on phone
  TIMEOUT = 'TIMEOUT',         // No response within timeout
  EXPIRED = 'EXPIRED',         // Request expired before processing
}

/**
 * Payment Request entity
 * Tracks M-Pesa STK Push requests
 *
 * Per FEAT-PAY-001 and FEAT-PAY-002
 * Used for:
 * - Initial deposit (1,048 KES)
 * - Daily payments (87 KES × 1-30 days)
 */
@Entity('payment_requests')
@Index(['userId', 'status'])
@Index(['checkoutRequestId'], { unique: true, where: '"checkout_request_id" IS NOT NULL' })
@Index(['idempotencyKey'], { unique: true })
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    type: 'enum',
    enum: PaymentRequestStatus,
    default: PaymentRequestStatus.INITIATED,
  })
  status!: PaymentRequestStatus;

  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: TransactionType,
  })
  paymentType!: TransactionType;

  /**
   * Amount in cents (e.g., 104800 = 1,048.00 KES)
   */
  @Column({ type: 'bigint' })
  amount!: number;

  /**
   * Phone number for STK Push (E.164 format)
   */
  @Column({ type: 'varchar', length: 15 })
  phone!: string;

  /**
   * Idempotency key for preventing duplicate requests
   * Client-provided unique identifier
   */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey!: string;

  /**
   * M-Pesa Checkout Request ID (from STK Push response)
   */
  @Column({ name: 'checkout_request_id', type: 'varchar', length: 100, nullable: true })
  checkoutRequestId?: string;

  /**
   * M-Pesa Merchant Request ID (from STK Push response)
   */
  @Column({ name: 'merchant_request_id', type: 'varchar', length: 100, nullable: true })
  merchantRequestId?: string;

  /**
   * M-Pesa response code from STK Push initiation
   */
  @Column({ name: 'response_code', type: 'varchar', length: 10, nullable: true })
  responseCode?: string;

  /**
   * M-Pesa response description
   */
  @Column({ name: 'response_description', type: 'text', nullable: true })
  responseDescription?: string;

  /**
   * M-Pesa result code from callback
   */
  @Column({ name: 'result_code', type: 'varchar', length: 10, nullable: true })
  resultCode?: string;

  /**
   * M-Pesa result description from callback
   */
  @Column({ name: 'result_description', type: 'text', nullable: true })
  resultDescription?: string;

  /**
   * M-Pesa receipt number (from successful callback)
   */
  @Column({ name: 'mpesa_receipt_number', type: 'varchar', length: 50, nullable: true })
  mpesaReceiptNumber?: string;

  /**
   * Transaction ID created upon successful payment
   */
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string;

  /**
   * Number of days being paid (for multi-day payments)
   */
  @Column({ name: 'days_count', type: 'int', default: 1 })
  daysCount!: number;

  /**
   * Account reference for M-Pesa (shown on user's phone)
   */
  @Column({ name: 'account_reference', type: 'varchar', length: 50 })
  accountReference!: string;

  /**
   * Transaction description for M-Pesa (shown on user's phone)
   */
  @Column({ name: 'transaction_desc', type: 'varchar', length: 100 })
  transactionDesc!: string;

  /**
   * IP address of the request initiator
   */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  /**
   * User agent of the request initiator
   */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  /**
   * Callback received timestamp
   */
  @Column({ name: 'callback_received_at', type: 'timestamptz', nullable: true })
  callbackReceivedAt?: Date;

  /**
   * Full callback payload (for debugging)
   */
  @Column({ name: 'callback_payload', type: 'jsonb', nullable: true })
  callbackPayload?: Record<string, unknown>;

  /**
   * Additional metadata (e.g., delayed processing status)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * Number of callback retry attempts
   */
  @Column({ name: 'callback_retries', type: 'int', default: 0 })
  callbackRetries!: number;

  /**
   * Request expiry time (STK Push timeout)
   */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get amount in KES
   */
  getAmountInKes(): number {
    return Number(this.amount) / 100;
  }

  /**
   * Check if request has expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if request is still pending
   */
  isPending(): boolean {
    return this.status === PaymentRequestStatus.INITIATED ||
           this.status === PaymentRequestStatus.SENT;
  }

  /**
   * Check if request was successful
   */
  isSuccessful(): boolean {
    return this.status === PaymentRequestStatus.COMPLETED;
  }
}

/**
 * M-Pesa STK Push timeout in seconds
 */
export const MPESA_STK_TIMEOUT_SECONDS = 120;

/**
 * Maximum callback retries
 */
export const MAX_CALLBACK_RETRIES = 3;
