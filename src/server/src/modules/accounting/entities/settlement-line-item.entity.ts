import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { PartnerSettlement } from './partner-settlement.entity.js';

/**
 * Settlement Line Item Entity
 *
 * Represents an individual item within a partner settlement.
 *
 * Per Accounting_Remediation.md - Epic 6
 */
@Entity('settlement_line_items')
@Index(['settlementId'])
@Index(['riderId'])
@Unique(['settlementId', 'lineNumber'])
export class SettlementLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'settlement_id', type: 'uuid' })
  settlementId!: string;

  @ManyToOne(() => PartnerSettlement, (settlement) => settlement.lineItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'settlement_id' })
  settlement!: PartnerSettlement;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber!: number;

  @Column({ name: 'rider_id', type: 'uuid', nullable: true })
  riderId?: string;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string;

  @Column({ name: 'escrow_id', type: 'uuid', nullable: true })
  escrowId?: string;

  @Column({ type: 'bigint' })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'reference_date', type: 'date', nullable: true })
  referenceDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Get amount in KES
   */
  getAmountInKes(): number {
    return Number(this.amount) / 100;
  }
}
