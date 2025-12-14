import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentService } from './payment.service.js';
import { MpesaService } from './mpesa.service.js';
import { WalletService } from './wallet.service.js';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity.js';
import { PaymentRequest, PaymentRequestStatus } from '../entities/payment-request.entity.js';
import { Wallet } from '../entities/wallet.entity.js';

describe('PaymentService', () => {
  let service: PaymentService;
  let transactionRepository: Repository<Transaction>;
  let paymentRequestRepository: Repository<PaymentRequest>;
  let mpesaService: MpesaService;
  let walletService: WalletService;
  let dataSource: DataSource;

  const mockWallet: Partial<Wallet> = {
    id: 'wallet-123',
    userId: 'user-123',
    balance: 0,
    depositCompleted: false,
    dailyPaymentsCount: 0,
  };

  const mockPaymentRequest: Partial<PaymentRequest> = {
    id: 'request-123',
    userId: 'user-123',
    status: PaymentRequestStatus.INITIATED,
    paymentType: TransactionType.DEPOSIT,
    amount: 104800,
    phone: '254712345678',
    idempotencyKey: 'test-key',
    daysCount: 1,
    getAmountInKes: () => 1048,
    isSuccessful: () => false,
    isPending: () => true,
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  const mockPaymentRequestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockMpesaService = {
    initiateSTKPush: jest.fn(),
    parseCallback: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
  };

  const mockWalletService = {
    getOrCreateWallet: jest.fn(),
    canMakeDeposit: jest.fn(),
    canMakeDailyPayment: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepository },
        { provide: getRepositoryToken(PaymentRequest), useValue: mockPaymentRequestRepository },
        { provide: MpesaService, useValue: mockMpesaService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    paymentRequestRepository = module.get<Repository<PaymentRequest>>(getRepositoryToken(PaymentRequest));
    mpesaService = module.get<MpesaService>(MpesaService);
    walletService = module.get<WalletService>(WalletService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    describe('deposit payment', () => {
      it('should initiate deposit successfully', async () => {
        mockPaymentRequestRepository.findOne.mockResolvedValue(null);
        mockWalletService.getOrCreateWallet.mockResolvedValue(mockWallet);
        mockWalletService.canMakeDeposit.mockResolvedValue({ allowed: true });
        mockPaymentRequestRepository.create.mockReturnValue(mockPaymentRequest);
        mockPaymentRequestRepository.save.mockResolvedValue(mockPaymentRequest);
        mockMpesaService.initiateSTKPush.mockResolvedValue({
          success: true,
          checkoutRequestId: 'checkout-123',
          merchantRequestId: 'merchant-123',
          responseCode: '0',
        });

        const result = await service.initiatePayment({
          userId: 'user-123',
          phone: '0712345678',
          type: TransactionType.DEPOSIT,
          idempotencyKey: 'test-key',
        });

        expect(result.success).toBe(true);
        expect(result.checkoutRequestId).toBe('checkout-123');
        expect(mockMpesaService.initiateSTKPush).toHaveBeenCalledWith({
          phone: '0712345678',
          amount: 1048,
          accountReference: 'BODA-DEPOSIT',
          transactionDesc: 'BodaInsure Dep',
        });
      });

      it('should return cached result for duplicate idempotency key', async () => {
        const existingRequest = {
          ...mockPaymentRequest,
          status: PaymentRequestStatus.SENT,
          checkoutRequestId: 'checkout-existing',
          isSuccessful: () => false,
          isPending: () => true,
        };
        mockPaymentRequestRepository.findOne.mockResolvedValue(existingRequest);

        const result = await service.initiatePayment({
          userId: 'user-123',
          phone: '0712345678',
          type: TransactionType.DEPOSIT,
          idempotencyKey: 'test-key',
        });

        expect(result.message).toContain('already initiated');
        expect(mockMpesaService.initiateSTKPush).not.toHaveBeenCalled();
      });

      it('should reject if deposit already completed', async () => {
        mockPaymentRequestRepository.findOne.mockResolvedValue(null);
        mockWalletService.getOrCreateWallet.mockResolvedValue({
          ...mockWallet,
          depositCompleted: true,
        });
        mockWalletService.canMakeDeposit.mockResolvedValue({
          allowed: false,
          reason: 'Deposit already completed',
        });

        const result = await service.initiatePayment({
          userId: 'user-123',
          phone: '0712345678',
          type: TransactionType.DEPOSIT,
          idempotencyKey: 'test-key-2',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('already completed');
      });
    });

    describe('daily payment', () => {
      it('should initiate daily payment successfully', async () => {
        const walletWithDeposit = {
          ...mockWallet,
          depositCompleted: true,
          dailyPaymentsCount: 5,
        };
        mockPaymentRequestRepository.findOne.mockResolvedValue(null);
        mockWalletService.getOrCreateWallet.mockResolvedValue(walletWithDeposit);
        mockWalletService.canMakeDailyPayment.mockResolvedValue({
          allowed: true,
          remainingDays: 25,
        });
        mockPaymentRequestRepository.create.mockReturnValue({
          ...mockPaymentRequest,
          paymentType: TransactionType.DAILY_PAYMENT,
          amount: 8700,
        });
        mockPaymentRequestRepository.save.mockImplementation((req) => Promise.resolve(req));
        mockMpesaService.initiateSTKPush.mockResolvedValue({
          success: true,
          checkoutRequestId: 'checkout-daily-123',
          merchantRequestId: 'merchant-daily-123',
          responseCode: '0',
        });

        const result = await service.initiatePayment({
          userId: 'user-123',
          phone: '0712345678',
          type: TransactionType.DAILY_PAYMENT,
          idempotencyKey: 'daily-key',
        });

        expect(result.success).toBe(true);
        expect(mockMpesaService.initiateSTKPush).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 87,
          }),
        );
      });

      it('should reject daily payment if deposit not made', async () => {
        mockPaymentRequestRepository.findOne.mockResolvedValue(null);
        mockWalletService.getOrCreateWallet.mockResolvedValue(mockWallet);
        mockWalletService.canMakeDailyPayment.mockResolvedValue({
          allowed: false,
          reason: 'Please complete deposit first',
        });

        const result = await service.initiatePayment({
          userId: 'user-123',
          phone: '0712345678',
          type: TransactionType.DAILY_PAYMENT,
          idempotencyKey: 'daily-key',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('deposit first');
      });

      it('should support multi-day payments', async () => {
        const walletWithDeposit = {
          ...mockWallet,
          depositCompleted: true,
          dailyPaymentsCount: 0,
        };
        mockPaymentRequestRepository.findOne.mockResolvedValue(null);
        mockWalletService.getOrCreateWallet.mockResolvedValue(walletWithDeposit);
        mockWalletService.canMakeDailyPayment.mockResolvedValue({
          allowed: true,
          remainingDays: 30,
        });
        mockPaymentRequestRepository.create.mockReturnValue({
          ...mockPaymentRequest,
          paymentType: TransactionType.DAILY_PAYMENT,
          amount: 43500, // 5 days * 87 * 100
          daysCount: 5,
        });
        mockPaymentRequestRepository.save.mockImplementation((req) => Promise.resolve(req));
        mockMpesaService.initiateSTKPush.mockResolvedValue({
          success: true,
          checkoutRequestId: 'checkout-multi-123',
          merchantRequestId: 'merchant-multi-123',
          responseCode: '0',
        });

        const result = await service.initiatePayment({
          userId: 'user-123',
          phone: '0712345678',
          type: TransactionType.DAILY_PAYMENT,
          daysCount: 5,
          idempotencyKey: 'multi-day-key',
        });

        expect(result.success).toBe(true);
        expect(mockMpesaService.initiateSTKPush).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 435, // 5 * 87
          }),
        );
      });
    });
  });

  describe('processCallback', () => {
    it('should return not found for unknown checkout request', async () => {
      mockPaymentRequestRepository.findOne.mockResolvedValue(null);

      const result = await service.processCallback({
        merchantRequestId: 'merchant-123',
        checkoutRequestId: 'unknown-checkout',
        resultCode: 0,
        resultDesc: 'Success',
        isSuccessful: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return already processed for completed requests', async () => {
      const completedRequest = {
        ...mockPaymentRequest,
        status: PaymentRequestStatus.COMPLETED,
        transactionId: 'txn-123',
      };
      mockPaymentRequestRepository.findOne.mockResolvedValue(completedRequest);

      const result = await service.processCallback({
        merchantRequestId: 'merchant-123',
        checkoutRequestId: 'checkout-123',
        resultCode: 0,
        resultDesc: 'Success',
        isSuccessful: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already processed');
    });

    it('should handle failed payment callback', async () => {
      const pendingRequest = {
        ...mockPaymentRequest,
        status: PaymentRequestStatus.SENT,
      };
      mockPaymentRequestRepository.findOne.mockResolvedValue(pendingRequest);
      mockPaymentRequestRepository.save.mockImplementation((req) => Promise.resolve(req));

      const result = await service.processCallback({
        merchantRequestId: 'merchant-123',
        checkoutRequestId: 'checkout-123',
        resultCode: 1032,
        resultDesc: 'Request cancelled by user',
        isSuccessful: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('cancelled');
    });
  });

  describe('getPaymentRequest', () => {
    it('should return payment request by ID', async () => {
      mockPaymentRequestRepository.findOne.mockResolvedValue(mockPaymentRequest);

      const result = await service.getPaymentRequest('request-123');

      expect(result).toEqual(mockPaymentRequest);
      expect(mockPaymentRequestRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'request-123' },
      });
    });

    it('should return null for non-existent request', async () => {
      mockPaymentRequestRepository.findOne.mockResolvedValue(null);

      const result = await service.getPaymentRequest('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTransactionHistory', () => {
    it('should return paginated transaction history', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          type: TransactionType.DEPOSIT,
          amount: 104800,
          status: TransactionStatus.COMPLETED,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockTransactions, 1]),
      };
      mockTransactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTransactionHistory('user-123', {
        page: 1,
        limit: 20,
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('expireStaleRequests', () => {
    it('should update expired requests', async () => {
      mockPaymentRequestRepository.update.mockResolvedValue({ affected: 5 });

      const result = await service.expireStaleRequests();

      expect(result).toBe(5);
      expect(mockPaymentRequestRepository.update).toHaveBeenCalled();
    });
  });

  describe('isMpesaConfigured', () => {
    it('should delegate to mpesa service', () => {
      mockMpesaService.isConfigured.mockReturnValue(true);

      const result = service.isMpesaConfigured();

      expect(result).toBe(true);
      expect(mockMpesaService.isConfigured).toHaveBeenCalled();
    });
  });
});
