import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '../../identity/entities/user.entity.js';

/**
 * Wallet Status enum
 * Per GAP-010: Added LAPSED for grace period expiration
 */
export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',       // Temporarily frozen for investigation
  SUSPENDED = 'SUSPENDED', // Account suspended
  LAPSED = 'LAPSED',       // Grace period expired without completing payments
}

/**
 * Wallet entity
 * Tracks user's payment balance and payment progress
 *
 * Per FEAT-PAY-003: Wallet Balance View
 * Per business model:
 * - Initial deposit: 1,048 KES → Policy 1 issued
 * - Daily payments: 87 KES × 30 → Policy 2 issued after 30th
 */
@Entity('wallets')
@Index(['userId'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status!: WalletStatus;

  /**
   * Current wallet balance in KES (cents for precision)
   * Stored as integer to avoid floating point issues
   * e.g., 104800 = 1,048.00 KES
   */
  @Column({ type: 'bigint', default: 0 })
  balance!: number;

  /**
   * Total amount deposited ever (in cents)
   */
  @Column({ name: 'total_deposited', type: 'bigint', default: 0 })
  totalDeposited!: number;

  /**
   * Total amount used for payments (in cents)
   */
  @Column({ name: 'total_paid', type: 'bigint', default: 0 })
  totalPaid!: number;

  /**
   * Whether initial deposit has been made
   */
  @Column({ name: 'deposit_completed', type: 'boolean', default: false })
  depositCompleted!: boolean;

  /**
   * Date when initial deposit was completed
   */
  @Column({ name: 'deposit_completed_at', type: 'timestamptz', nullable: true })
  depositCompletedAt?: Date;

  /**
   * Number of daily payments completed (0-30)
   */
  @Column({ name: 'daily_payments_count', type: 'int', default: 0 })
  dailyPaymentsCount!: number;

  /**
   * Date of last daily payment
   */
  @Column({ name: 'last_daily_payment_at', type: 'timestamptz', nullable: true })
  lastDailyPaymentAt?: Date;

  /**
   * Whether all 30 daily payments are complete
   */
  @Column({ name: 'daily_payments_completed', type: 'boolean', default: false })
  dailyPaymentsCompleted!: boolean;

  /**
   * Date when all daily payments were completed
   */
  @Column({ name: 'daily_payments_completed_at', type: 'timestamptz', nullable: true })
  dailyPaymentsCompletedAt?: Date;

  /**
   * Currency code (always KES for MVP)
   */
  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency!: string;

  /**
   * Optimistic locking for concurrent balance updates
   */
  @VersionColumn()
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get balance in KES (from cents)
   */
  getBalanceInKes(): number {
    return Number(this.balance) / 100;
  }

  /**
   * Get total deposited in KES
   */
  getTotalDepositedInKes(): number {
    return Number(this.totalDeposited) / 100;
  }

  /**
   * Get remaining daily payments needed
   */
  getRemainingDailyPayments(): number {
    return Math.max(0, 30 - this.dailyPaymentsCount);
  }

  /**
   * Get completion percentage for daily payments
   */
  getDailyPaymentProgress(): number {
    return Math.round((this.dailyPaymentsCount / 30) * 100);
  }
}
