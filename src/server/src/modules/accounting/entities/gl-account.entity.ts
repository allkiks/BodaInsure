import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

/**
 * GL Account Type enum
 * Standard accounting account classifications
 */
export enum GlAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

/**
 * GL Account Status enum
 */
export enum GlAccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

/**
 * Normal Balance enum
 * Determines whether debits or credits increase the account
 */
export enum NormalBalance {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/**
 * GL Account entity
 * Chart of Accounts for double-entry bookkeeping
 *
 * Per Accounting_Remediation.md - Epic 1
 * Implements standard accounting infrastructure for:
 * - Multi-party revenue split tracking (Platform, KBA, Robs, Definite)
 * - IRA regulatory compliance
 * - Auditable financial records
 */
@Entity('gl_accounts')
@Index(['accountCode'], { unique: true })
@Index(['accountType'])
export class GlAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_code', type: 'varchar', length: 20, unique: true })
  accountCode!: string;

  @Column({ name: 'account_name', type: 'varchar', length: 100 })
  accountName!: string;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: GlAccountType,
  })
  accountType!: GlAccountType;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => GlAccount, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: GlAccount;

  @OneToMany(() => GlAccount, (account) => account.parent)
  children?: GlAccount[];

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Current balance in cents (bigint for precision)
   * e.g., 104800 = 1,048.00 KES
   */
  @Column({ type: 'bigint', default: 0 })
  balance!: number;

  @Column({
    type: 'enum',
    enum: GlAccountStatus,
    default: GlAccountStatus.ACTIVE,
  })
  status!: GlAccountStatus;

  /**
   * Whether this is a system-defined account (cannot be deleted)
   */
  @Column({ name: 'is_system_account', type: 'boolean', default: false })
  isSystemAccount!: boolean;

  /**
   * Normal balance determines whether debits or credits increase the account
   * DEBIT: Assets, Expenses (debits increase, credits decrease)
   * CREDIT: Liabilities, Equity, Income (credits increase, debits decrease)
   */
  @Column({
    name: 'normal_balance',
    type: 'varchar',
    length: 10,
  })
  normalBalance!: NormalBalance;

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
   * Check if debit increases this account
   */
  isDebitPositive(): boolean {
    return this.normalBalance === NormalBalance.DEBIT;
  }

  /**
   * Check if credit increases this account
   */
  isCreditPositive(): boolean {
    return this.normalBalance === NormalBalance.CREDIT;
  }
}
