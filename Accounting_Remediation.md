# BodaInsure Accounting System Remediation Plan

**Document Version:** 1.0
**Created:** January 2026
**Related Document:** Accounting_Audit.md
**Target Completion:** Phase 1 Implementation

---

## Executive Summary

This document provides a comprehensive, step-by-step remediation plan to address the critical accounting infrastructure gaps identified in the BodaInsure Accounting Audit. The plan is organized into epics and tasks with clear dependencies, data model specifications, and migration considerations.

### Remediation Objectives

1. Implement double-entry accounting with full General Ledger
2. Enable accurate multi-party revenue split tracking
3. Achieve IRA regulatory compliance
4. Provide auditable financial records
5. Support automated reconciliation

### Implementation Timeline Overview

| Phase | Duration | Focus Area |
|-------|----------|------------|
| **Phase 1** | Weeks 1-4 | Core GL Infrastructure |
| **Phase 2** | Weeks 5-8 | Posting Engine & Payment Refactor |
| **Phase 3** | Weeks 9-12 | Settlement & Reconciliation |
| **Phase 4** | Weeks 13-16 | Reporting & UI |

---

## Table of Contents

1. [Epic Structure Overview](#1-epic-structure-overview)
2. [Epic 1: General Ledger Infrastructure](#2-epic-1-general-ledger-infrastructure)
3. [Epic 2: Journal Entry System](#3-epic-2-journal-entry-system)
4. [Epic 3: Posting Engine](#4-epic-3-posting-engine)
5. [Epic 4: Payment Service Refactoring](#5-epic-4-payment-service-refactoring)
6. [Epic 5: Escrow Management](#6-epic-5-escrow-management)
7. [Epic 6: Partner Settlement System](#7-epic-6-partner-settlement-system)
8. [Epic 7: Commission Calculator](#8-epic-7-commission-calculator)
9. [Epic 8: Reconciliation System](#9-epic-8-reconciliation-system)
10. [Epic 9: Financial Reporting](#10-epic-9-financial-reporting)
11. [Epic 10: Accounting UI](#11-epic-10-accounting-ui)
12. [Data Model Changes](#12-data-model-changes)
13. [Migration Strategy](#13-migration-strategy)
14. [Testing Strategy](#14-testing-strategy)
15. [Rollout Plan](#15-rollout-plan)

---

## 1. Epic Structure Overview

```
EPIC DEPENDENCY GRAPH
═══════════════════════════════════════════════════════════════

                    ┌─────────────────┐
                    │ Epic 1: GL      │
                    │ Infrastructure  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Epic 2: Journal │
                    │ Entry System    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Epic 3: Posting │
                    │ Engine          │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Epic 4:     │ │ Epic 5:     │ │ Epic 6:     │
    │ Payment     │ │ Escrow      │ │ Settlement  │
    │ Refactor    │ │ Management  │ │ System      │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │ Epic 7:         │
                    │ Commission      │
                    │ Calculator      │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ Epic 8:         │          │ Epic 9:         │
    │ Reconciliation  │          │ Financial       │
    │ System          │          │ Reporting       │
    └────────┬────────┘          └────────┬────────┘
             │                            │
             └──────────────┬─────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Epic 10:        │
                    │ Accounting UI   │
                    └─────────────────┘
```

---

## 2. Epic 1: General Ledger Infrastructure

**Priority:** P0 - Critical
**Dependencies:** None
**Estimated Effort:** 2 weeks

### Task 1.1: Create GL Account Database Schema

**File:** `src/server/src/database/migrations/[timestamp]-CreateGlAccounts.ts`

```sql
-- Migration SQL

CREATE TYPE gl_account_type_enum AS ENUM (
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE'
);

CREATE TYPE gl_account_status_enum AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'CLOSED'
);

CREATE TABLE gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(20) NOT NULL UNIQUE,
  account_name VARCHAR(100) NOT NULL,
  account_type gl_account_type_enum NOT NULL,
  parent_id UUID REFERENCES gl_accounts(id),
  description TEXT,
  balance BIGINT NOT NULL DEFAULT 0,
  status gl_account_status_enum NOT NULL DEFAULT 'ACTIVE',
  is_system_account BOOLEAN NOT NULL DEFAULT false,
  normal_balance VARCHAR(10) NOT NULL, -- 'DEBIT' or 'CREDIT'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_normal_balance CHECK (normal_balance IN ('DEBIT', 'CREDIT'))
);

CREATE INDEX idx_gl_accounts_code ON gl_accounts(account_code);
CREATE INDEX idx_gl_accounts_type ON gl_accounts(account_type);
CREATE INDEX idx_gl_accounts_parent ON gl_accounts(parent_id);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] All constraints enforced
- [ ] Indexes created

### Task 1.2: Create GL Account Entity

**File:** `src/server/src/modules/accounting/entities/gl-account.entity.ts`

```typescript
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

export enum GlAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum GlAccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

export enum NormalBalance {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

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

  @Column({ type: 'bigint', default: 0 })
  balance!: number;

  @Column({
    type: 'enum',
    enum: GlAccountStatus,
    default: GlAccountStatus.ACTIVE,
  })
  status!: GlAccountStatus;

  @Column({ name: 'is_system_account', type: 'boolean', default: false })
  isSystemAccount!: boolean;

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
}
```

**Acceptance Criteria:**
- [ ] Entity compiles without errors
- [ ] TypeORM recognizes entity
- [ ] Relationships properly defined

### Task 1.3: Create GL Account Service

**File:** `src/server/src/modules/accounting/services/gl-account.service.ts`

```typescript
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GlAccount, GlAccountType, GlAccountStatus, NormalBalance } from '../entities/gl-account.entity.js';

@Injectable()
export class GlAccountService {
  private readonly logger = new Logger(GlAccountService.name);

  constructor(
    @InjectRepository(GlAccount)
    private readonly glAccountRepository: Repository<GlAccount>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get account by code
   */
  async getByCode(accountCode: string): Promise<GlAccount> {
    const account = await this.glAccountRepository.findOne({
      where: { accountCode },
    });
    if (!account) {
      throw new NotFoundException(`GL Account ${accountCode} not found`);
    }
    return account;
  }

  /**
   * Get all accounts by type
   */
  async getByType(accountType: GlAccountType): Promise<GlAccount[]> {
    return this.glAccountRepository.find({
      where: { accountType, status: GlAccountStatus.ACTIVE },
      order: { accountCode: 'ASC' },
    });
  }

  /**
   * Get chart of accounts (hierarchical)
   */
  async getChartOfAccounts(): Promise<GlAccount[]> {
    return this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
      relations: ['children'],
      order: { accountCode: 'ASC' },
    });
  }

  /**
   * Update account balance (internal use only)
   * Called by JournalEntryService after posting
   */
  async updateBalance(
    accountId: string,
    debitAmount: number,
    creditAmount: number,
  ): Promise<GlAccount> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(GlAccount);

      const account = await repo.findOne({
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new NotFoundException('GL Account not found');
      }

      // Calculate balance change based on normal balance
      let balanceChange: number;
      if (account.normalBalance === NormalBalance.DEBIT) {
        // Debits increase, credits decrease
        balanceChange = debitAmount - creditAmount;
      } else {
        // Credits increase, debits decrease
        balanceChange = creditAmount - debitAmount;
      }

      account.balance = Number(account.balance) + balanceChange;
      await repo.save(account);

      this.logger.debug(
        `Account ${account.accountCode} balance updated: ${balanceChange > 0 ? '+' : ''}${balanceChange / 100} KES`,
      );

      return account;
    });
  }

  /**
   * Create new GL account
   */
  async create(data: {
    accountCode: string;
    accountName: string;
    accountType: GlAccountType;
    parentId?: string;
    description?: string;
    isSystemAccount?: boolean;
  }): Promise<GlAccount> {
    // Check for duplicate
    const existing = await this.glAccountRepository.findOne({
      where: { accountCode: data.accountCode },
    });
    if (existing) {
      throw new ConflictException(`Account code ${data.accountCode} already exists`);
    }

    // Determine normal balance based on account type
    const normalBalance = [GlAccountType.ASSET, GlAccountType.EXPENSE].includes(data.accountType)
      ? NormalBalance.DEBIT
      : NormalBalance.CREDIT;

    const account = this.glAccountRepository.create({
      ...data,
      normalBalance,
      status: GlAccountStatus.ACTIVE,
      balance: 0,
    });

    return this.glAccountRepository.save(account);
  }

  /**
   * Get trial balance
   */
  async getTrialBalance(): Promise<{
    accounts: Array<{
      accountCode: string;
      accountName: string;
      debitBalance: number;
      creditBalance: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    const accounts = await this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
      order: { accountCode: 'ASC' },
    });

    const result = accounts.map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      debitBalance: account.normalBalance === NormalBalance.DEBIT ? Number(account.balance) : 0,
      creditBalance: account.normalBalance === NormalBalance.CREDIT ? Number(account.balance) : 0,
    }));

    const totalDebits = result.reduce((sum, a) => sum + a.debitBalance, 0);
    const totalCredits = result.reduce((sum, a) => sum + a.creditBalance, 0);

    return {
      accounts: result,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
    };
  }
}
```

**Acceptance Criteria:**
- [ ] Service compiles without errors
- [ ] CRUD operations work correctly
- [ ] Balance updates are transactional
- [ ] Trial balance calculation correct

### Task 1.4: Seed Chart of Accounts

**File:** `src/server/src/database/seeds/chart-of-accounts.seed.ts`

```typescript
import { DataSource } from 'typeorm';
import { GlAccount, GlAccountType, NormalBalance, GlAccountStatus } from '../../modules/accounting/entities/gl-account.entity.js';

export const CHART_OF_ACCOUNTS = [
  // ASSETS
  { code: '1001', name: 'Cash at Bank - UBA Escrow', type: GlAccountType.ASSET },
  { code: '1002', name: 'Cash at Bank - Platform Operating', type: GlAccountType.ASSET },
  { code: '1101', name: 'Accounts Receivable - Definite Commission', type: GlAccountType.ASSET },

  // LIABILITIES
  { code: '2001', name: 'Premium Payable to Definite Assurance', type: GlAccountType.LIABILITY },
  { code: '2002', name: 'Service Fee Payable to KBA', type: GlAccountType.LIABILITY },
  { code: '2003', name: 'Service Fee Payable to Robs Insurance', type: GlAccountType.LIABILITY },
  { code: '2004', name: 'Commission Payable to KBA', type: GlAccountType.LIABILITY },
  { code: '2005', name: 'Commission Payable to Robs Insurance', type: GlAccountType.LIABILITY },
  { code: '2101', name: 'Refund Payable to Riders', type: GlAccountType.LIABILITY },

  // INCOME
  { code: '4001', name: 'Platform Service Fee Income', type: GlAccountType.INCOME },
  { code: '4002', name: 'Platform Commission Income - O&M', type: GlAccountType.INCOME },
  { code: '4003', name: 'Platform Commission Income - Profit Share', type: GlAccountType.INCOME },
  { code: '4004', name: 'Platform Reversal Fee Income', type: GlAccountType.INCOME },

  // EXPENSES
  { code: '5001', name: 'Platform Maintenance Costs', type: GlAccountType.EXPENSE },
  { code: '5002', name: 'Transaction Costs', type: GlAccountType.EXPENSE },
];

export async function seedChartOfAccounts(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(GlAccount);

  for (const account of CHART_OF_ACCOUNTS) {
    const existing = await repo.findOne({ where: { accountCode: account.code } });
    if (!existing) {
      const normalBalance = [GlAccountType.ASSET, GlAccountType.EXPENSE].includes(account.type)
        ? NormalBalance.DEBIT
        : NormalBalance.CREDIT;

      await repo.save({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        normalBalance,
        status: GlAccountStatus.ACTIVE,
        isSystemAccount: true,
        balance: 0,
      });
      console.log(`Created GL account: ${account.code} - ${account.name}`);
    }
  }
}
```

**Acceptance Criteria:**
- [ ] All 15 accounts created
- [ ] Accounts marked as system accounts
- [ ] Normal balance correctly assigned

### Task 1.5: Create Accounting Module

**File:** `src/server/src/modules/accounting/accounting.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlAccount } from './entities/gl-account.entity.js';
import { GlAccountService } from './services/gl-account.service.js';
import { GlAccountController } from './controllers/gl-account.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([GlAccount])],
  providers: [GlAccountService],
  controllers: [GlAccountController],
  exports: [GlAccountService],
})
export class AccountingModule {}
```

**Acceptance Criteria:**
- [ ] Module registered in app.module.ts
- [ ] Dependency injection working
- [ ] API endpoints accessible

---

## 3. Epic 2: Journal Entry System

**Priority:** P0 - Critical
**Dependencies:** Epic 1
**Estimated Effort:** 2 weeks

### Task 2.1: Create Journal Entry Database Schema

**File:** `src/server/src/database/migrations/[timestamp]-CreateJournalEntries.ts`

```sql
CREATE TYPE journal_entry_type_enum AS ENUM (
  'PAYMENT_RECEIPT_DAY1',
  'PAYMENT_RECEIPT_DAILY',
  'PREMIUM_REMITTANCE_DAY1',
  'PREMIUM_REMITTANCE_BULK',
  'SERVICE_FEE_DISTRIBUTION',
  'REFUND_INITIATION',
  'REFUND_EXECUTION',
  'COMMISSION_RECEIPT',
  'COMMISSION_DISTRIBUTION',
  'MANUAL_ADJUSTMENT'
);

CREATE TYPE journal_entry_status_enum AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'POSTED',
  'REVERSED'
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  entry_type journal_entry_type_enum NOT NULL,
  description TEXT NOT NULL,
  status journal_entry_status_enum NOT NULL DEFAULT 'DRAFT',
  total_debit BIGINT NOT NULL DEFAULT 0,
  total_credit BIGINT NOT NULL DEFAULT 0,
  source_transaction_id UUID,
  source_entity_type VARCHAR(50),
  source_entity_id UUID,
  rider_id UUID,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  reversed_by UUID,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  reversing_entry_id UUID REFERENCES journal_entries(id),
  original_entry_id UUID REFERENCES journal_entries(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_balanced CHECK (total_debit = total_credit)
);

CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  gl_account_id UUID NOT NULL REFERENCES gl_accounts(id),
  line_number INT NOT NULL,
  debit_amount BIGINT NOT NULL DEFAULT 0,
  credit_amount BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_one_side CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0)
  ),
  UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_source ON journal_entries(source_transaction_id);
CREATE INDEX idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(gl_account_id);
```

**Acceptance Criteria:**
- [ ] Tables created with all constraints
- [ ] Balance check constraint enforced
- [ ] Proper indexes created

### Task 2.2: Create Journal Entry Entities

**File:** `src/server/src/modules/accounting/entities/journal-entry.entity.ts`

```typescript
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
  Check,
} from 'typeorm';
import { JournalEntryLine } from './journal-entry-line.entity.js';

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

export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

@Entity('journal_entries')
@Index(['entryDate'])
@Index(['entryType'])
@Index(['status'])
@Check('"total_debit" = "total_credit"')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entry_number', type: 'varchar', length: 50, unique: true })
  entryNumber!: string;

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

  @Column({ name: 'total_debit', type: 'bigint', default: 0 })
  totalDebit!: number;

  @Column({ name: 'total_credit', type: 'bigint', default: 0 })
  totalCredit!: number;

  @Column({ name: 'source_transaction_id', type: 'uuid', nullable: true })
  sourceTransactionId?: string;

  @Column({ name: 'source_entity_type', type: 'varchar', length: 50, nullable: true })
  sourceEntityType?: string;

  @Column({ name: 'source_entity_id', type: 'uuid', nullable: true })
  sourceEntityId?: string;

  @Column({ name: 'rider_id', type: 'uuid', nullable: true })
  riderId?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt?: Date;

  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy?: string;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt?: Date;

  @Column({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason?: string;

  @Column({ name: 'reversing_entry_id', type: 'uuid', nullable: true })
  reversingEntryId?: string;

  @Column({ name: 'original_entry_id', type: 'uuid', nullable: true })
  originalEntryId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => JournalEntryLine, (line) => line.journalEntry, { cascade: true })
  lines!: JournalEntryLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Check if entry is balanced
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
}
```

**File:** `src/server/src/modules/accounting/entities/journal-entry-line.entity.ts`

```typescript
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

  @Column({ name: 'line_number', type: 'int' })
  lineNumber!: number;

  @Column({ name: 'debit_amount', type: 'bigint', default: 0 })
  debitAmount!: number;

  @Column({ name: 'credit_amount', type: 'bigint', default: 0 })
  creditAmount!: number;

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
   * Get amount (regardless of debit/credit)
   */
  getAmount(): number {
    return this.isDebit() ? Number(this.debitAmount) : Number(this.creditAmount);
  }
}
```

**Acceptance Criteria:**
- [ ] Entities compile without errors
- [ ] Relationships properly defined
- [ ] Constraints enforced at ORM level

### Task 2.3: Create Journal Entry Service

**File:** `src/server/src/modules/accounting/services/journal-entry.service.ts`

```typescript
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JournalEntry, JournalEntryType, JournalEntryStatus } from '../entities/journal-entry.entity.js';
import { JournalEntryLine } from '../entities/journal-entry-line.entity.js';
import { GlAccountService } from './gl-account.service.js';

export interface JournalEntryLineInput {
  accountCode: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  entryType: JournalEntryType;
  entryDate: Date;
  description: string;
  lines: JournalEntryLineInput[];
  sourceTransactionId?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  riderId?: string;
  createdBy?: string;
  autoPost?: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
    private readonly glAccountService: GlAccountService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create and optionally post a journal entry
   */
  async create(input: CreateJournalEntryInput): Promise<JournalEntry> {
    // Validate debits = credits
    const totalDebit = input.lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredit = input.lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Journal entry not balanced: debits=${totalDebit} credits=${totalCredit}`,
      );
    }

    if (totalDebit === 0) {
      throw new BadRequestException('Journal entry must have non-zero amounts');
    }

    return this.dataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(JournalEntry);
      const lineRepo = manager.getRepository(JournalEntryLine);

      // Generate entry number
      const entryNumber = await this.generateEntryNumber(input.entryDate);

      // Create entry
      const entry = entryRepo.create({
        entryNumber,
        entryDate: input.entryDate,
        entryType: input.entryType,
        description: input.description,
        status: JournalEntryStatus.DRAFT,
        totalDebit,
        totalCredit,
        sourceTransactionId: input.sourceTransactionId,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        riderId: input.riderId,
        createdBy: input.createdBy,
        metadata: input.metadata,
      });

      const savedEntry = await entryRepo.save(entry);

      // Create lines
      for (let i = 0; i < input.lines.length; i++) {
        const lineInput = input.lines[i];
        const account = await this.glAccountService.getByCode(lineInput.accountCode);

        const line = lineRepo.create({
          journalEntryId: savedEntry.id,
          glAccountId: account.id,
          lineNumber: i + 1,
          debitAmount: lineInput.debitAmount || 0,
          creditAmount: lineInput.creditAmount || 0,
          description: lineInput.description,
        });

        await lineRepo.save(line);
      }

      this.logger.log(`Created journal entry ${entryNumber} (${input.entryType})`);

      // Auto-post if requested
      if (input.autoPost) {
        return this.postEntry(savedEntry.id, manager);
      }

      return savedEntry;
    });
  }

  /**
   * Post a journal entry (update GL balances)
   */
  async postEntry(entryId: string, manager?: any): Promise<JournalEntry> {
    const txManager = manager || this.dataSource;

    return txManager.transaction(async (mgr: any) => {
      const entryRepo = mgr.getRepository(JournalEntry);
      const lineRepo = mgr.getRepository(JournalEntryLine);

      const entry = await entryRepo.findOne({
        where: { id: entryId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!entry) {
        throw new NotFoundException('Journal entry not found');
      }

      if (entry.status === JournalEntryStatus.POSTED) {
        throw new BadRequestException('Entry already posted');
      }

      if (entry.status === JournalEntryStatus.REVERSED) {
        throw new BadRequestException('Cannot post reversed entry');
      }

      // Get lines
      const lines = await lineRepo.find({
        where: { journalEntryId: entryId },
      });

      // Update GL account balances
      for (const line of lines) {
        await this.glAccountService.updateBalance(
          line.glAccountId,
          Number(line.debitAmount),
          Number(line.creditAmount),
        );
      }

      // Mark as posted
      entry.status = JournalEntryStatus.POSTED;
      entry.postedAt = new Date();

      await entryRepo.save(entry);

      this.logger.log(`Posted journal entry ${entry.entryNumber}`);

      return entry;
    });
  }

  /**
   * Reverse a posted journal entry
   */
  async reverseEntry(
    entryId: string,
    reason: string,
    reversedBy: string,
  ): Promise<JournalEntry> {
    return this.dataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(JournalEntry);
      const lineRepo = manager.getRepository(JournalEntryLine);

      const original = await entryRepo.findOne({
        where: { id: entryId },
        relations: ['lines'],
      });

      if (!original) {
        throw new NotFoundException('Journal entry not found');
      }

      if (original.status !== JournalEntryStatus.POSTED) {
        throw new BadRequestException('Can only reverse posted entries');
      }

      // Create reversing entry
      const reversingNumber = await this.generateEntryNumber(new Date());
      const reversing = entryRepo.create({
        entryNumber: reversingNumber,
        entryDate: new Date(),
        entryType: original.entryType,
        description: `REVERSAL: ${original.description}`,
        status: JournalEntryStatus.DRAFT,
        totalDebit: original.totalCredit, // Swap
        totalCredit: original.totalDebit,
        originalEntryId: original.id,
        createdBy: reversedBy,
        metadata: { reversalReason: reason },
      });

      const savedReversing = await entryRepo.save(reversing);

      // Create reversed lines (swap debits/credits)
      const lines = await lineRepo.find({ where: { journalEntryId: original.id } });
      for (const line of lines) {
        await lineRepo.save({
          journalEntryId: savedReversing.id,
          glAccountId: line.glAccountId,
          lineNumber: line.lineNumber,
          debitAmount: line.creditAmount, // Swap
          creditAmount: line.debitAmount,
          description: `REVERSAL: ${line.description || ''}`,
        });
      }

      // Post the reversal
      await this.postEntry(savedReversing.id, manager);

      // Mark original as reversed
      original.status = JournalEntryStatus.REVERSED;
      original.reversedBy = reversedBy;
      original.reversedAt = new Date();
      original.reversalReason = reason;
      original.reversingEntryId = savedReversing.id;

      await entryRepo.save(original);

      this.logger.log(`Reversed journal entry ${original.entryNumber} → ${reversingNumber}`);

      return savedReversing;
    });
  }

  /**
   * Generate unique entry number
   */
  private async generateEntryNumber(date: Date): Promise<string> {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.journalEntryRepository.count({
      where: { entryDate: date },
    });
    return `JE-${dateStr}-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Get entries by date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    return this.journalEntryRepository
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .where('je.entry_date >= :startDate', { startDate })
      .andWhere('je.entry_date <= :endDate', { endDate })
      .orderBy('je.entry_date', 'ASC')
      .addOrderBy('je.entry_number', 'ASC')
      .getMany();
  }
}
```

**Acceptance Criteria:**
- [ ] Journal entries always balanced
- [ ] GL balances updated on posting
- [ ] Reversal creates offsetting entry
- [ ] Entry numbers unique and sequential

---

## 4. Epic 3: Posting Engine

**Priority:** P0 - Critical
**Dependencies:** Epic 2
**Estimated Effort:** 1.5 weeks

### Task 3.1: Create Posting Rules Configuration

**File:** `src/server/src/modules/accounting/config/posting-rules.config.ts`

```typescript
import { JournalEntryType } from '../entities/journal-entry.entity.js';

/**
 * Account codes from Chart of Accounts
 */
export const GL_ACCOUNTS = {
  // Assets
  CASH_UBA_ESCROW: '1001',
  CASH_PLATFORM_OPERATING: '1002',
  RECEIVABLE_DEFINITE_COMMISSION: '1101',

  // Liabilities
  PREMIUM_PAYABLE_DEFINITE: '2001',
  SERVICE_FEE_PAYABLE_KBA: '2002',
  SERVICE_FEE_PAYABLE_ROBS: '2003',
  COMMISSION_PAYABLE_KBA: '2004',
  COMMISSION_PAYABLE_ROBS: '2005',
  REFUND_PAYABLE_RIDERS: '2101',

  // Income
  SERVICE_FEE_INCOME_PLATFORM: '4001',
  COMMISSION_INCOME_OM: '4002',
  COMMISSION_INCOME_PROFIT: '4003',
  REVERSAL_FEE_INCOME: '4004',

  // Expenses
  PLATFORM_MAINTENANCE: '5001',
  TRANSACTION_COSTS: '5002',
} as const;

/**
 * Payment amounts from business model
 */
export const PAYMENT_AMOUNTS = {
  // Day 1 deposit breakdown (in cents)
  DAY1_TOTAL: 104800,      // KES 1,048.00
  DAY1_PREMIUM: 104500,    // KES 1,045.00
  DAY1_SERVICE_FEE: 300,   // KES 3.00 (KES 1 each)

  // Daily payment breakdown (in cents)
  DAILY_TOTAL: 8700,       // KES 87.00
  DAILY_PREMIUM: 8400,     // KES 84.00
  DAILY_SERVICE_FEE: 300,  // KES 3.00 (KES 1 each)

  // Service fee distribution (in cents)
  SERVICE_FEE_PLATFORM: 100, // KES 1.00
  SERVICE_FEE_KBA: 100,      // KES 1.00
  SERVICE_FEE_ROBS: 100,     // KES 1.00

  // Refund percentages
  REFUND_RIDER_PERCENT: 90,
  REFUND_REVERSAL_FEE_PERCENT: 10,
  REVERSAL_FEE_PLATFORM_PERCENT: 70,
  REVERSAL_FEE_KBA_PERCENT: 15,
  REVERSAL_FEE_ROBS_PERCENT: 15,
} as const;

/**
 * Posting rule for Day 1 payment receipt
 */
export function getDay1PaymentPostingLines(amountCents: number) {
  // Validate amount
  if (amountCents !== PAYMENT_AMOUNTS.DAY1_TOTAL) {
    throw new Error(`Invalid Day 1 amount: expected ${PAYMENT_AMOUNTS.DAY1_TOTAL}, got ${amountCents}`);
  }

  return [
    // Debit: Cash received
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      debitAmount: PAYMENT_AMOUNTS.DAY1_TOTAL,
      description: 'Day 1 payment received',
    },
    // Credit: Premium liability to Definite
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      creditAmount: PAYMENT_AMOUNTS.DAY1_PREMIUM,
      description: 'Premium payable to Definite',
    },
    // Credit: Service fee payable to KBA
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA,
      creditAmount: PAYMENT_AMOUNTS.SERVICE_FEE_KBA,
      description: 'Service fee payable to KBA',
    },
    // Credit: Service fee payable to Robs
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS,
      creditAmount: PAYMENT_AMOUNTS.SERVICE_FEE_ROBS,
      description: 'Service fee payable to Robs',
    },
    // Credit: Service fee income to Platform
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_INCOME_PLATFORM,
      creditAmount: PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM,
      description: 'Service fee income - Platform',
    },
  ];
}

/**
 * Posting rule for Days 2-31 payment receipt
 */
export function getDailyPaymentPostingLines(amountCents: number, daysCount: number = 1) {
  const expectedAmount = PAYMENT_AMOUNTS.DAILY_TOTAL * daysCount;
  if (amountCents !== expectedAmount) {
    throw new Error(`Invalid daily amount: expected ${expectedAmount}, got ${amountCents}`);
  }

  const premiumAmount = PAYMENT_AMOUNTS.DAILY_PREMIUM * daysCount;
  const serviceFeeEach = PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM * daysCount;

  return [
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      debitAmount: amountCents,
      description: `Daily payment received (${daysCount} day${daysCount > 1 ? 's' : ''})`,
    },
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      creditAmount: premiumAmount,
      description: 'Premium payable to Definite',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA,
      creditAmount: serviceFeeEach,
      description: 'Service fee payable to KBA',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS,
      creditAmount: serviceFeeEach,
      description: 'Service fee payable to Robs',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_INCOME_PLATFORM,
      creditAmount: serviceFeeEach,
      description: 'Service fee income - Platform',
    },
  ];
}

/**
 * Posting rule for Day 1 premium remittance
 */
export function getDay1RemittancePostingLines(premiumAmountCents: number) {
  return [
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      debitAmount: premiumAmountCents,
      description: 'Day 1 premium remitted to Definite',
    },
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      creditAmount: premiumAmountCents,
      description: 'Cash paid to Definite',
    },
  ];
}

/**
 * Posting rule for refund
 */
export function getRefundPostingLines(
  accumulatedPremiumCents: number,
  refundAmountCents: number,
  reversalFeeCents: number,
) {
  const platformShare = Math.round(reversalFeeCents * PAYMENT_AMOUNTS.REVERSAL_FEE_PLATFORM_PERCENT / 100);
  const kbaShare = Math.round(reversalFeeCents * PAYMENT_AMOUNTS.REVERSAL_FEE_KBA_PERCENT / 100);
  const robsShare = reversalFeeCents - platformShare - kbaShare; // Remainder to avoid rounding issues

  return [
    // Debit: Remove premium liability
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      debitAmount: accumulatedPremiumCents,
      description: 'Accumulated premium reversed',
    },
    // Credit: Refund payable to rider
    {
      accountCode: GL_ACCOUNTS.REFUND_PAYABLE_RIDERS,
      creditAmount: refundAmountCents,
      description: 'Refund payable to rider (90%)',
    },
    // Credit: Reversal fee income to Platform
    {
      accountCode: GL_ACCOUNTS.REVERSAL_FEE_INCOME,
      creditAmount: platformShare,
      description: 'Reversal fee income - Platform (70%)',
    },
    // Credit: Commission payable to KBA
    {
      accountCode: GL_ACCOUNTS.COMMISSION_PAYABLE_KBA,
      creditAmount: kbaShare,
      description: 'Reversal fee - KBA (15%)',
    },
    // Credit: Commission payable to Robs
    {
      accountCode: GL_ACCOUNTS.COMMISSION_PAYABLE_ROBS,
      creditAmount: robsShare,
      description: 'Reversal fee - Robs (15%)',
    },
  ];
}
```

**Acceptance Criteria:**
- [ ] All amounts match Boda Ledger specification
- [ ] Posting rules produce balanced entries
- [ ] Functions handle multi-day payments

### Task 3.2: Create Posting Engine Service

**File:** `src/server/src/modules/accounting/services/posting-engine.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { JournalEntryService, CreateJournalEntryInput } from './journal-entry.service.js';
import { JournalEntryType } from '../entities/journal-entry.entity.js';
import {
  getDay1PaymentPostingLines,
  getDailyPaymentPostingLines,
  getDay1RemittancePostingLines,
  getRefundPostingLines,
  PAYMENT_AMOUNTS,
} from '../config/posting-rules.config.js';

@Injectable()
export class PostingEngineService {
  private readonly logger = new Logger(PostingEngineService.name);

  constructor(private readonly journalEntryService: JournalEntryService) {}

  /**
   * Post Day 1 deposit payment
   */
  async postDay1Payment(params: {
    transactionId: string;
    riderId: string;
    amountCents: number;
    paymentDate: Date;
  }): Promise<string> {
    const lines = getDay1PaymentPostingLines(params.amountCents);

    const input: CreateJournalEntryInput = {
      entryType: JournalEntryType.PAYMENT_RECEIPT_DAY1,
      entryDate: params.paymentDate,
      description: `Day 1 deposit payment received - Rider ${params.riderId.slice(0, 8)}`,
      lines,
      sourceTransactionId: params.transactionId,
      sourceEntityType: 'transaction',
      sourceEntityId: params.transactionId,
      riderId: params.riderId,
      autoPost: true,
    };

    const entry = await this.journalEntryService.create(input);
    this.logger.log(`Posted Day 1 payment JE: ${entry.entryNumber}`);
    return entry.id;
  }

  /**
   * Post Days 2-31 daily payment
   */
  async postDailyPayment(params: {
    transactionId: string;
    riderId: string;
    amountCents: number;
    daysCount: number;
    paymentDay: number;
    paymentDate: Date;
  }): Promise<string> {
    const lines = getDailyPaymentPostingLines(params.amountCents, params.daysCount);

    const input: CreateJournalEntryInput = {
      entryType: JournalEntryType.PAYMENT_RECEIPT_DAILY,
      entryDate: params.paymentDate,
      description: `Daily payment #${params.paymentDay} received - Rider ${params.riderId.slice(0, 8)}`,
      lines,
      sourceTransactionId: params.transactionId,
      riderId: params.riderId,
      autoPost: true,
      metadata: {
        paymentDay: params.paymentDay,
        daysCount: params.daysCount,
      },
    };

    const entry = await this.journalEntryService.create(input);
    this.logger.log(`Posted daily payment JE: ${entry.entryNumber}`);
    return entry.id;
  }

  /**
   * Post Day 1 premium remittance to Definite
   */
  async postDay1Remittance(params: {
    riderId: string;
    premiumAmountCents: number;
    remittanceDate: Date;
    bankReference?: string;
  }): Promise<string> {
    const lines = getDay1RemittancePostingLines(params.premiumAmountCents);

    const input: CreateJournalEntryInput = {
      entryType: JournalEntryType.PREMIUM_REMITTANCE_DAY1,
      entryDate: params.remittanceDate,
      description: `Day 1 premium remitted to Definite - Rider ${params.riderId.slice(0, 8)}`,
      lines,
      riderId: params.riderId,
      autoPost: true,
      metadata: { bankReference: params.bankReference },
    };

    const entry = await this.journalEntryService.create(input);
    this.logger.log(`Posted Day 1 remittance JE: ${entry.entryNumber}`);
    return entry.id;
  }

  /**
   * Post refund initiation
   */
  async postRefundInitiation(params: {
    transactionId: string;
    riderId: string;
    accumulatedPremiumCents: number;
    refundDay: number;
    refundDate: Date;
  }): Promise<string> {
    const refundAmountCents = Math.round(
      params.accumulatedPremiumCents * PAYMENT_AMOUNTS.REFUND_RIDER_PERCENT / 100
    );
    const reversalFeeCents = params.accumulatedPremiumCents - refundAmountCents;

    const lines = getRefundPostingLines(
      params.accumulatedPremiumCents,
      refundAmountCents,
      reversalFeeCents,
    );

    const input: CreateJournalEntryInput = {
      entryType: JournalEntryType.REFUND_INITIATION,
      entryDate: params.refundDate,
      description: `Refund initiated on Day ${params.refundDay} - Rider ${params.riderId.slice(0, 8)}`,
      lines,
      sourceTransactionId: params.transactionId,
      riderId: params.riderId,
      autoPost: true,
      metadata: {
        refundDay: params.refundDay,
        accumulatedPremium: params.accumulatedPremiumCents,
        refundAmount: refundAmountCents,
        reversalFee: reversalFeeCents,
      },
    };

    const entry = await this.journalEntryService.create(input);
    this.logger.log(`Posted refund JE: ${entry.entryNumber}`);
    return entry.id;
  }
}
```

**Acceptance Criteria:**
- [ ] All posting methods create balanced entries
- [ ] Entries are auto-posted to GL
- [ ] Proper audit trail in metadata

---

## 5. Epic 4: Payment Service Refactoring

**Priority:** P0 - Critical
**Dependencies:** Epic 3
**Estimated Effort:** 2 weeks

### Task 4.1: Refactor Payment Callback Handler

**File:** `src/server/src/modules/payment/services/payment.service.ts` (modifications)

Add integration with PostingEngineService:

```typescript
// Add import
import { PostingEngineService } from '../../accounting/services/posting-engine.service.js';

// Add to constructor
constructor(
  // ... existing dependencies
  private readonly postingEngine: PostingEngineService,
) {}

// Modify processSuccessfulPayment method
private async processSuccessfulPayment(
  paymentRequest: PaymentRequest,
  callbackData: MpesaCallbackData,
): Promise<PaymentResult> {
  return this.dataSource.transaction(async (manager) => {
    // ... existing transaction creation code ...

    // NEW: Create journal entry for payment
    let journalEntryId: string;

    if (paymentRequest.paymentType === TransactionType.DEPOSIT) {
      journalEntryId = await this.postingEngine.postDay1Payment({
        transactionId: transaction.id,
        riderId: paymentRequest.userId,
        amountCents: Number(paymentRequest.amount),
        paymentDate: new Date(),
      });

      // Queue Day 1 remittance (same-day to Definite)
      await this.queueDay1Remittance(paymentRequest.userId, PAYMENT_AMOUNTS.DAY1_PREMIUM);

    } else if (paymentRequest.paymentType === TransactionType.DAILY_PAYMENT) {
      journalEntryId = await this.postingEngine.postDailyPayment({
        transactionId: transaction.id,
        riderId: paymentRequest.userId,
        amountCents: Number(paymentRequest.amount),
        daysCount: paymentRequest.daysCount,
        paymentDay: wallet.dailyPaymentsCount,
        paymentDate: new Date(),
      });
    }

    // Store journal entry reference
    transaction.metadata = {
      ...transaction.metadata,
      journalEntryId,
    };

    // ... rest of existing logic ...
  });
}
```

**Acceptance Criteria:**
- [ ] All payments create journal entries
- [ ] Day 1 queues immediate remittance
- [ ] Transaction links to journal entry

### Task 4.2: Add Premium/Fee Split Validation

Create validation to ensure amounts match expected breakdown:

```typescript
// Add to payment.service.ts

private validatePaymentAmount(
  paymentType: TransactionType,
  amountCents: number,
  daysCount: number = 1,
): void {
  if (paymentType === TransactionType.DEPOSIT) {
    if (amountCents !== PAYMENT_AMOUNTS.DAY1_TOTAL) {
      throw new BadRequestException(
        `Invalid deposit amount: expected ${PAYMENT_AMOUNTS.DAY1_TOTAL}, got ${amountCents}`,
      );
    }
  } else if (paymentType === TransactionType.DAILY_PAYMENT) {
    const expected = PAYMENT_AMOUNTS.DAILY_TOTAL * daysCount;
    if (amountCents !== expected) {
      throw new BadRequestException(
        `Invalid daily payment amount: expected ${expected}, got ${amountCents}`,
      );
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Invalid amounts rejected
- [ ] Multi-day payments validated correctly

---

## 6. Epic 5: Escrow Management

**Priority:** P1 - High
**Dependencies:** Epic 4
**Estimated Effort:** 2 weeks

### Task 5.1: Create Escrow Tracking Table

```sql
CREATE TYPE escrow_type_enum AS ENUM (
  'DAY_1_IMMEDIATE',
  'DAYS_2_31_ACCUMULATED'
);

CREATE TYPE remittance_status_enum AS ENUM (
  'PENDING',
  'SCHEDULED',
  'REMITTED',
  'REFUNDED'
);

CREATE TABLE escrow_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL,
  transaction_id UUID NOT NULL,
  payment_day INT NOT NULL,
  premium_amount BIGINT NOT NULL,
  service_fee_amount BIGINT NOT NULL,
  escrow_type escrow_type_enum NOT NULL,
  remittance_status remittance_status_enum NOT NULL DEFAULT 'PENDING',
  remittance_batch_id UUID,
  remitted_at TIMESTAMPTZ,
  bank_reference VARCHAR(100),
  journal_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escrow_rider ON escrow_tracking(rider_id);
CREATE INDEX idx_escrow_status ON escrow_tracking(remittance_status);
CREATE INDEX idx_escrow_batch ON escrow_tracking(remittance_batch_id);
```

### Task 5.2: Create Escrow Service

**File:** `src/server/src/modules/accounting/services/escrow.service.ts`

Implement escrow tracking with:
- Record creation on payment
- Day 1 immediate remittance scheduling
- Month-end bulk remittance scheduling
- Refund handling

**Acceptance Criteria:**
- [ ] Day 1 payments flagged for immediate remittance
- [ ] Days 2-31 accumulated until month-end
- [ ] Accurate escrow balance tracking

---

## 7. Epic 6: Partner Settlement System

**Priority:** P1 - High
**Dependencies:** Epic 5
**Estimated Effort:** 2 weeks

### Task 6.1: Create Settlement Tables

```sql
CREATE TYPE partner_type_enum AS ENUM (
  'DEFINITE_ASSURANCE',
  'KBA',
  'ROBS_INSURANCE',
  'ATRONACH'
);

CREATE TYPE settlement_type_enum AS ENUM (
  'SERVICE_FEE',
  'COMMISSION',
  'PREMIUM_REMITTANCE',
  'REVERSAL_FEE'
);

CREATE TYPE settlement_status_enum AS ENUM (
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE partner_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_type partner_type_enum NOT NULL,
  settlement_type settlement_type_enum NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount BIGINT NOT NULL,
  transaction_count INT NOT NULL DEFAULT 0,
  status settlement_status_enum NOT NULL DEFAULT 'PENDING',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  bank_reference VARCHAR(100),
  settled_at TIMESTAMPTZ,
  journal_entry_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settlement_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES partner_settlements(id),
  rider_id UUID NOT NULL,
  transaction_id UUID,
  amount BIGINT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Task 6.2: Create Settlement Service

Implement:
- Daily service fee settlement calculation
- Monthly commission settlement calculation
- Settlement approval workflow
- Bank payment integration

**Acceptance Criteria:**
- [ ] Daily fee settlements calculated correctly
- [ ] Monthly commission per Boda Ledger algorithm
- [ ] Maker-checker for settlement approval

---

## 8. Epic 7: Commission Calculator

**Priority:** P1 - High
**Dependencies:** Epic 6
**Estimated Effort:** 1.5 weeks

### Task 7.1: Implement Commission Algorithm

**File:** `src/server/src/modules/accounting/services/commission-calculator.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

export interface CommissionCalculationResult {
  totalPremiumToDefinite: number;
  purePremium: number;
  totalCommission: number;
  distribution: {
    platformOM: number;
    platformProfit: number;
    kba: number;
    robs: number;
  };
  fullTermRiders: number;
  partialRiders: number;
}

@Injectable()
export class CommissionCalculatorService {
  private readonly logger = new Logger(CommissionCalculatorService.name);

  // Constants from Boda Ledger
  private readonly PURE_PREMIUM_RATIO = 3500 / 3565;
  private readonly COMMISSION_RATE = 0.09;
  private readonly PLATFORM_OM_PER_RIDER = 10000; // KES 100 in cents
  private readonly JOINT_MOBILIZATION_PER_RIDER = 10000; // KES 100 total
  private readonly JOINT_PORTION_PER_RIDER = 400; // KES 4 total

  /**
   * Calculate commission for a settlement period
   */
  calculateMonthlyCommission(
    riderPremiums: Array<{
      riderId: string;
      totalPremium: number; // in cents
      isFullTerm: boolean;
      daysCompleted: number;
    }>,
  ): CommissionCalculationResult {
    // Step 1: Calculate total premium to Definite
    const totalPremiumToDefinite = riderPremiums.reduce(
      (sum, r) => sum + r.totalPremium,
      0,
    );

    // Step 2: Calculate pure premium
    const purePremium = Math.round(totalPremiumToDefinite * this.PURE_PREMIUM_RATIO);

    // Step 3: Calculate total commission (9% of pure premium)
    const totalCommission = Math.round(purePremium * this.COMMISSION_RATE);

    // Step 4: Count full-term riders
    const fullTermRiders = riderPremiums.filter((r) => r.isFullTerm).length;
    const partialRiders = riderPremiums.length - fullTermRiders;

    // Step 5: Calculate distribution
    const platformOM = this.PLATFORM_OM_PER_RIDER * fullTermRiders;
    const jointMobilization = this.JOINT_MOBILIZATION_PER_RIDER * fullTermRiders;
    const jointPortion = this.JOINT_PORTION_PER_RIDER * fullTermRiders;

    const kbaMobilization = jointMobilization / 2;
    const robsMobilization = jointMobilization / 2;
    const kbaJoint = jointPortion / 2;
    const robsJoint = jointPortion / 2;

    const remaining = totalCommission - platformOM - jointMobilization - jointPortion;
    const profitShareEach = Math.round(remaining / 3);

    const distribution = {
      platformOM,
      platformProfit: profitShareEach,
      kba: kbaMobilization + kbaJoint + profitShareEach,
      robs: robsMobilization + robsJoint + profitShareEach,
    };

    // Verify total matches
    const distributionTotal =
      distribution.platformOM +
      distribution.platformProfit +
      distribution.kba +
      distribution.robs;

    if (Math.abs(distributionTotal - totalCommission) > 3) {
      this.logger.warn(
        `Commission distribution mismatch: total=${totalCommission}, distributed=${distributionTotal}`,
      );
    }

    return {
      totalPremiumToDefinite,
      purePremium,
      totalCommission,
      distribution,
      fullTermRiders,
      partialRiders,
    };
  }
}
```

**Acceptance Criteria:**
- [ ] Algorithm matches Boda Ledger specification
- [ ] Handles partial riders correctly
- [ ] Distribution sums to total commission

---

## 9. Epic 8: Reconciliation System

**Priority:** P2 - Medium
**Dependencies:** Epic 7
**Estimated Effort:** 2 weeks

### Task 8.1: Create Reconciliation Tables

```sql
CREATE TYPE reconciliation_type_enum AS ENUM (
  'DAILY_MPESA',
  'MONTHLY_BANK',
  'PARTNER_SETTLEMENT'
);

CREATE TYPE reconciliation_status_enum AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'MATCHED',
  'UNMATCHED',
  'RESOLVED'
);

CREATE TABLE reconciliation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_type reconciliation_type_enum NOT NULL,
  reconciliation_date DATE NOT NULL,
  source_balance BIGINT NOT NULL,
  ledger_balance BIGINT NOT NULL,
  variance BIGINT NOT NULL,
  status reconciliation_status_enum NOT NULL DEFAULT 'PENDING',
  matched_count INT DEFAULT 0,
  unmatched_count INT DEFAULT 0,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id),
  source_reference VARCHAR(100),
  source_amount BIGINT,
  ledger_transaction_id UUID,
  ledger_amount BIGINT,
  status reconciliation_status_enum NOT NULL DEFAULT 'PENDING',
  variance BIGINT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Task 8.2: Create Reconciliation Service

Implement:
- M-Pesa statement import and parsing
- Transaction matching algorithm
- Variance reporting
- Manual resolution workflow

**Acceptance Criteria:**
- [ ] Daily M-Pesa reconciliation automated
- [ ] Unmatched items flagged for review
- [ ] Resolution audit trail maintained

---

## 10. Epic 9: Financial Reporting

**Priority:** P2 - Medium
**Dependencies:** Epic 8
**Estimated Effort:** 1.5 weeks

### Task 9.1: Implement Balance Sheet Report

Generate Balance Sheet from GL account balances.

### Task 9.2: Implement Income Statement Report

Generate P&L from income/expense account balances.

### Task 9.3: Implement Trial Balance Report

Already partially implemented in GlAccountService.

### Task 9.4: Implement Partner Statement Report

Generate detailed statement per partner with all transactions.

**Acceptance Criteria:**
- [ ] All reports derive from GL balances
- [ ] Reports balance (Assets = Liabilities + Equity)
- [ ] Export to PDF/Excel supported

---

## 11. Epic 10: Accounting UI

**Priority:** P2 - Medium
**Dependencies:** Epic 9
**Estimated Effort:** 2 weeks

### Task 10.1: Chart of Accounts Management

- View hierarchical account list
- Edit account details (admin only)

### Task 10.2: Journal Entry Viewer

- Search/filter entries
- View entry details with lines
- Manual entry creation (admin only)

### Task 10.3: Reconciliation Dashboard

- View reconciliation status
- Resolve unmatched items
- View variance trends

### Task 10.4: Financial Reports UI

- Generate Balance Sheet
- Generate Income Statement
- Generate Partner Statements

**Acceptance Criteria:**
- [ ] All screens role-protected
- [ ] Responsive design
- [ ] Export functionality

---

## 12. Data Model Changes

### 12.1 New Tables Summary

| Table | Purpose | Foreign Keys |
|-------|---------|--------------|
| `gl_accounts` | Chart of Accounts | Self-reference (parent) |
| `journal_entries` | Transaction journal | Source transaction |
| `journal_entry_lines` | Debit/credit lines | gl_accounts, journal_entries |
| `escrow_tracking` | Escrow fund tracking | riders, transactions |
| `partner_settlements` | Settlement records | journal_entries |
| `settlement_line_items` | Settlement details | partner_settlements |
| `reconciliation_records` | Reconciliation runs | - |
| `reconciliation_items` | Item-level reconciliation | reconciliation_records |

### 12.2 Modified Tables

| Table | Modification |
|-------|-------------|
| `transactions` | Add `journal_entry_id` column |
| `audit_events` | Add accounting event types |

### 12.3 Entity Relationship Changes

```
transactions ──────────────┬──► journal_entries
                           │
escrow_tracking ───────────┤
                           │
partner_settlements ───────┘

journal_entries ◄────────── journal_entry_lines ──────────► gl_accounts
```

---

## 13. Migration Strategy

### 13.1 Pre-Migration Checklist

- [ ] Backup production database
- [ ] Document current wallet balances
- [ ] Export all transaction history
- [ ] Freeze new payments during migration (optional)

### 13.2 Migration Steps

1. **Deploy GL infrastructure** (Epic 1-2)
   - Create new tables
   - Seed Chart of Accounts
   - Deploy services (disabled)

2. **Parallel operation period**
   - Enable GL posting for new transactions
   - Monitor for issues
   - Verify balances

3. **Historical data migration**
   - Create opening balance journal entry
   - Do NOT attempt to recreate historical JEs
   - Document cutover date

4. **Full cutover**
   - Enable all accounting features
   - Deprecate old balance fields (keep for reference)
   - Enable financial reporting

### 13.3 Rollback Plan

If critical issues:
1. Disable posting engine
2. Revert to wallet-only operation
3. Investigate and fix
4. Re-enable with corrections

### 13.4 Data Validation

After migration:
- [ ] GL balance equals sum of JE postings
- [ ] Trial balance is balanced
- [ ] Partner payables match calculations
- [ ] Cash balance matches bank statement

---

## 14. Testing Strategy

### 14.1 Unit Tests

- [ ] GlAccountService balance calculations
- [ ] JournalEntryService balance validation
- [ ] PostingEngine rule application
- [ ] CommissionCalculator algorithm

### 14.2 Integration Tests

- [ ] Payment → JournalEntry → GL flow
- [ ] Refund posting and reversal
- [ ] Settlement calculation and posting

### 14.3 End-to-End Tests

- [ ] Full rider journey (Day 1 → Day 31)
- [ ] Refund on various days
- [ ] Month-end settlement generation
- [ ] Financial report generation

### 14.4 Performance Tests

- [ ] 10,000 concurrent payment postings
- [ ] Trial balance with 1M+ entries
- [ ] Monthly settlement for 100K riders

---

## 15. Rollout Plan

### 15.1 Phase 1: GL Infrastructure (Weeks 1-4)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Epic 1 Tasks 1.1-1.3 | GL tables, entity, service |
| 2 | Epic 1 Tasks 1.4-1.5, Epic 2 Tasks 2.1-2.2 | Chart of Accounts seeded, JE tables |
| 3 | Epic 2 Task 2.3 | JournalEntryService complete |
| 4 | Epic 3 Tasks 3.1-3.2 | Posting engine operational |

**Phase 1 Exit Criteria:**
- [ ] GL accounts created and seeded
- [ ] Journal entries can be created and posted
- [ ] Trial balance report working

### 15.2 Phase 2: Payment Integration (Weeks 5-8)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 5 | Epic 4 Tasks 4.1-4.2 | Payment callback refactored |
| 6 | Epic 5 Tasks 5.1-5.2 | Escrow tracking operational |
| 7 | Epic 6 Tasks 6.1-6.2 | Partner settlement system |
| 8 | Integration testing | All flows validated |

**Phase 2 Exit Criteria:**
- [ ] All payments create journal entries
- [ ] Escrow properly tracked
- [ ] Settlements calculable

### 15.3 Phase 3: Settlement & Reconciliation (Weeks 9-12)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 9 | Epic 7 Tasks 7.1 | Commission calculator |
| 10 | Epic 8 Tasks 8.1-8.2 | Reconciliation system |
| 11 | UAT and bug fixes | Stable system |
| 12 | Production deployment | Live GL system |

**Phase 3 Exit Criteria:**
- [ ] Commission calculations verified
- [ ] Reconciliation process documented
- [ ] Production deployment successful

### 15.4 Phase 4: Reporting & UI (Weeks 13-16)

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 13 | Epic 9 Tasks 9.1-9.4 | Financial reports |
| 14 | Epic 10 Tasks 10.1-10.2 | CoA and JE UI |
| 15 | Epic 10 Tasks 10.3-10.4 | Reconciliation and reports UI |
| 16 | Final UAT and training | Complete system |

**Phase 4 Exit Criteria:**
- [ ] All financial reports producible
- [ ] UI fully functional
- [ ] Staff trained on new features

---

## Appendix A: API Endpoints

### GL Account Endpoints

```
GET    /api/v1/accounting/gl-accounts
GET    /api/v1/accounting/gl-accounts/:id
POST   /api/v1/accounting/gl-accounts (admin only)
PUT    /api/v1/accounting/gl-accounts/:id (admin only)
GET    /api/v1/accounting/trial-balance
```

### Journal Entry Endpoints

```
GET    /api/v1/accounting/journal-entries
GET    /api/v1/accounting/journal-entries/:id
POST   /api/v1/accounting/journal-entries (admin only)
POST   /api/v1/accounting/journal-entries/:id/post (admin only)
POST   /api/v1/accounting/journal-entries/:id/reverse (admin only)
```

### Settlement Endpoints

```
GET    /api/v1/accounting/settlements
GET    /api/v1/accounting/settlements/:id
POST   /api/v1/accounting/settlements/:id/approve (admin only)
POST   /api/v1/accounting/settlements/:id/execute (admin only)
```

### Report Endpoints

```
GET    /api/v1/accounting/reports/balance-sheet
GET    /api/v1/accounting/reports/income-statement
GET    /api/v1/accounting/reports/partner-statement/:partnerId
```

---

## Appendix B: Permissions Matrix

| Role | CoA View | CoA Edit | JE View | JE Create | Settlement View | Settlement Approve |
|------|----------|----------|---------|-----------|-----------------|-------------------|
| rider | - | - | - | - | - | - |
| sacco_admin | View | - | View | - | View | - |
| kba_admin | View | - | View | - | View | - |
| insurance_admin | View | - | View | - | View | - |
| platform_admin | View | Edit | View | Create | View | Approve |

---

*This remediation plan provides a comprehensive roadmap for implementing the accounting infrastructure required for BodaInsure. Adherence to this plan will ensure regulatory compliance, financial accuracy, and operational transparency.*
