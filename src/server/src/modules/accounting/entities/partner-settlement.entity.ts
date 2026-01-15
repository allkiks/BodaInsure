import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SettlementLineItem } from './settlement-line-item.entity.js';
import { JournalEntry } from './journal-entry.entity.js';

/**
 * Partner types for settlements
 */
export enum PartnerType {
  DEFINITE_ASSURANCE = 'DEFINITE_ASSURANCE',
  KBA = 'KBA',
  ROBS_INSURANCE = 'ROBS_INSURANCE',
  ATRONACH = 'ATRONACH',
}

/**
 * Settlement types
 */
export enum SettlementType {
  SERVICE_FEE = 'SERVICE_FEE',
  COMMISSION = 'COMMISSION',
  PREMIUM_REMITTANCE = 'PREMIUM_REMITTANCE',
  REVERSAL_FEE = 'REVERSAL_FEE',
}

/**
 * Settlement status
 */
export enum SettlementStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Partner Settlement Entity
 *
 * Represents a settlement batch for a specific partner.
 *
 * Per Accounting_Remediation.md - Epic 6
 */
@Entity('partner_settlements')
@Index(['partnerType'])
@Index(['settlementType'])
@Index(['status'])
@Index(['periodStart', 'periodEnd'])
export class PartnerSettlement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'settlement_number', type: 'varchar', length: 50, unique: true })
  settlementNumber!: string;

  @Column({
    name: 'partner_type',
    type: 'enum',
    enum: PartnerType,
  })
  partnerType!: PartnerType;

  @Column({
    name: 'settlement_type',
    type: 'enum',
    enum: SettlementType,
  })
  settlementType!: SettlementType;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: Date;

  @Column({ name: 'total_amount', type: 'bigint', default: 0 })
  totalAmount!: number;

  @Column({ name: 'transaction_count', type: 'int', default: 0 })
  transactionCount!: number;

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PENDING,
  })
  status!: SettlementStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'bank_reference', type: 'varchar', length: 100, nullable: true })
  bankReference?: string;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bankAccount?: string;

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt?: Date;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId?: string;

  @ManyToOne(() => JournalEntry, { nullable: true })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry?: JournalEntry;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => SettlementLineItem, (item) => item.settlement, { cascade: true })
  lineItems!: SettlementLineItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Get total amount in KES
   */
  getTotalInKes(): number {
    return Number(this.totalAmount) / 100;
  }

  /**
   * Check if settlement can be approved
   */
  canBeApproved(): boolean {
    return this.status === SettlementStatus.PENDING;
  }

  /**
   * Check if settlement can be processed
   */
  canBeProcessed(): boolean {
    return this.status === SettlementStatus.APPROVED;
  }

  /**
   * Check if settlement is complete
   */
  isComplete(): boolean {
    return this.status === SettlementStatus.COMPLETED;
  }

  /**
   * Get partner display name
   */
  getPartnerDisplayName(): string {
    const names: Record<PartnerType, string> = {
      [PartnerType.DEFINITE_ASSURANCE]: 'Definite Assurance Co.',
      [PartnerType.KBA]: 'Kenya Bodaboda Association',
      [PartnerType.ROBS_INSURANCE]: 'Robs Insurance Agency',
      [PartnerType.ATRONACH]: 'Atronach K Ltd (Platform)',
    };
    return names[this.partnerType] || this.partnerType;
  }

  /**
   * Get settlement type display name
   */
  getTypeDisplayName(): string {
    const names: Record<SettlementType, string> = {
      [SettlementType.SERVICE_FEE]: 'Service Fee',
      [SettlementType.COMMISSION]: 'Commission',
      [SettlementType.PREMIUM_REMITTANCE]: 'Premium Remittance',
      [SettlementType.REVERSAL_FEE]: 'Reversal Fee',
    };
    return names[this.settlementType] || this.settlementType;
  }
}
