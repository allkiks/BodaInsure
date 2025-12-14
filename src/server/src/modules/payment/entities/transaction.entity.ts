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
import { Wallet } from './wallet.entity.js';

/**
 * Transaction Type enum
 */
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',           // Initial deposit payment
  DAILY_PAYMENT = 'DAILY_PAYMENT', // Daily 87 KES payment
  REFUND = 'REFUND',             // Refund to user
  ADJUSTMENT = 'ADJUSTMENT',     // Manual adjustment by admin
  REVERSAL = 'REVERSAL',         // Payment reversal
}

/**
 * Transaction Status enum
 */
export enum TransactionStatus {
  PENDING = 'PENDING',       // Payment initiated, awaiting confirmation
  PROCESSING = 'PROCESSING', // Being processed by payment provider
  COMPLETED = 'COMPLETED',   // Successfully completed
  FAILED = 'FAILED',         // Payment failed
  CANCELLED = 'CANCELLED',   // Cancelled by user or system
  REVERSED = 'REVERSED',     // Successfully reversed
}

/**
 * Payment Provider enum
 */
export enum PaymentProvider {
  MPESA = 'MPESA',
  MANUAL = 'MANUAL',  // Manual adjustment by admin
}

/**
 * Transaction entity
 * Immutable record of all financial transactions
 *
 * Per FEAT-PAY-004: Transaction History
 */
@Entity('transactions')
@Index(['userId', 'createdAt'])
@Index(['walletId', 'type'])
@Index(['status', 'createdAt'])
@Index(['mpesaReceiptNumber'], { unique: true, where: '"mpesa_receipt_number" IS NOT NULL' })
@Index(['idempotencyKey'], { unique: true, where: '"idempotency_key" IS NOT NULL' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet?: Wallet;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.MPESA,
  })
  provider!: PaymentProvider;

  /**
   * Amount in cents (e.g., 104800 = 1,048.00 KES)
   */
  @Column({ type: 'bigint' })
  amount!: number;

  /**
   * Currency code
   */
  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency!: string;

  /**
   * Phone number used for payment (E.164 format)
   */
  @Column({ type: 'varchar', length: 15, nullable: true })
  phone?: string;

  /**
   * M-Pesa receipt number (unique identifier from Safaricom)
   */
  @Column({ name: 'mpesa_receipt_number', type: 'varchar', length: 50, nullable: true })
  mpesaReceiptNumber?: string;

  /**
   * M-Pesa checkout request ID (from STK Push initiation)
   */
  @Column({ name: 'mpesa_checkout_request_id', type: 'varchar', length: 100, nullable: true })
  mpesaCheckoutRequestId?: string;

  /**
   * M-Pesa merchant request ID
   */
  @Column({ name: 'mpesa_merchant_request_id', type: 'varchar', length: 100, nullable: true })
  mpesaMerchantRequestId?: string;

  /**
   * Idempotency key for preventing duplicate transactions
   */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })
  idempotencyKey?: string;

  /**
   * Daily payment number (1-30) if type is DAILY_PAYMENT
   */
  @Column({ name: 'daily_payment_number', type: 'int', nullable: true })
  dailyPaymentNumber?: number;

  /**
   * Number of days being paid (for multi-day payments)
   */
  @Column({ name: 'days_count', type: 'int', default: 1 })
  daysCount!: number;

  /**
   * Description of the transaction
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Failure reason if status is FAILED
   */
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string;

  /**
   * Result code from payment provider
   */
  @Column({ name: 'result_code', type: 'varchar', length: 10, nullable: true })
  resultCode?: string;

  /**
   * Result description from payment provider
   */
  @Column({ name: 'result_description', type: 'text', nullable: true })
  resultDescription?: string;

  /**
   * Reference to related policy if payment triggered policy issuance
   */
  @Column({ name: 'policy_id', type: 'uuid', nullable: true })
  policyId?: string;

  /**
   * Admin user ID if this was a manual adjustment
   */
  @Column({ name: 'adjusted_by', type: 'uuid', nullable: true })
  adjustedBy?: string;

  /**
   * Reason for manual adjustment
   */
  @Column({ name: 'adjustment_reason', type: 'text', nullable: true })
  adjustmentReason?: string;

  /**
   * IP address of the payment initiator
   */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  /**
   * Additional metadata (JSON)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * Timestamp when payment was completed
   */
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

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
   * Check if transaction is successful
   */
  isSuccessful(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  /**
   * Check if transaction is still pending
   */
  isPending(): boolean {
    return this.status === TransactionStatus.PENDING ||
           this.status === TransactionStatus.PROCESSING;
  }
}

/**
 * Transaction type labels for display
 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.DEPOSIT]: 'Initial Deposit',
  [TransactionType.DAILY_PAYMENT]: 'Daily Payment',
  [TransactionType.REFUND]: 'Refund',
  [TransactionType.ADJUSTMENT]: 'Adjustment',
  [TransactionType.REVERSAL]: 'Reversal',
};

/**
 * Transaction status labels for display
 */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'Pending',
  [TransactionStatus.PROCESSING]: 'Processing',
  [TransactionStatus.COMPLETED]: 'Completed',
  [TransactionStatus.FAILED]: 'Failed',
  [TransactionStatus.CANCELLED]: 'Cancelled',
  [TransactionStatus.REVERSED]: 'Reversed',
};
