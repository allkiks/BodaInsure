import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ReconciliationItem, ReconciliationStatus } from './reconciliation-item.entity.js';

// Re-export ReconciliationStatus for external use
export { ReconciliationStatus };

/**
 * Reconciliation types
 */
export enum ReconciliationType {
  DAILY_MPESA = 'DAILY_MPESA',
  MONTHLY_BANK = 'MONTHLY_BANK',
  PARTNER_SETTLEMENT = 'PARTNER_SETTLEMENT',
}

/**
 * Reconciliation Record Entity
 *
 * Represents a reconciliation run for a specific date and source.
 *
 * Per Accounting_Remediation.md - Epic 8
 */
@Entity('reconciliation_records')
@Index(['reconciliationType'])
@Index(['reconciliationDate'])
@Index(['status'])
export class ReconciliationRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'reconciliation_type',
    type: 'enum',
    enum: ReconciliationType,
  })
  reconciliationType!: ReconciliationType;

  @Column({ name: 'reconciliation_date', type: 'date' })
  reconciliationDate!: Date;

  @Column({ name: 'source_name', type: 'varchar', length: 100 })
  sourceName!: string;

  @Column({ name: 'source_balance', type: 'bigint', default: 0 })
  sourceBalance!: number;

  @Column({ name: 'ledger_balance', type: 'bigint', default: 0 })
  ledgerBalance!: number;

  @Column({ type: 'bigint', default: 0 })
  variance!: number;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  status!: ReconciliationStatus;

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems!: number;

  @Column({ name: 'matched_count', type: 'int', default: 0 })
  matchedCount!: number;

  @Column({ name: 'unmatched_count', type: 'int', default: 0 })
  unmatchedCount!: number;

  @Column({ name: 'auto_matched_count', type: 'int', default: 0 })
  autoMatchedCount!: number;

  @Column({ name: 'manual_matched_count', type: 'int', default: 0 })
  manualMatchedCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ name: 'source_file_path', type: 'varchar', length: 500, nullable: true })
  sourceFilePath?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany('ReconciliationItem', 'reconciliationRecord', { cascade: true })
  items!: ReconciliationItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get source balance in KES
   */
  getSourceBalanceInKes(): number {
    return Number(this.sourceBalance) / 100;
  }

  /**
   * Get ledger balance in KES
   */
  getLedgerBalanceInKes(): number {
    return Number(this.ledgerBalance) / 100;
  }

  /**
   * Get variance in KES
   */
  getVarianceInKes(): number {
    return Number(this.variance) / 100;
  }

  /**
   * Check if reconciliation is balanced
   */
  isBalanced(): boolean {
    return Number(this.variance) === 0;
  }

  /**
   * Check if all items are matched
   */
  isFullyMatched(): boolean {
    return this.unmatchedCount === 0 && this.totalItems > 0;
  }

  /**
   * Get match percentage
   */
  getMatchPercentage(): number {
    if (this.totalItems === 0) return 0;
    return Math.round((this.matchedCount / this.totalItems) * 100);
  }

  /**
   * Check if reconciliation can be resolved
   */
  canBeResolved(): boolean {
    return this.status === ReconciliationStatus.IN_PROGRESS ||
           this.status === ReconciliationStatus.UNMATCHED;
  }

  /**
   * Get type display name
   */
  getTypeDisplayName(): string {
    const names: Record<ReconciliationType, string> = {
      [ReconciliationType.DAILY_MPESA]: 'Daily M-Pesa Statement',
      [ReconciliationType.MONTHLY_BANK]: 'Monthly Bank Statement',
      [ReconciliationType.PARTNER_SETTLEMENT]: 'Partner Settlement',
    };
    return names[this.reconciliationType] || this.reconciliationType;
  }
}
