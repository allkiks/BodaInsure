import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FinancialReportingService } from './financial-reporting.service.js';
import { GlAccount, GlAccountType, GlAccountStatus, NormalBalance } from '../entities/gl-account.entity.js';
import { JournalEntry, JournalEntryStatus } from '../entities/journal-entry.entity.js';
import { JournalEntryLine } from '../entities/journal-entry-line.entity.js';
import { PartnerSettlement, PartnerType, SettlementStatus } from '../entities/partner-settlement.entity.js';

describe('FinancialReportingService', () => {
  let service: FinancialReportingService;

  const createMockGlAccount = (
    id: string,
    code: string,
    name: string,
    type: GlAccountType,
    normal: NormalBalance,
    bal: number,
  ) => ({
    id,
    accountCode: code,
    accountName: name,
    accountType: type,
    normalBalance: normal,
    balance: bal,
    status: GlAccountStatus.ACTIVE,
    getBalanceInKes: () => bal / 100,
  });

  const mockGlAccounts = [
    // Assets
    createMockGlAccount('1', '1001', 'Cash at Bank - UBA Escrow', GlAccountType.ASSET, NormalBalance.DEBIT, 5000000),
    createMockGlAccount('2', '1002', 'Cash at Bank - Platform Operating', GlAccountType.ASSET, NormalBalance.DEBIT, 1500000),
    // Liabilities
    createMockGlAccount('3', '2001', 'Premium Payable to Definite', GlAccountType.LIABILITY, NormalBalance.CREDIT, 4000000),
    createMockGlAccount('4', '2002', 'Service Fee Payable - KBA', GlAccountType.LIABILITY, NormalBalance.CREDIT, 300000),
    createMockGlAccount('5', '2003', 'Service Fee Payable - Robs', GlAccountType.LIABILITY, NormalBalance.CREDIT, 200000),
    // Income
    createMockGlAccount('6', '4001', 'Platform Service Fee Income', GlAccountType.INCOME, NormalBalance.CREDIT, 1000000),
    // Expense
    createMockGlAccount('7', '5001', 'Transaction Costs', GlAccountType.EXPENSE, NormalBalance.DEBIT, 200000),
  ];

  const mockGlAccountRepository = {
    find: jest.fn().mockResolvedValue(mockGlAccounts),
    findOne: jest.fn().mockImplementation(({ where }) => {
      const account = mockGlAccounts.find((a) => a.accountCode === where?.accountCode);
      return Promise.resolve(account || null);
    }),
  };

  const mockJournalEntryRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockJournalEntryLineRepository = {
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockSettlementRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportingService,
        { provide: getRepositoryToken(GlAccount), useValue: mockGlAccountRepository },
        { provide: getRepositoryToken(JournalEntry), useValue: mockJournalEntryRepository },
        { provide: getRepositoryToken(JournalEntryLine), useValue: mockJournalEntryLineRepository },
        { provide: getRepositoryToken(PartnerSettlement), useValue: mockSettlementRepository },
      ],
    }).compile();

    service = module.get<FinancialReportingService>(FinancialReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBalanceSheet', () => {
    it('should generate balance sheet with assets, liabilities, and equity', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result).toHaveProperty('assets');
      expect(result).toHaveProperty('liabilities');
      expect(result).toHaveProperty('equity');
      expect(result).toHaveProperty('asOf');
    });

    it('should calculate total assets correctly', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // Sum of asset accounts: 5000000 + 1500000 = 6500000 cents
      expect(result.assets.total).toBe(6500000);
    });

    it('should calculate total liabilities correctly', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // Sum of liability accounts: 4000000 + 300000 + 200000 = 4500000 cents
      expect(result.liabilities.total).toBe(4500000);
    });

    it('should verify accounting equation structure', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // isBalanced flag should be calculated
      expect(result).toHaveProperty('isBalanced');
      // totalLiabilitiesAndEquity should equal liabilities + equity
      expect(result.totalLiabilitiesAndEquity).toBe(result.liabilities.total + result.equity.total);
    });

    it('should include asset accounts list', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result.assets.accounts.length).toBeGreaterThan(0);
      expect(result.assets.accounts[0]).toHaveProperty('accountCode');
      expect(result.assets.accounts[0]).toHaveProperty('accountName');
    });
  });

  describe('generateIncomeStatement', () => {
    it('should generate income statement for date range', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result).toHaveProperty('income');
      expect(result).toHaveProperty('expenses');
      expect(result).toHaveProperty('netIncome');
      expect(result).toHaveProperty('periodStart');
      expect(result).toHaveProperty('periodEnd');
    });

    it('should calculate total income correctly', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      // No journal entries in mock, so income from entries is 0
      expect(result.income.total).toBe(0);
    });

    it('should calculate total expenses correctly', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      // No journal entries in mock, so expenses from entries is 0
      expect(result.expenses.total).toBe(0);
    });

    it('should calculate net income correctly (Income - Expenses)', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.netIncome).toBe(result.income.total - result.expenses.total);
    });

    it('should include income accounts list', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.income).toHaveProperty('accounts');
      expect(result.income).toHaveProperty('total');
    });
  });

  describe('generateTrialBalance', () => {
    it('should generate trial balance with all accounts', async () => {
      const result = await service.generateTrialBalance(new Date('2026-01-14'));

      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('totalDebits');
      expect(result).toHaveProperty('totalCredits');
      expect(result).toHaveProperty('isBalanced');
    });

    it('should calculate debit and credit totals', async () => {
      const result = await service.generateTrialBalance(new Date('2026-01-14'));

      // Debits: Assets (5000000 + 1500000) + Expenses (200000) = 6700000
      expect(result.totalDebits).toBe(6700000);
      // Credits: Liabilities (4000000 + 300000 + 200000) + Income (1000000) = 5500000
      expect(result.totalCredits).toBe(5500000);
    });

    it('should include all GL accounts', async () => {
      const result = await service.generateTrialBalance(new Date('2026-01-14'));

      expect(result.accounts.length).toBe(mockGlAccounts.length);
    });
  });

  describe('generatePartnerStatement', () => {
    it('should generate statement for KBA', async () => {
      const result = await service.generatePartnerStatement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.partnerType).toBe(PartnerType.KBA);
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('summary');
    });

    it('should generate statement for Robs Insurance', async () => {
      const result = await service.generatePartnerStatement(
        PartnerType.ROBS_INSURANCE,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.partnerType).toBe(PartnerType.ROBS_INSURANCE);
    });

    it('should generate statement for Definite Assurance', async () => {
      const result = await service.generatePartnerStatement(
        PartnerType.DEFINITE_ASSURANCE,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.partnerType).toBe(PartnerType.DEFINITE_ASSURANCE);
    });

    it('should include settlement summary', async () => {
      const result = await service.generatePartnerStatement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.summary).toHaveProperty('totalDebits');
      expect(result.summary).toHaveProperty('totalCredits');
      expect(result.summary).toHaveProperty('settledAmount');
      expect(result.summary).toHaveProperty('pendingAmount');
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive dashboard summary', async () => {
      const result = await service.getDashboardSummary();

      expect(result).toHaveProperty('totalAssets');
      expect(result).toHaveProperty('totalLiabilities');
      expect(result).toHaveProperty('netIncome');
      expect(result).toHaveProperty('cashBalance');
    });

    it('should include cash balance', async () => {
      const result = await service.getDashboardSummary();

      // Cash accounts: 1001 (5000000) + 1002 (1500000) = 6500000
      expect(result.cashBalance).toBe(6500000);
    });

    it('should include financial metrics', async () => {
      const result = await service.getDashboardSummary();

      expect(result.totalAssets).toBe(6500000);
      expect(result.totalLiabilities).toBe(4500000);
    });
  });

  describe('report formatting', () => {
    it('should format amounts in KES correctly', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // All amounts should be in cents (integers)
      expect(Number.isInteger(result.assets.total)).toBe(true);
      expect(Number.isInteger(result.liabilities.total)).toBe(true);
    });

    it('should include report metadata', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result.asOf).toBeDefined();
      expect(result.isBalanced).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing GL accounts gracefully', async () => {
      mockGlAccountRepository.find.mockResolvedValueOnce([]);

      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result.assets.total).toBe(0);
      expect(result.liabilities.total).toBe(0);
    });

    it('should handle repository errors', async () => {
      mockGlAccountRepository.find.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.generateBalanceSheet(new Date('2026-01-14'))).rejects.toThrow();
    });
  });
});
