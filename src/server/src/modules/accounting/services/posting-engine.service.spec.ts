import { Test, TestingModule } from '@nestjs/testing';
import { PostingEngineService, PaymentPostingInput, RefundPostingInput } from './posting-engine.service.js';
import { JournalEntryService } from './journal-entry.service.js';
import { JournalEntryType } from '../entities/journal-entry.entity.js';
import { GL_ACCOUNTS, PAYMENT_AMOUNTS } from '../config/posting-rules.config.js';

describe('PostingEngineService', () => {
  let service: PostingEngineService;

  const mockJournalEntry = {
    id: 'je-123',
    entryNumber: 'JE-20260114-001',
    entryType: JournalEntryType.PAYMENT_RECEIPT_DAY1,
    isBalanced: () => true,
  };

  const mockJournalEntryService = {
    create: jest.fn().mockResolvedValue(mockJournalEntry),
    getBySourceTransactionId: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostingEngineService,
        { provide: JournalEntryService, useValue: mockJournalEntryService },
      ],
    }).compile();

    service = module.get<PostingEngineService>(PostingEngineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postPaymentReceipt - Day 1 Deposit', () => {
    const depositInput: PaymentPostingInput = {
      transactionId: 'txn-123',
      userId: 'user-123',
      paymentType: 'DEPOSIT',
      amountCents: 104800, // 1048 KES in cents
      mpesaReceiptNumber: 'MPESA123',
    };

    it('should create balanced journal entry for Day 1 deposit', async () => {
      const result = await service.postPaymentReceipt(depositInput);

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
      await service.postPaymentReceipt(depositInput);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const lines = createCall.lines;

      // Verify debit to escrow account (1001)
      const debitLine = lines.find((l: any) => l.debitAmount > 0);
      expect(debitLine.accountCode).toBe(GL_ACCOUNTS.CASH_UBA_ESCROW);
      expect(debitLine.debitAmount).toBe(104800);

      // Verify credits sum to debit amount
      const totalCredits = lines
        .filter((l: any) => l.creditAmount > 0)
        .reduce((sum: number, l: any) => sum + l.creditAmount, 0);
      expect(totalCredits).toBe(104800);
    });

    it('should allocate amounts correctly per posting rules', async () => {
      await service.postPaymentReceipt(depositInput);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const lines = createCall.lines;

      // Premium payable should be present (2001)
      const premiumLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE);
      expect(premiumLine).toBeDefined();
      expect(premiumLine.creditAmount).toBe(PAYMENT_AMOUNTS.DAY1_PREMIUM);

      // Service fees (KES 1 each to KBA, Robs, Platform = 3 KES total = 300 cents)
      const kbaFeeLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA);
      const robsFeeLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS);
      const platformFeeLine = lines.find((l: any) => l.accountCode === GL_ACCOUNTS.SERVICE_FEE_INCOME_PLATFORM);

      expect(kbaFeeLine?.creditAmount).toBe(PAYMENT_AMOUNTS.SERVICE_FEE_KBA);
      expect(robsFeeLine?.creditAmount).toBe(PAYMENT_AMOUNTS.SERVICE_FEE_ROBS);
      expect(platformFeeLine?.creditAmount).toBe(PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM);
    });

    it('should be idempotent - return existing entry if already posted', async () => {
      mockJournalEntryService.getBySourceTransactionId.mockResolvedValueOnce([mockJournalEntry]);

      const result = await service.postPaymentReceipt(depositInput);

      expect(result.success).toBe(true);
      expect(result.alreadyPosted).toBe(true);
      expect(mockJournalEntryService.create).not.toHaveBeenCalled();
    });

    it('should handle transaction with no M-Pesa receipt gracefully', async () => {
      const inputWithoutReceipt = { ...depositInput, mpesaReceiptNumber: undefined };

      const result = await service.postPaymentReceipt(inputWithoutReceipt);

      expect(result.success).toBe(true);
    });
  });

  describe('postPaymentReceipt - Daily Payment', () => {
    const dailyInput: PaymentPostingInput = {
      transactionId: 'txn-daily-123',
      userId: 'user-123',
      paymentType: 'DAILY_PAYMENT',
      amountCents: 8700, // 87 KES in cents
      daysCount: 1,
      mpesaReceiptNumber: 'MPESA456',
    };

    it('should create balanced journal entry for daily payment', async () => {
      const result = await service.postPaymentReceipt(dailyInput);

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.PAYMENT_RECEIPT_DAILY,
          autoPost: true,
        }),
      );
    });

    it('should allocate daily payment amounts correctly', async () => {
      await service.postPaymentReceipt(dailyInput);

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

    it('should handle multi-day payments', async () => {
      const multiDayInput: PaymentPostingInput = {
        ...dailyInput,
        amountCents: 43500, // 5 days * 87 KES = 435 KES = 43500 cents
        daysCount: 5,
      };

      const result = await service.postPaymentReceipt(multiDayInput);

      expect(result.success).toBe(true);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const debitLine = createCall.lines.find((l: any) => l.debitAmount > 0);
      expect(debitLine.debitAmount).toBe(43500);
    });
  });

  describe('postRefund', () => {
    const refundInput: RefundPostingInput = {
      transactionId: 'refund-123',
      userId: 'user-123',
      amountCents: 78300, // 783 KES refund (9 days * 87)
      daysCount: 9,
    };

    it('should create journal entry for refund', async () => {
      const result = await service.postRefund(refundInput);

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.REFUND_INITIATION,
        }),
      );
    });

    it('should properly record refund payable liability', async () => {
      await service.postRefund(refundInput);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const refundPayableLine = createCall.lines.find(
        (l: any) => l.accountCode === GL_ACCOUNTS.REFUND_PAYABLE_RIDERS,
      );

      expect(refundPayableLine).toBeDefined();
      expect(refundPayableLine.creditAmount).toBeGreaterThan(0);
    });

    it('should be idempotent', async () => {
      mockJournalEntryService.getBySourceTransactionId.mockResolvedValueOnce([mockJournalEntry]);

      const result = await service.postRefund(refundInput);

      expect(result.success).toBe(true);
      expect(result.alreadyPosted).toBe(true);
    });
  });

  describe('postRefundPayout', () => {
    const payoutInput = {
      transactionId: 'refund-123',
      userId: 'user-123',
      refundAmountCents: 60000, // 600 KES payout to rider
      mpesaTransactionId: 'MPESA-B2C-123',
    };

    it('should create journal entry for refund payout', async () => {
      const result = await service.postRefundPayout(payoutInput);

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.REFUND_EXECUTION,
        }),
      );
    });

    it('should clear refund payable liability', async () => {
      await service.postRefundPayout(payoutInput);

      const createCall = mockJournalEntryService.create.mock.calls[0][0];
      const refundPayableDebit = createCall.lines.find(
        (l: any) => l.accountCode === GL_ACCOUNTS.REFUND_PAYABLE_RIDERS && l.debitAmount > 0,
      );

      expect(refundPayableDebit).toBeDefined();
      expect(refundPayableDebit.debitAmount).toBe(60000);
    });
  });

  describe('postRemittance', () => {
    it('should create journal entry for Day 1 remittance', async () => {
      const result = await service.postRemittance({
        transactionId: 'remit-123',
        amountCents: 100000,
        remittanceType: 'DAY1',
      });

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.PREMIUM_REMITTANCE_DAY1,
        }),
      );
    });

    it('should create journal entry for bulk remittance', async () => {
      const result = await service.postRemittance({
        transactionId: 'remit-bulk-123',
        amountCents: 500000,
        remittanceType: 'BULK',
      });

      expect(result.success).toBe(true);
      expect(mockJournalEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: JournalEntryType.PREMIUM_REMITTANCE_BULK,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should return failure when journal entry creation fails', async () => {
      mockJournalEntryService.create.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.postPaymentReceipt({
        transactionId: 'txn-fail',
        userId: 'user-123',
        paymentType: 'DEPOSIT',
        amountCents: 104800,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('DB error');
    });
  });

  describe('posting rules validation', () => {
    it('should always create balanced entries (debits = credits)', async () => {
      const inputs: PaymentPostingInput[] = [
        { transactionId: 'txn-1', userId: 'u1', paymentType: 'DEPOSIT', amountCents: 104800 },
        { transactionId: 'txn-2', userId: 'u2', paymentType: 'DAILY_PAYMENT', amountCents: 8700, daysCount: 1 },
        { transactionId: 'txn-3', userId: 'u3', paymentType: 'DAILY_PAYMENT', amountCents: 43500, daysCount: 5 },
      ];

      for (const input of inputs) {
        mockJournalEntryService.create.mockClear();
        mockJournalEntryService.getBySourceTransactionId.mockResolvedValueOnce([]);
        await service.postPaymentReceipt(input);

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

  describe('isTransactionPosted', () => {
    it('should return true if transaction already posted', async () => {
      mockJournalEntryService.getBySourceTransactionId.mockResolvedValueOnce([mockJournalEntry]);

      const result = await service.isTransactionPosted('txn-123');

      expect(result).toBe(true);
    });

    it('should return false if transaction not posted', async () => {
      mockJournalEntryService.getBySourceTransactionId.mockResolvedValueOnce([]);

      const result = await service.isTransactionPosted('txn-new');

      expect(result).toBe(false);
    });
  });

  describe('getEntriesForTransaction', () => {
    it('should return journal entries for transaction', async () => {
      mockJournalEntryService.getBySourceTransactionId.mockResolvedValueOnce([mockJournalEntry]);

      const result = await service.getEntriesForTransaction('txn-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('je-123');
    });
  });
});
