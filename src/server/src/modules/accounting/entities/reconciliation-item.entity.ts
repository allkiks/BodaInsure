import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Reconciliation status (defined here to avoid circular imports)
 */
export enum ReconciliationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  MATCHED = 'MATCHED',
  UNMATCHED = 'UNMATCHED',
  RESOLVED = 'RESOLVED',
}

/**
 * Match types for reconciliation items
 */
export enum MatchType {
  EXACT = 'EXACT',           // Exact match on reference and amount
  AMOUNT_ONLY = 'AMOUNT_ONLY', // Amount matches but reference differs
  REFERENCE_ONLY = 'REFERENCE_ONLY', // Reference matches but amount differs
  FUZZY = 'FUZZY',           // Partial match based on heuristics
  MANUAL = 'MANUAL',         // Manually matched by user
}

// Forward reference to avoid circular import
import type { ReconciliationRecord } from './reconciliation-record.entity.js';

/**
 * Reconciliation Item Entity
 *
 * Represents a single item being reconciled between source and ledger.
 *
 * Per Accounting_Remediation.md - Epic 8
 */
@Entity('reconciliation_items')
@Index(['reconciliationId'])
@Index(['status'])
@Index(['sourceReference'])
@Unique(['reconciliationId', 'lineNumber'])
export class ReconciliationItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'reconciliation_id', type: 'uuid' })
  reconciliationId!: string;

  @ManyToOne('ReconciliationRecord', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reconciliation_id' })
  reconciliationRecord!: ReconciliationRecord;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber!: number;

  // Source (external statement) fields
  @Column({ name: 'source_reference', type: 'varchar', length: 100, nullable: true })
  sourceReference?: string;

  @Column({ name: 'source_amount', type: 'bigint', nullable: true })
  sourceAmount?: number;

  @Column({ name: 'source_date', type: 'date', nullable: true })
  sourceDate?: Date;

  @Column({ name: 'source_description', type: 'text', nullable: true })
  sourceDescription?: string;

  // Ledger (internal system) fields
  @Column({ name: 'ledger_transaction_id', type: 'uuid', nullable: true })
  ledgerTransactionId?: string;

  @Column({ name: 'ledger_amount', type: 'bigint', nullable: true })
  ledgerAmount?: number;

  @Column({ name: 'ledger_date', type: 'date', nullable: true })
  ledgerDate?: Date;

  @Column({ name: 'ledger_description', type: 'text', nullable: true })
  ledgerDescription?: string;

  // Status and matching
  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  status!: ReconciliationStatus;

  @Column({ type: 'bigint', default: 0 })
  variance!: number;

  @Column({ name: 'match_type', type: 'varchar', length: 50, nullable: true })
  matchType?: string;

  @Column({ name: 'match_confidence', type: 'decimal', precision: 5, scale: 2, nullable: true })
  matchConfidence?: number;

  // Resolution fields
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get source amount in KES
   */
  getSourceAmountInKes(): number {
    return this.sourceAmount ? Number(this.sourceAmount) / 100 : 0;
  }

  /**
   * Get ledger amount in KES
   */
  getLedgerAmountInKes(): number {
    return this.ledgerAmount ? Number(this.ledgerAmount) / 100 : 0;
  }

  /**
   * Get variance in KES
   */
  getVarianceInKes(): number {
    return Number(this.variance) / 100;
  }

  /**
   * Check if item is matched
   */
  isMatched(): boolean {
    return this.status === ReconciliationStatus.MATCHED;
  }

  /**
   * Check if item is unmatched
   */
  isUnmatched(): boolean {
    return this.status === ReconciliationStatus.UNMATCHED || this.status === ReconciliationStatus.PENDING;
  }

  /**
   * Check if item has source data
   */
  hasSourceData(): boolean {
    return this.sourceReference !== null || this.sourceAmount !== null;
  }

  /**
   * Check if item has ledger data
   */
  hasLedgerData(): boolean {
    return this.ledgerTransactionId !== null || this.ledgerAmount !== null;
  }

  /**
   * Check if item is orphan (only source or only ledger)
   */
  isOrphan(): boolean {
    return (this.hasSourceData() && !this.hasLedgerData()) ||
           (!this.hasSourceData() && this.hasLedgerData());
  }

  /**
   * Calculate variance between source and ledger
   */
  calculateVariance(): number {
    const source = this.sourceAmount ? Number(this.sourceAmount) : 0;
    const ledger = this.ledgerAmount ? Number(this.ledgerAmount) : 0;
    return source - ledger;
  }
}
