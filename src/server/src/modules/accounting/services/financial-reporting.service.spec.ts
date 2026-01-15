import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportingService } from './financial-reporting.service.js';
import { GlAccountService } from './gl-account.service.js';
import { JournalEntryService } from './journal-entry.service.js';
import { SettlementService } from './settlement.service.js';
import { EscrowService } from './escrow.service.js';
import { GlAccountType, NormalBalance } from '../entities/gl-account.entity.js';
import { PartnerType, SettlementStatus } from '../entities/partner-settlement.entity.js';

describe('FinancialReportingService', () => {
  let service: FinancialReportingService;
  let glAccountService: GlAccountService;
  let journalEntryService: JournalEntryService;
  let settlementService: SettlementService;
  let escrowService: EscrowService;

  const mockGlAccounts = [
    // Assets
    {
      id: '1',
      accountCode: '1001',
      accountName: 'Cash at Bank - UBA Escrow',
      accountType: GlAccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
      balance: 5000000,
      getBalanceInKes: () => 50000,
    },
    {
      id: '2',
      accountCode: '1002',
      accountName: 'Cash at Bank - Platform Operating',
      accountType: GlAccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
      balance: 1500000,
      getBalanceInKes: () => 15000,
    },
    // Liabilities
    {
      id: '3',
      accountCode: '2001',
      accountName: 'Premium Payable to Definite',
      accountType: GlAccountType.LIABILITY,
      normalBalance: NormalBalance.CREDIT,
      balance: 4000000,
      getBalanceInKes: () => 40000,
    },
    // Income
    {
      id: '4',
      accountCode: '4001',
      accountName: 'Platform Service Fee Income',
      accountType: GlAccountType.INCOME,
      normalBalance: NormalBalance.CREDIT,
      balance: 1000000,
      getBalanceInKes: () => 10000,
    },
    // Expense
    {
      id: '5',
      accountCode: '5001',
      accountName: 'Transaction Costs',
      accountType: GlAccountType.EXPENSE,
      normalBalance: NormalBalance.DEBIT,
      balance: 200000,
      getBalanceInKes: () => 2000,
    },
  ];

  const mockGlAccountService = {
    getAll: jest.fn().mockResolvedValue(mockGlAccounts),
    getByType: jest.fn().mockImplementation((type) =>
      Promise.resolve(mockGlAccounts.filter((a) => a.accountType === type)),
    ),
    getTrialBalance: jest.fn().mockResolvedValue({
      accounts: mockGlAccounts,
      totalDebits: 6700000,
      totalCredits: 6700000,
      isBalanced: true,
    }),
  };

  const mockJournalEntryService = {
    getByDateRange: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(100),
  };

  const mockSettlementService = {
    getPartnerSummary: jest.fn().mockResolvedValue({
      totalSettled: 1000000,
      totalPending: 500000,
      settlementCount: 10,
      pendingCount: 5,
    }),
  };

  const mockEscrowService = {
    getEscrowSummary: jest.fn().mockResolvedValue({
      totalEscrow: 4000000,
      pendingRemittance: 2000000,
      remittedAmount: 2000000,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportingService,
        { provide: GlAccountService, useValue: mockGlAccountService },
        { provide: JournalEntryService, useValue: mockJournalEntryService },
        { provide: SettlementService, useValue: mockSettlementService },
        { provide: EscrowService, useValue: mockEscrowService },
      ],
    }).compile();

    service = module.get<FinancialReportingService>(FinancialReportingService);
    glAccountService = module.get<GlAccountService>(GlAccountService);
    journalEntryService = module.get<JournalEntryService>(JournalEntryService);
    settlementService = module.get<SettlementService>(SettlementService);
    escrowService = module.get<EscrowService>(EscrowService);
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
      expect(result).toHaveProperty('reportDate');
    });

    it('should calculate total assets correctly', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // Sum of asset accounts: 5000000 + 1500000 = 6500000 cents
      expect(result.totalAssets).toBe(6500000);
    });

    it('should calculate total liabilities correctly', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // Sum of liability accounts: 4000000 cents
      expect(result.totalLiabilities).toBe(4000000);
    });

    it('should verify accounting equation (Assets = Liabilities + Equity)', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // Assets should equal Liabilities + Equity
      expect(result.totalAssets).toBe(result.totalLiabilities + result.totalEquity);
    });

    it('should group assets by subcategory', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result.assets).toHaveProperty('currentAssets');
      expect(result.assets.currentAssets.length).toBeGreaterThan(0);
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

      // Sum of income accounts: 1000000 cents
      expect(result.totalIncome).toBe(1000000);
    });

    it('should calculate total expenses correctly', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      // Sum of expense accounts: 200000 cents
      expect(result.totalExpenses).toBe(200000);
    });

    it('should calculate net income correctly (Income - Expenses)', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.netIncome).toBe(result.totalIncome - result.totalExpenses);
    });

    it('should categorize income by source', async () => {
      const result = await service.generateIncomeStatement(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.income.serviceFees).toBeDefined();
      expect(result.income.commissions).toBeDefined();
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

    it('should verify trial balance is balanced', async () => {
      const result = await service.generateTrialBalance(new Date('2026-01-14'));

      expect(result.isBalanced).toBe(true);
      expect(result.totalDebits).toBe(result.totalCredits);
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
      expect(result).toHaveProperty('settlements');
      expect(result).toHaveProperty('totalSettled');
      expect(result).toHaveProperty('totalPending');
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

      expect(result.totalSettled).toBe(1000000);
      expect(result.totalPending).toBe(500000);
      expect(result.settlementCount).toBe(10);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive dashboard summary', async () => {
      const result = await service.getDashboardSummary();

      expect(result).toHaveProperty('escrow');
      expect(result).toHaveProperty('settlements');
      expect(result).toHaveProperty('financials');
      expect(result).toHaveProperty('asOfDate');
    });

    it('should include escrow summary', async () => {
      const result = await service.getDashboardSummary();

      expect(result.escrow.totalEscrow).toBe(4000000);
      expect(result.escrow.pendingRemittance).toBe(2000000);
    });

    it('should include financial metrics', async () => {
      const result = await service.getDashboardSummary();

      expect(result.financials).toHaveProperty('totalAssets');
      expect(result.financials).toHaveProperty('totalLiabilities');
      expect(result.financials).toHaveProperty('netIncome');
    });
  });

  describe('report formatting', () => {
    it('should format amounts in KES correctly', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      // All amounts should be in cents (integers)
      expect(Number.isInteger(result.totalAssets)).toBe(true);
      expect(Number.isInteger(result.totalLiabilities)).toBe(true);
    });

    it('should include report metadata', async () => {
      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result.reportDate).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing GL accounts gracefully', async () => {
      mockGlAccountService.getAll.mockResolvedValueOnce([]);

      const result = await service.generateBalanceSheet(new Date('2026-01-14'));

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
    });

    it('should handle GL service errors', async () => {
      mockGlAccountService.getAll.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.generateBalanceSheet(new Date('2026-01-14'))).rejects.toThrow();
    });
  });
});
