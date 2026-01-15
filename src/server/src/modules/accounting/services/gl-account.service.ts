import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  GlAccount,
  GlAccountType,
  GlAccountStatus,
  NormalBalance,
} from '../entities/gl-account.entity.js';

/**
 * GL Account Service
 * Manages the Chart of Accounts and GL balance operations
 *
 * Per Accounting_Remediation.md - Epic 1
 */
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
   * Get account by ID
   */
  async getById(id: string): Promise<GlAccount> {
    const account = await this.glAccountRepository.findOne({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException(`GL Account not found`);
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
   * Get all active accounts (flat list)
   */
  async getAllActive(): Promise<GlAccount[]> {
    return this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
      order: { accountCode: 'ASC' },
    });
  }

  /**
   * Update account balance (internal use only)
   * Called by JournalEntryService after posting
   *
   * Uses pessimistic locking to ensure data integrity
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
        // Assets & Expenses: debits increase, credits decrease
        balanceChange = debitAmount - creditAmount;
      } else {
        // Liabilities, Equity & Income: credits increase, debits decrease
        balanceChange = creditAmount - debitAmount;
      }

      account.balance = Number(account.balance) + balanceChange;
      await repo.save(account);

      this.logger.debug(
        `Account ${account.accountCode} balance updated: ${balanceChange > 0 ? '+' : ''}${balanceChange / 100} KES (new balance: ${account.getBalanceInKes()} KES)`,
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
      throw new ConflictException(
        `Account code ${data.accountCode} already exists`,
      );
    }

    // Determine normal balance based on account type
    const normalBalance = [GlAccountType.ASSET, GlAccountType.EXPENSE].includes(
      data.accountType,
    )
      ? NormalBalance.DEBIT
      : NormalBalance.CREDIT;

    const account = this.glAccountRepository.create({
      ...data,
      normalBalance,
      status: GlAccountStatus.ACTIVE,
      balance: 0,
    });

    const saved = await this.glAccountRepository.save(account);
    this.logger.log(`Created GL account: ${data.accountCode} - ${data.accountName}`);
    return saved;
  }

  /**
   * Get trial balance
   * Returns all accounts with their debit/credit balances
   */
  async getTrialBalance(): Promise<{
    accounts: Array<{
      accountCode: string;
      accountName: string;
      accountType: GlAccountType;
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

    const result = accounts.map((account) => {
      const balance = Number(account.balance);
      return {
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        debitBalance: account.normalBalance === NormalBalance.DEBIT ? balance : 0,
        creditBalance: account.normalBalance === NormalBalance.CREDIT ? balance : 0,
      };
    });

    const totalDebits = result.reduce((sum, a) => sum + a.debitBalance, 0);
    const totalCredits = result.reduce((sum, a) => sum + a.creditBalance, 0);

    return {
      accounts: result,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
    };
  }

  /**
   * Get account balance summary by type
   */
  async getBalanceSummary(): Promise<{
    assets: number;
    liabilities: number;
    equity: number;
    income: number;
    expenses: number;
  }> {
    const accounts = await this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
    });

    const summary = {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
    };

    for (const account of accounts) {
      const balance = Number(account.balance);
      switch (account.accountType) {
        case GlAccountType.ASSET:
          summary.assets += balance;
          break;
        case GlAccountType.LIABILITY:
          summary.liabilities += balance;
          break;
        case GlAccountType.EQUITY:
          summary.equity += balance;
          break;
        case GlAccountType.INCOME:
          summary.income += balance;
          break;
        case GlAccountType.EXPENSE:
          summary.expenses += balance;
          break;
      }
    }

    return summary;
  }
}
