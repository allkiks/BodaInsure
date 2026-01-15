import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  Unique,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity.js';
import { GlAccount } from './gl-account.entity.js';

/**
 * Journal Entry Line entity
 * Individual debit or credit line within a journal entry
 *
 * Per Accounting_Remediation.md - Epic 2
 * Implements:
 * - One-sided entries (either debit OR credit, not both)
 * - Link to GL accounts for balance updates
 * - Line descriptions for audit trail
 */
@Entity('journal_entry_lines')
@Index(['journalEntryId'])
@Index(['glAccountId'])
@Unique(['journalEntryId', 'lineNumber'])
@Check('("debit_amount" > 0 AND "credit_amount" = 0) OR ("credit_amount" > 0 AND "debit_amount" = 0)')
export class JournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId!: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry!: JournalEntry;

  @Column({ name: 'gl_account_id', type: 'uuid' })
  glAccountId!: string;

  @ManyToOne(() => GlAccount)
  @JoinColumn({ name: 'gl_account_id' })
  glAccount!: GlAccount;

  /**
   * Line number within the journal entry (for ordering)
   */
  @Column({ name: 'line_number', type: 'int' })
  lineNumber!: number;

  /**
   * Debit amount in cents (mutually exclusive with creditAmount)
   */
  @Column({ name: 'debit_amount', type: 'bigint', default: 0 })
  debitAmount!: number;

  /**
   * Credit amount in cents (mutually exclusive with debitAmount)
   */
  @Column({ name: 'credit_amount', type: 'bigint', default: 0 })
  creditAmount!: number;

  /**
   * Line-specific description
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Check if this is a debit line
   */
  isDebit(): boolean {
    return Number(this.debitAmount) > 0;
  }

  /**
   * Check if this is a credit line
   */
  isCredit(): boolean {
    return Number(this.creditAmount) > 0;
  }

  /**
   * Get the amount (regardless of debit/credit)
   */
  getAmount(): number {
    return this.isDebit() ? Number(this.debitAmount) : Number(this.creditAmount);
  }

  /**
   * Get amount in KES
   */
  getAmountInKes(): number {
    return this.getAmount() / 100;
  }
}
