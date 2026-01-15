import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Check,
} from 'typeorm';
import { JournalEntryLine } from './journal-entry-line.entity.js';

/**
 * Journal Entry Type enum
 * Categorizes different types of accounting entries
 */
export enum JournalEntryType {
  PAYMENT_RECEIPT_DAY1 = 'PAYMENT_RECEIPT_DAY1',
  PAYMENT_RECEIPT_DAILY = 'PAYMENT_RECEIPT_DAILY',
  PREMIUM_REMITTANCE_DAY1 = 'PREMIUM_REMITTANCE_DAY1',
  PREMIUM_REMITTANCE_BULK = 'PREMIUM_REMITTANCE_BULK',
  SERVICE_FEE_DISTRIBUTION = 'SERVICE_FEE_DISTRIBUTION',
  REFUND_INITIATION = 'REFUND_INITIATION',
  REFUND_EXECUTION = 'REFUND_EXECUTION',
  COMMISSION_RECEIPT = 'COMMISSION_RECEIPT',
  COMMISSION_DISTRIBUTION = 'COMMISSION_DISTRIBUTION',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

/**
 * Journal Entry Status enum
 * Tracks the lifecycle of a journal entry
 */
export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

/**
 * Journal Entry entity
 * Header record for double-entry accounting transactions
 *
 * Per Accounting_Remediation.md - Epic 2
 * Implements:
 * - Double-entry bookkeeping with balanced debits/credits
 * - Full audit trail with approval workflow
 * - Reversible entries for corrections
 */
@Entity('journal_entries')
@Index(['entryDate'])
@Index(['entryType'])
@Index(['status'])
@Index(['sourceTransactionId'])
@Index(['riderId'])
@Check('"total_debit" = "total_credit"')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique entry number for reference (e.g., JE-2024-000001)
   */
  @Column({ name: 'entry_number', type: 'varchar', length: 50, unique: true })
  entryNumber!: string;

  /**
   * Date the entry is recorded (accounting date)
   */
  @Column({ name: 'entry_date', type: 'date' })
  entryDate!: Date;

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: JournalEntryType,
  })
  entryType!: JournalEntryType;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: JournalEntryStatus,
    default: JournalEntryStatus.DRAFT,
  })
  status!: JournalEntryStatus;

  /**
   * Total debit amount in cents (must equal totalCredit)
   */
  @Column({ name: 'total_debit', type: 'bigint', default: 0 })
  totalDebit!: number;

  /**
   * Total credit amount in cents (must equal totalDebit)
   */
  @Column({ name: 'total_credit', type: 'bigint', default: 0 })
  totalCredit!: number;

  /**
   * Link to originating payment transaction
   */
  @Column({ name: 'source_transaction_id', type: 'uuid', nullable: true })
  sourceTransactionId?: string;

  /**
   * Type of source entity (e.g., 'payment_request', 'transaction')
   */
  @Column({ name: 'source_entity_type', type: 'varchar', length: 50, nullable: true })
  sourceEntityType?: string;

  /**
   * ID of source entity
   */
  @Column({ name: 'source_entity_id', type: 'uuid', nullable: true })
  sourceEntityId?: string;

  /**
   * Rider (user) associated with this entry
   */
  @Column({ name: 'rider_id', type: 'uuid', nullable: true })
  riderId?: string;

  /**
   * User who created this entry
   */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  /**
   * User who approved this entry
   */
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  /**
   * When the entry was posted (affected GL balances)
   */
  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt?: Date;

  /**
   * User who reversed this entry
   */
  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy?: string;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt?: Date;

  @Column({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason?: string;

  /**
   * ID of the entry that reverses this one
   */
  @Column({ name: 'reversing_entry_id', type: 'uuid', nullable: true })
  reversingEntryId?: string;

  /**
   * ID of the original entry (if this is a reversal)
   */
  @Column({ name: 'original_entry_id', type: 'uuid', nullable: true })
  originalEntryId?: string;

  /**
   * Additional metadata (payment details, M-Pesa references, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * Journal entry lines (debit and credit entries)
   */
  @OneToMany(() => JournalEntryLine, (line) => line.journalEntry, { cascade: true })
  lines!: JournalEntryLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Check if entry is balanced (debits = credits)
   */
  isBalanced(): boolean {
    return Number(this.totalDebit) === Number(this.totalCredit);
  }

  /**
   * Check if entry can be posted
   */
  canPost(): boolean {
    return this.status === JournalEntryStatus.APPROVED && this.isBalanced();
  }

  /**
   * Check if entry can be reversed
   */
  canReverse(): boolean {
    return this.status === JournalEntryStatus.POSTED && !this.reversingEntryId;
  }

  /**
   * Get total debit in KES
   */
  getTotalDebitInKes(): number {
    return Number(this.totalDebit) / 100;
  }

  /**
   * Get total credit in KES
   */
  getTotalCreditInKes(): number {
    return Number(this.totalCredit) / 100;
  }
}
