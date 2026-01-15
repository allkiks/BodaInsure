import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { GlAccount, GlAccountType, GlAccountStatus, NormalBalance } from '../entities/gl-account.entity.js';
import { JournalEntry, JournalEntryStatus } from '../entities/journal-entry.entity.js';
import { JournalEntryLine } from '../entities/journal-entry-line.entity.js';
import { PartnerSettlement, PartnerType, SettlementStatus } from '../entities/partner-settlement.entity.js';

/**
 * Balance Sheet Report
 */
export interface BalanceSheetReport {
  asOf: Date;
  assets: {
    accounts: AccountBalance[];
    total: number;
  };
  liabilities: {
    accounts: AccountBalance[];
    total: number;
  };
  equity: {
    accounts: AccountBalance[];
    retainedEarnings: number;
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

/**
 * Income Statement Report
 */
export interface IncomeStatementReport {
  periodStart: Date;
  periodEnd: Date;
  income: {
    accounts: AccountBalance[];
    total: number;
  };
  expenses: {
    accounts: AccountBalance[];
    total: number;
  };
  netIncome: number;
}

/**
 * Trial Balance Report
 */
export interface TrialBalanceReport {
  asOf: Date;
  accounts: TrialBalanceAccount[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

/**
 * Partner Statement Report
 */
export interface PartnerStatementReport {
  partnerType: PartnerType;
  partnerName: string;
  periodStart: Date;
  periodEnd: Date;
  openingBalance: number;
  transactions: PartnerTransaction[];
  closingBalance: number;
  summary: {
    totalDebits: number;
    totalCredits: number;
    settledAmount: number;
    pendingAmount: number;
  };
}

/**
 * Account balance for reports
 */
export interface AccountBalance {
  accountCode: string;
  accountName: string;
  balance: number;
  balanceKes: number;
}

/**
 * Trial balance account entry
 */
export interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: GlAccountType;
  debitBalance: number;
  creditBalance: number;
}

/**
 * Partner transaction entry
 */
export interface PartnerTransaction {
  date: Date;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

/**
 * Financial Reporting Service
 *
 * Generates financial reports from GL data.
 *
 * Per Accounting_Remediation.md - Epic 9
 *
 * Reports:
 * - Balance Sheet
 * - Income Statement
 * - Trial Balance
 * - Partner Statements
 */
@Injectable()
export class FinancialReportingService {
  private readonly logger = new Logger(FinancialReportingService.name);

  constructor(
    @InjectRepository(GlAccount)
    private readonly glAccountRepository: Repository<GlAccount>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
    @InjectRepository(PartnerSettlement)
    private readonly settlementRepository: Repository<PartnerSettlement>,
  ) {}

  /**
   * Generate Balance Sheet as of a specific date
   */
  async generateBalanceSheet(asOf: Date): Promise<BalanceSheetReport> {
    const accounts = await this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
      order: { accountCode: 'ASC' },
    });

    // Group accounts by type
    const assets: AccountBalance[] = [];
    const liabilities: AccountBalance[] = [];
    const equity: AccountBalance[] = [];
    const income: AccountBalance[] = [];
    const expenses: AccountBalance[] = [];

    for (const account of accounts) {
      const entry: AccountBalance = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance: Number(account.balance),
        balanceKes: account.getBalanceInKes(),
      };

      switch (account.accountType) {
        case GlAccountType.ASSET:
          assets.push(entry);
          break;
        case GlAccountType.LIABILITY:
          liabilities.push(entry);
          break;
        case GlAccountType.EQUITY:
          equity.push(entry);
          break;
        case GlAccountType.INCOME:
          income.push(entry);
          break;
        case GlAccountType.EXPENSE:
          expenses.push(entry);
          break;
      }
    }

    // Calculate totals
    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquityAccounts = equity.reduce((sum, a) => sum + a.balance, 0);

    // Calculate retained earnings (Income - Expenses)
    const totalIncome = income.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
    const retainedEarnings = totalIncome - totalExpenses;

    const totalEquity = totalEquityAccounts + retainedEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    this.logger.log(
      `Generated Balance Sheet as of ${asOf.toISOString().slice(0, 10)}: ` +
      `Assets=${totalAssets / 100} KES, L+E=${totalLiabilitiesAndEquity / 100} KES`,
    );

    return {
      asOf,
      assets: { accounts: assets, total: totalAssets },
      liabilities: { accounts: liabilities, total: totalLiabilities },
      equity: {
        accounts: equity,
        retainedEarnings,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity,
      isBalanced: totalAssets === totalLiabilitiesAndEquity,
    };
  }

  /**
   * Generate Income Statement for a period
   */
  async generateIncomeStatement(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<IncomeStatementReport> {
    // Get income and expense entries for the period
    const entries = await this.journalEntryRepository.find({
      where: {
        status: JournalEntryStatus.POSTED,
        entryDate: Between(periodStart, periodEnd),
      },
      relations: ['lines', 'lines.glAccount'],
    });

    // Accumulate by account
    const incomeByAccount = new Map<string, { account: GlAccount; total: number }>();
    const expenseByAccount = new Map<string, { account: GlAccount; total: number }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (!line.glAccount) continue;

        const netAmount = Number(line.creditAmount) - Number(line.debitAmount);

        if (line.glAccount.accountType === GlAccountType.INCOME) {
          const existing = incomeByAccount.get(line.glAccountId) || { account: line.glAccount, total: 0 };
          existing.total += netAmount;
          incomeByAccount.set(line.glAccountId, existing);
        } else if (line.glAccount.accountType === GlAccountType.EXPENSE) {
          const existing = expenseByAccount.get(line.glAccountId) || { account: line.glAccount, total: 0 };
          existing.total -= netAmount; // Expenses are debits
          expenseByAccount.set(line.glAccountId, existing);
        }
      }
    }

    // Convert to arrays
    const income: AccountBalance[] = Array.from(incomeByAccount.values()).map((v) => ({
      accountCode: v.account.accountCode,
      accountName: v.account.accountName,
      balance: v.total,
      balanceKes: v.total / 100,
    }));

    const expenses: AccountBalance[] = Array.from(expenseByAccount.values()).map((v) => ({
      accountCode: v.account.accountCode,
      accountName: v.account.accountName,
      balance: v.total,
      balanceKes: v.total / 100,
    }));

    const totalIncome = income.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalIncome - totalExpenses;

    this.logger.log(
      `Generated Income Statement for ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}: ` +
      `Net Income=${netIncome / 100} KES`,
    );

    return {
      periodStart,
      periodEnd,
      income: { accounts: income, total: totalIncome },
      expenses: { accounts: expenses, total: totalExpenses },
      netIncome,
    };
  }

  /**
   * Generate Trial Balance
   */
  async generateTrialBalance(asOf: Date): Promise<TrialBalanceReport> {
    const accounts = await this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
      order: { accountCode: 'ASC' },
    });

    const trialBalanceAccounts: TrialBalanceAccount[] = accounts.map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      debitBalance: account.normalBalance === NormalBalance.DEBIT ? Number(account.balance) : 0,
      creditBalance: account.normalBalance === NormalBalance.CREDIT ? Number(account.balance) : 0,
    }));

    const totalDebits = trialBalanceAccounts.reduce((sum, a) => sum + a.debitBalance, 0);
    const totalCredits = trialBalanceAccounts.reduce((sum, a) => sum + a.creditBalance, 0);

    this.logger.log(
      `Generated Trial Balance as of ${asOf.toISOString().slice(0, 10)}: ` +
      `Debits=${totalDebits / 100} KES, Credits=${totalCredits / 100} KES`,
    );

    return {
      asOf,
      accounts: trialBalanceAccounts,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
    };
  }

  /**
   * Generate Partner Statement
   */
  async generatePartnerStatement(
    partnerType: PartnerType,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PartnerStatementReport> {
    // Get partner display name
    const partnerNames: Record<PartnerType, string> = {
      [PartnerType.DEFINITE_ASSURANCE]: 'Definite Assurance Co.',
      [PartnerType.KBA]: 'Kenya Bodaboda Association',
      [PartnerType.ROBS_INSURANCE]: 'Robs Insurance Agency',
      [PartnerType.ATRONACH]: 'Atronach K Ltd',
    };

    // Get GL account for partner
    const partnerAccountCodes: Record<PartnerType, string[]> = {
      [PartnerType.DEFINITE_ASSURANCE]: ['2001'],
      [PartnerType.KBA]: ['2002', '2004'],
      [PartnerType.ROBS_INSURANCE]: ['2003', '2005'],
      [PartnerType.ATRONACH]: ['4001', '4002', '4003', '4004'],
    };

    const accountCodes = partnerAccountCodes[partnerType] || [];

    // Get journal entry lines for partner accounts
    const lines = await this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.glAccount', 'account')
      .innerJoin('line.journalEntry', 'entry')
      .where('account.accountCode IN (:...codes)', { codes: accountCodes })
      .andWhere('entry.status = :status', { status: JournalEntryStatus.POSTED })
      .andWhere('entry.entryDate >= :start', { start: periodStart })
      .andWhere('entry.entryDate <= :end', { end: periodEnd })
      .orderBy('entry.entryDate', 'ASC')
      .addOrderBy('entry.entryNumber', 'ASC')
      .getMany();

    // Get settlements for the period
    const settlements = await this.settlementRepository.find({
      where: {
        partnerType,
        periodStart: Between(periodStart, periodEnd),
      },
    });

    // Build transactions list
    const transactions: PartnerTransaction[] = [];
    let runningBalance = 0;

    // Add journal entry transactions
    for (const line of lines) {
      const debit = Number(line.debitAmount);
      const credit = Number(line.creditAmount);
      runningBalance += credit - debit;

      transactions.push({
        date: line.journalEntry?.entryDate || new Date(),
        reference: line.journalEntry?.entryNumber || '',
        description: line.description || line.journalEntry?.description || '',
        debit,
        credit,
        balance: runningBalance,
      });
    }

    // Calculate summary
    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);
    const settledAmount = settlements
      .filter((s) => s.status === SettlementStatus.COMPLETED)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const pendingAmount = settlements
      .filter((s) => s.status !== SettlementStatus.COMPLETED)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);

    this.logger.log(
      `Generated Partner Statement for ${partnerType}: ` +
      `${transactions.length} transactions, balance=${runningBalance / 100} KES`,
    );

    return {
      partnerType,
      partnerName: partnerNames[partnerType] || partnerType,
      periodStart,
      periodEnd,
      openingBalance: 0, // Would need historical data
      transactions,
      closingBalance: runningBalance,
      summary: {
        totalDebits,
        totalCredits,
        settledAmount,
        pendingAmount,
      },
    };
  }

  /**
   * Get account activity for a period
   */
  async getAccountActivity(
    accountCode: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    account: GlAccount;
    openingBalance: number;
    transactions: Array<{
      date: Date;
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    closingBalance: number;
  }> {
    const account = await this.glAccountRepository.findOne({
      where: { accountCode },
    });

    if (!account) {
      throw new Error(`Account ${accountCode} not found`);
    }

    // Get lines for this account
    const lines = await this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'entry')
      .where('line.glAccountId = :accountId', { accountId: account.id })
      .andWhere('entry.status = :status', { status: JournalEntryStatus.POSTED })
      .andWhere('entry.entryDate >= :start', { start: periodStart })
      .andWhere('entry.entryDate <= :end', { end: periodEnd })
      .orderBy('entry.entryDate', 'ASC')
      .addOrderBy('entry.entryNumber', 'ASC')
      .getMany();

    const transactions = [];
    let balance = 0;

    for (const line of lines) {
      const debit = Number(line.debitAmount);
      const credit = Number(line.creditAmount);

      if (account.normalBalance === NormalBalance.DEBIT) {
        balance += debit - credit;
      } else {
        balance += credit - debit;
      }

      transactions.push({
        date: line.journalEntry?.entryDate || new Date(),
        reference: line.journalEntry?.entryNumber || '',
        description: line.description || '',
        debit,
        credit,
        balance,
      });
    }

    return {
      account,
      openingBalance: 0,
      transactions,
      closingBalance: balance,
    };
  }

  /**
   * Generate summary dashboard data
   */
  async getDashboardSummary(): Promise<{
    totalAssets: number;
    totalLiabilities: number;
    netIncome: number;
    cashBalance: number;
    premiumPayable: number;
    serviceFeesPayable: number;
  }> {
    const balanceSheet = await this.generateBalanceSheet(new Date());

    // Find specific accounts
    const accounts = await this.glAccountRepository.find({
      where: { status: GlAccountStatus.ACTIVE },
    });

    const cashAccounts = accounts.filter((a) => a.accountCode.startsWith('100'));
    const cashBalance = cashAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const premiumPayable = accounts.find((a) => a.accountCode === '2001');
    const serviceFeeKba = accounts.find((a) => a.accountCode === '2002');
    const serviceFeeRobs = accounts.find((a) => a.accountCode === '2003');

    return {
      totalAssets: balanceSheet.assets.total,
      totalLiabilities: balanceSheet.liabilities.total,
      netIncome: balanceSheet.equity.retainedEarnings,
      cashBalance,
      premiumPayable: premiumPayable ? Number(premiumPayable.balance) : 0,
      serviceFeesPayable:
        (serviceFeeKba ? Number(serviceFeeKba.balance) : 0) +
        (serviceFeeRobs ? Number(serviceFeeRobs.balance) : 0),
    };
  }
}
