import { Test, TestingModule } from '@nestjs/testing';
import { PostingEngineService } from './posting-engine.service.js';
import { JournalEntryService } from './journal-entry.service.js';
import { EscrowService } from './escrow.service.js';
import { TransactionType } from '../../payment/entities/transaction.entity.js';
import { JournalEntryType } from '../entities/journal-entry.entity.js';
import { GL_ACCOUNTS, PAYMENT_AMOUNTS } from '../config/posting-rules.config.js';

describe('PostingEngineService', () => {
  let service: PostingEngineService;
  let journalEntryService: JournalEntryService;
  let escrowService: EscrowService;

  const mockJournalEntry = {
    id: 'je-123',
    entryNumber: 'JE-20260114-001',
    entryType: JournalEntryType.PAYMENT_RECEIPT_DAY1,
    isBalanced: () => true,
  };

  const mockEscrowRecord = {
    id: 'escrow-123',
    riderId: 'rider-123',
    transactionId: 'txn-123',
    grossAmount: 104800,
    netPremiumAmount: 98200,
  };

  const mockJournalEntryService = {
    create: jest.fn().mockResolvedValue(mockJournalEntry),
  };

  const mockEscrowService = {
    createFromTransaction: jest.fn().mockResolvedValue(mockEscrowRecord),
    recordDailyPayment: jest.fn().mockResolvedValue(mockEscrowRecord),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostingEngineService,
        { provide: JournalEntryService, useValue: mockJournalEntryService },
        { provide: EscrowService, useValue: mockEscrowService },
      ],
    }).compile();

    service = module.get<PostingEngineService>(PostingEngineService);
    journalEntryService = module.get<JournalEntryService>(JournalEntryService);
    escrowService = module.get<EscrowService>(EscrowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postDay1Payment', () => {
    const mockTransaction = {
      id: 'txn-123',
      userId: 'user-123',
      type: TransactionType.DEPOSIT,
      amount: 104800, // 1048 KES in cents
      mpesaReceiptNumber: 'MPESA123',
      completedAt: new Date(),
    };

    it('should create balanced journal entry for Day 1 deposit', async () => {
      const result = await service.postDay1Payment(mockTransaction as any);

      expect(result.success).toBe(true);
      expect(result.journalEntryId).toBe('je-123');
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.PAYMENT_RECEIPT_DAY1,
          autoPost: true,
        }),
      );
    });

    it('should create correct debit/credit lines for Day 1 deposit', async () => {
      await service.postDay1Payment(mockTransaction as any);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const lines = createCall.lines;

      // Verify debit to escrow account
      const debitLine = lines.find((l: any) => l.debitAmount > 0);
      expect(debitLine.accountCode).toBe(GL_ACCOUNTS.CASH_ESCROW);
      expect(debitLine.debitAmount).toBe(104800);

      // Verify credits sum to debit amount
      const totalCredits = lines
        .filter((l: any) => l.creditAmount > 0)
        .reduce((sum: number, l: any) => sum + l.creditAmount, 0);
      expect(totalCredits).toBe(104800);
    });

    it('should allocate amounts correctly per posting rules', async () => {
      await service.postDay1Payment(mockTransaction as any);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const lines = createCall.lines;

      // Premium payable (net premium = 1048 - 3 service fees - 63 platform fee = 982 KES)
      const premiumLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE);
      expect(premiumLine).toBeDefined();

      // Service fees (KES 1 each to KBA, Robs, Platform = 3 KES total = 300 cents)
      const kbaFeeLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA);
      const robsFeeLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS);
      const platformFeeLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.PLATFORM_SERVICE_FEE_INCOME);

      expect(kbaFeeLine?.creditAmount).toBe(PAYMENT_AMOUNTS.SERVICE_FEE_KBA);
      expect(robsFeeLine?.creditAmount).toBe(PAYMENT_AMOUNTS.SERVICE_FEE_ROBS);
      expect(platformFeeLine?.creditAmount).toBe(PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM);
    });

    it('should create escrow record for Day 1 deposit', async () => {
      await service.postDay1Payment(mockTransaction as any);

      expect(mockEscrowService.createFromTransaction).toHaveBeenCalledWith(
        mockTransaction,
        expect.any(String),
      );
    });

    it('should handle transaction with no M-Pesa receipt gracefully', async () => {
      const txnWithoutReceipt = { ...mockTransaction, mpesaReceiptNumber: null };

      const result = await service.postDay1Payment(txnWithoutReceipt as any);

      expect(result.success).toBe(true);
    });
  });

  describe('postDailyPayment', () => {
    const mockDailyTransaction = {
      id: 'txn-daily-123',
      userId: 'user-123',
      type: TransactionType.DAILY_PAYMENT,
      amount: 8700, // 87 KES in cents
      mpesaReceiptNumber: 'MPESA456',
      completedAt: new Date(),
    };

    it('should create balanced journal entry for daily payment', async () => {
      const result = await service.postDailyPayment(mockDailyTransaction as any);

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.PAYMENT_RECEIPT_DAILY,
          autoPost: true,
        }),
      );
    });

    it('should allocate daily payment amounts correctly', async () => {
      await service.postDailyPayment(mockDailyTransaction as any);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const lines = createCall.lines;

      // Verify debit equals credit
      const totalDebits = lines
        .filter((l: any) => l.debitAmount > 0)
        .reduce((sum: number, l: any) => sum + l.debitAmount, 0);
      const totalCredits = lines
        .filter((l: any) => l.creditAmount > 0)
        .reduce((sum: number, l: any) => sum + l.creditAmount, 0);

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(8700);
    });

    it('should record daily payment in escrow', async () => {
      await service.postDailyPayment(mockDailyTransaction as any);

      expect(mockEscrowService.recordDailyPayment).toHaveBeenCalledWith(
        mockDailyTransaction,
        expect.any(String),
      );
    });

    it('should handle multi-day payments', async () => {
      const multiDayTransaction = {
        ...mockDailyTransaction,
        amount: 43500, // 5 days * 87 KES = 435 KES = 43500 cents
        metadata: { daysCount: 5 },
      };

      const result = await service.postDailyPayment(multiDayTransaction as any);

      expect(result.success).toBe(true);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const debitLine = createCall.lines.find((l: any) => l.debitAmount > 0);
      expect(debitLine.debitAmount).toBe(43500);
    });
  });

  describe('postServiceFeeDistribution', () => {
    it('should create journal entry for service fee payout', async () => {
      const result = await service.postServiceFeeDistribution({
        partnerId: 'KBA',
        amount: 10000, // 100 KES
        bankReference: 'BANK123',
        settlementId: 'settlement-123',
      });

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.SERVICE_FEE_DISTRIBUTION,
        }),
      );
    });
  });

  describe('postRefundInitiation', () => {
    const mockRefundTransaction = {
      id: 'refund-123',
      userId: 'user-123',
      type: TransactionType.REFUND,
      amount: 78300, // 783 KES refund
      metadata: {
        originalDaysCount: 10,
        unusedDaysCount: 9,
      },
    };

    it('should create journal entry for refund', async () => {
      const result = await service.postRefundInitiation(mockRefundTransaction as any);

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.REFUND_INITIATION,
        }),
      );
    });

    it('should properly record refund payable liability', async () => {
      await service.postRefundInitiation(mockRefundTransaction as any);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const refundPayableLine = createCall.lines.find(
        (l: any) => l.accountCode === GL_ACCOUNTS.REFUND_PAYABLE,
      );

      expect(refundPayableLine).toBeDefined();
      expect(refundPayableLine.creditAmount).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should return failure when journal entry creation fails', async () => {
      mockJournalEntryService.create.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.postDay1Payment({
        id: 'txn-fail',
        userId: 'user-123',
        type: TransactionType.DEPOSIT,
        amount: 104800,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });

    it('should return failure when escrow creation fails', async () => {
      mockEscrowService.createFromTransaction.mockRejectedValueOnce(new Error('Escrow error'));

      const result = await service.postDay1Payment({
        id: 'txn-fail-escrow',
        userId: 'user-123',
        type: TransactionType.DEPOSIT,
        amount: 104800,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Escrow error');
    });
  });

  describe('posting rules validation', () => {
    it('should always create balanced entries (debits = credits)', async () => {
      const transactions = [
        { id: 'txn-1', userId: 'u1', type: TransactionType.DEPOSIT, amount: 104800 },
        { id: 'txn-2', userId: 'u2', type: TransactionType.DAILY_PAYMENT, amount: 8700 },
        { id: 'txn-3', userId: 'u3', type: TransactionType.DAILY_PAYMENT, amount: 43500 },
      ];

      for (const txn of transactions) {
        mockJournalEntryService.create.mockClear();
        await service.postDay1Payment(txn as any);

        if (mockJournalEntryService.create.mock.calls.length > 0) {
          const createCall = mockJournalEntryService.create.mock.calls[0][0];
          const lines = createCall.lines;

          const totalDebits = lines
            .filter((l: any) => l.debitAmount > 0)
            .reduce((sum: number, l: any) => sum + l.debitAmount, 0);
          const totalCredits = lines
            .filter((l: any) => l.creditAmount > 0)
            .reduce((sum: number, l: any) => sum + l.creditAmount, 0);

          expect(totalDebits).toBe(totalCredits);
        }
      }
    });
  });
});
