import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RefundService, CreateRefundInput } from './refund.service.js';
import { RiderRefund, RefundStatus, RefundPayoutMethod } from '../entities/rider-refund.entity.js';
import { PostingEngineService } from '../../accounting/services/posting-engine.service.js';
import { WalletService } from '../../payment/services/wallet.service.js';
import { MpesaService } from '../../payment/services/mpesa.service.js';
import { PAYMENT_AMOUNTS } from '../../accounting/config/posting-rules.config.js';

describe('RefundService', () => {
  let service: RefundService;
  let refundRepository: Repository<RiderRefund>;
  let postingEngineService: PostingEngineService;
  let walletService: WalletService;
  let mpesaService: MpesaService;

  const createMockRefund = (overrides: Partial<RiderRefund> = {}): Partial<RiderRefund> => ({
    id: 'refund-123',
    refundNumber: 'REF-20240115-ABCD',
    userId: 'user-123',
    policyId: 'policy-123',
    refundAmountCents: BigInt(94320), // 943.20 KES (90% of 1048)
    reversalFeeCents: BigInt(10480), // 104.80 KES (10% of 1048)
    originalAmountCents: BigInt(104800), // 1048 KES
    daysPaid: 0,
    status: RefundStatus.PENDING,
    payoutMethod: RefundPayoutMethod.MPESA,
    payoutPhone: '+254712345678',
    cancellationReason: 'User requested cancellation',
    createdAt: new Date(),
    updatedAt: new Date(),
    getRefundAmountInKes: () => 943.20,
    getReversalFeeInKes: () => 104.80,
    getOriginalAmountInKes: () => 1048,
    canApprove: () => (overrides.status ?? RefundStatus.PENDING) === RefundStatus.PENDING,
    canProcess: () => (overrides.status ?? RefundStatus.PENDING) === RefundStatus.APPROVED,
    ...overrides,
  });

  const mockRefundRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
  };

  const mockPostingEngineService = {
    postRefund: jest.fn(),
    postRefundPayout: jest.fn(),
  };

  const mockWalletService = {
    resetWalletForRefund: jest.fn(),
  };

  const mockMpesaService = {
    processRefund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: getRepositoryToken(RiderRefund), useValue: mockRefundRepository },
        { provide: PostingEngineService, useValue: mockPostingEngineService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: MpesaService, useValue: mockMpesaService },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
    refundRepository = module.get<Repository<RiderRefund>>(getRepositoryToken(RiderRefund));
    postingEngineService = module.get<PostingEngineService>(PostingEngineService);
    walletService = module.get<WalletService>(WalletService);
    mpesaService = module.get<MpesaService>(MpesaService);
    // Suppress unused variable warnings
    void refundRepository;
    void postingEngineService;
    void walletService;
    void mpesaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefund', () => {
    const createRefundInput: CreateRefundInput = {
      userId: 'user-123',
      policyId: 'policy-123',
      originalAmountCents: 104800, // 1048 KES
      daysPaid: 0,
      cancellationReason: 'User requested cancellation',
      payoutPhone: '+254712345678',
    };

    it('should create a refund with correct amounts', async () => {
      const mockRefund = createMockRefund();
      mockRefundRepository.create.mockReturnValue(mockRefund);
      mockRefundRepository.save.mockResolvedValue(mockRefund);
      mockPostingEngineService.postRefund.mockResolvedValue({
        success: true,
        journalEntryId: 'journal-123',
      });

      const result = await service.createRefund(createRefundInput);

      expect(mockRefundRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          policyId: 'policy-123',
          status: RefundStatus.PENDING,
          payoutMethod: RefundPayoutMethod.MPESA,
          payoutPhone: '+254712345678',
        }),
      );
      expect(mockPostingEngineService.postRefund).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should calculate refund amount as percentage of original', async () => {
      const mockRefund = createMockRefund();
      mockRefundRepository.create.mockImplementation((data) => ({
        ...mockRefund,
        ...data,
      }));
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));
      mockPostingEngineService.postRefund.mockResolvedValue({ success: true });

      await service.createRefund(createRefundInput);

      expect(mockRefundRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmountCents: BigInt(
            Math.floor((104800 * PAYMENT_AMOUNTS.REFUND_RIDER_PERCENT) / 100),
          ),
        }),
      );
    });
  });

  describe('getRefund', () => {
    it('should return refund when found', async () => {
      const mockRefund = createMockRefund();
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);

      const result = await service.getRefund('refund-123');

      expect(result).toEqual(mockRefund);
      expect(mockRefundRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'refund-123' },
        relations: ['policy'],
      });
    });

    it('should throw NotFoundException when refund not found', async () => {
      mockRefundRepository.findOne.mockResolvedValue(null);

      await expect(service.getRefund('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRefunds', () => {
    it('should return paginated refunds', async () => {
      const refunds = [createMockRefund(), createMockRefund({ id: 'refund-456' })];
      mockRefundRepository.findAndCount.mockResolvedValue([refunds, 2]);

      const result = await service.getRefunds({ page: 1, limit: 20 });

      expect(result.refunds).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRefundRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by status', async () => {
      mockRefundRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getRefunds({ status: RefundStatus.PENDING });

      expect(mockRefundRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: RefundStatus.PENDING },
        }),
      );
    });
  });

  describe('getPendingRefunds', () => {
    it('should return only pending refunds sorted by creation date', async () => {
      const pendingRefunds = [createMockRefund()];
      mockRefundRepository.find.mockResolvedValue(pendingRefunds);

      const result = await service.getPendingRefunds();

      expect(result).toEqual(pendingRefunds);
      expect(mockRefundRepository.find).toHaveBeenCalledWith({
        where: { status: RefundStatus.PENDING },
        order: { createdAt: 'ASC' },
        relations: ['policy'],
      });
    });
  });

  describe('getApprovedRefunds', () => {
    it('should return only approved refunds', async () => {
      const approvedRefunds = [createMockRefund({ status: RefundStatus.APPROVED })];
      mockRefundRepository.find.mockResolvedValue(approvedRefunds);

      const result = await service.getApprovedRefunds();

      expect(result).toEqual(approvedRefunds);
      expect(mockRefundRepository.find).toHaveBeenCalledWith({
        where: { status: RefundStatus.APPROVED },
        order: { approvedAt: 'ASC' },
        relations: ['policy'],
      });
    });
  });

  describe('approveRefund', () => {
    it('should approve a pending refund', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.PENDING });
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.approveRefund('refund-123', 'admin-user');

      expect(result.status).toBe(RefundStatus.APPROVED);
      expect(result.approvedBy).toBe('admin-user');
      expect(result.approvedAt).toBeDefined();
    });

    it('should throw BadRequestException for non-pending refund', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.APPROVED });
      mockRefund.canApprove = () => false;
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);

      await expect(service.approveRefund('refund-123', 'admin-user')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('processRefund', () => {
    it('should process an approved refund', async () => {
      const mockRefund = createMockRefund({
        status: RefundStatus.APPROVED,
        payoutPhone: '+254712345678',
      });
      mockRefund.canProcess = () => true;
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));
      mockMpesaService.processRefund.mockResolvedValue({
        success: true,
        conversationId: 'AG_123456_abcdef',
      });

      const result = await service.processRefund('refund-123', 'admin-user');

      expect(result.status).toBe(RefundStatus.PROCESSING);
      expect(result.processedBy).toBe('admin-user');
      expect(result.processedAt).toBeDefined();
      expect(mockMpesaService.processRefund).toHaveBeenCalledWith({
        phone: '+254712345678',
        amount: 943.20,
        reason: expect.stringContaining('Refund'),
        transactionRef: 'refund-123',
      });
    });

    it('should throw BadRequestException for non-approved refund', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.PENDING });
      mockRefund.canProcess = () => false;
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);

      await expect(service.processRefund('refund-123', 'admin-user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if no payout phone', async () => {
      const mockRefund = createMockRefund({
        status: RefundStatus.APPROVED,
        payoutPhone: undefined,
      });
      mockRefund.canProcess = () => true;
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);

      await expect(service.processRefund('refund-123', 'admin-user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle M-Pesa failure gracefully', async () => {
      const mockRefund = createMockRefund({
        status: RefundStatus.APPROVED,
        payoutPhone: '+254712345678',
        metadata: {},
      });
      mockRefund.canProcess = () => true;
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));
      mockMpesaService.processRefund.mockResolvedValue({
        success: false,
        errorMessage: 'Insufficient balance',
        errorCode: 'ERR_001',
      });

      const result = await service.processRefund('refund-123', 'admin-user');

      expect(result.status).toBe(RefundStatus.PROCESSING);
      expect(result.mpesaConversationId).toContain('FAILED');
      expect(result.metadata).toHaveProperty('lastMpesaError', 'Insufficient balance');
    });
  });

  describe('completeRefund', () => {
    it('should complete a processing refund', async () => {
      const mockRefund = createMockRefund({
        status: RefundStatus.PROCESSING,
        processedBy: 'admin-user',
      });
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));
      mockPostingEngineService.postRefundPayout.mockResolvedValue({
        success: true,
        journalEntryId: 'payout-journal-123',
        entryNumber: 'JE-2024-001',
      });
      mockWalletService.resetWalletForRefund.mockResolvedValue(undefined);

      const result = await service.completeRefund('refund-123', 'MPESA123456');

      expect(result.status).toBe(RefundStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(result.mpesaTransactionId).toBe('MPESA123456');
      expect(mockWalletService.resetWalletForRefund).toHaveBeenCalledWith(
        'user-123',
        expect.stringContaining('Wallet reset'),
      );
    });

    it('should throw BadRequestException for non-processing refund', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.APPROVED });
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);

      await expect(service.completeRefund('refund-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('failRefund', () => {
    it('should mark refund as failed with reason', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.PROCESSING });
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.failRefund('refund-123', 'M-Pesa timeout');

      expect(result.status).toBe(RefundStatus.FAILED);
      expect(result.failureReason).toBe('M-Pesa timeout');
    });
  });

  describe('cancelRefund', () => {
    it('should cancel a pending refund', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.PENDING });
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);
      mockRefundRepository.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.cancelRefund('refund-123', 'User changed mind');

      expect(result.status).toBe(RefundStatus.CANCELLED);
      expect(result.failureReason).toBe('User changed mind');
    });

    it('should throw BadRequestException for non-pending refund', async () => {
      const mockRefund = createMockRefund({ status: RefundStatus.APPROVED });
      mockRefundRepository.findOne.mockResolvedValue(mockRefund);

      await expect(service.cancelRefund('refund-123', 'Reason')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRefundStats', () => {
    it('should return correct statistics', async () => {
      mockRefundRepository.count
        .mockResolvedValueOnce(5) // PENDING
        .mockResolvedValueOnce(3) // APPROVED
        .mockResolvedValueOnce(2) // PROCESSING
        .mockResolvedValueOnce(10) // COMPLETED
        .mockResolvedValueOnce(1); // FAILED

      mockRefundRepository.find.mockResolvedValue([
        createMockRefund({
          status: RefundStatus.COMPLETED,
          refundAmountCents: BigInt(100000),
          reversalFeeCents: BigInt(10000),
        }),
        createMockRefund({
          status: RefundStatus.COMPLETED,
          refundAmountCents: BigInt(200000),
          reversalFeeCents: BigInt(20000),
        }),
      ]);

      const result = await service.getRefundStats();

      expect(result.pending).toBe(5);
      expect(result.approved).toBe(3);
      expect(result.processing).toBe(2);
      expect(result.completed).toBe(10);
      expect(result.failed).toBe(1);
      expect(result.totalRefundedAmount).toBe(3000); // (100000 + 200000) / 100
      expect(result.totalReversalFees).toBe(300); // (10000 + 20000) / 100
    });
  });

  describe('getUserRefunds', () => {
    it('should return refunds for a specific user', async () => {
      const userRefunds = [
        createMockRefund({ userId: 'user-123' }),
        createMockRefund({ userId: 'user-123', id: 'refund-456' }),
      ];
      mockRefundRepository.find.mockResolvedValue(userRefunds);

      const result = await service.getUserRefunds('user-123');

      expect(result).toHaveLength(2);
      expect(mockRefundRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: { createdAt: 'DESC' },
        relations: ['policy'],
      });
    });
  });
});
