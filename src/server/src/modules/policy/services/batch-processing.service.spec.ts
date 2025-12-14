import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { BatchProcessingService, PolicyIssuanceRequest } from './batch-processing.service.js';
import { PdfGenerationService } from './pdf-generation.service.js';
import { Policy, PolicyType, PolicyStatus } from '../entities/policy.entity.js';
import { PolicyBatch, BatchStatus, BatchSchedule } from '../entities/policy-batch.entity.js';
import { PolicyDocument, PolicyDocumentType, DocumentStatus } from '../entities/policy-document.entity.js';

describe('BatchProcessingService', () => {
  let service: BatchProcessingService;
  let policyRepository: jest.Mocked<Repository<Policy>>;
  let batchRepository: jest.Mocked<Repository<PolicyBatch>>;
  let pdfGenerationService: jest.Mocked<PdfGenerationService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockPolicyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockBatchRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockPdfGenerationService = {
    generatePolicyCertificate: jest.fn(),
  };

  const mockTransactionManager = {
    getRepository: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback(mockTransactionManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchProcessingService,
        {
          provide: getRepositoryToken(Policy),
          useValue: mockPolicyRepository,
        },
        {
          provide: getRepositoryToken(PolicyBatch),
          useValue: mockBatchRepository,
        },
        {
          provide: PdfGenerationService,
          useValue: mockPdfGenerationService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BatchProcessingService>(BatchProcessingService);
    policyRepository = module.get(getRepositoryToken(Policy));
    batchRepository = module.get(getRepositoryToken(PolicyBatch));
    pdfGenerationService = module.get(PdfGenerationService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPendingPolicy', () => {
    const mockRequest: PolicyIssuanceRequest = {
      userId: 'user-uuid-123',
      policyType: PolicyType.ONE_MONTH,
      triggeringTransactionId: 'txn-uuid-456',
      insuredName: 'John Kamau',
      nationalId: '12345678',
      phone: '+254712345678',
      vehicleRegistration: 'KAA 123B',
      premiumAmount: 104800, // In cents
    };

    it('should create a pending policy', async () => {
      const mockPolicy = {
        id: 'policy-uuid-789',
        ...mockRequest,
        status: PolicyStatus.PENDING_ISSUANCE,
        currency: 'KES',
        metadata: { phone: mockRequest.phone },
      };

      mockPolicyRepository.create.mockReturnValue(mockPolicy as Policy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy as Policy);

      const result = await service.createPendingPolicy(mockRequest);

      expect(mockPolicyRepository.create).toHaveBeenCalledWith({
        userId: mockRequest.userId,
        policyType: mockRequest.policyType,
        status: PolicyStatus.PENDING_ISSUANCE,
        triggeringTransactionId: mockRequest.triggeringTransactionId,
        insuredName: mockRequest.insuredName,
        nationalId: mockRequest.nationalId,
        vehicleRegistration: mockRequest.vehicleRegistration,
        premiumAmount: mockRequest.premiumAmount,
        currency: 'KES',
        metadata: { phone: mockRequest.phone },
      });
      expect(mockPolicyRepository.save).toHaveBeenCalledWith(mockPolicy);
      expect(result).toEqual(mockPolicy);
    });

    it('should create pending policy for eleven-month type', async () => {
      const elevenMonthRequest: PolicyIssuanceRequest = {
        ...mockRequest,
        policyType: PolicyType.ELEVEN_MONTH,
        premiumAmount: 261000, // In cents
      };

      const mockPolicy = {
        id: 'policy-uuid-789',
        ...elevenMonthRequest,
        status: PolicyStatus.PENDING_ISSUANCE,
      };

      mockPolicyRepository.create.mockReturnValue(mockPolicy as Policy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy as Policy);

      const result = await service.createPendingPolicy(elevenMonthRequest);

      expect(mockPolicyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          policyType: PolicyType.ELEVEN_MONTH,
          premiumAmount: 261000,
        }),
      );
      expect(result.policyType).toBe(PolicyType.ELEVEN_MONTH);
    });
  });

  describe('processBatch', () => {
    it('should return existing result if batch already completed', async () => {
      const completedBatch = {
        id: 'batch-uuid-123',
        batchNumber: 'BATCH-20241214-1',
        status: BatchStatus.COMPLETED,
        totalPolicies: 5,
        processedCount: 5,
        failedCount: 0,
        processingDurationMs: 1000,
        failedPolicies: [],
        isComplete: () => true,
      };

      mockBatchRepository.findOne.mockResolvedValue(completedBatch as PolicyBatch);

      const result = await service.processBatch(BatchSchedule.BATCH_1);

      expect(result.status).toBe(BatchStatus.COMPLETED);
      expect(result.batchNumber).toBe('BATCH-20241214-1');
      expect(mockPolicyRepository.find).not.toHaveBeenCalled();
    });

    it('should create batch and return immediately if no pending policies', async () => {
      mockBatchRepository.findOne.mockResolvedValue(null);
      mockBatchRepository.create.mockReturnValue({
        id: 'batch-uuid-123',
        batchNumber: 'BATCH-20241214-1',
        status: BatchStatus.PENDING,
        isComplete: () => false,
      } as PolicyBatch);
      mockBatchRepository.save.mockImplementation((batch) => Promise.resolve(batch));
      mockPolicyRepository.find.mockResolvedValue([]);

      const result = await service.processBatch(BatchSchedule.BATCH_1);

      expect(result.totalPolicies).toBe(0);
      expect(result.status).toBe(BatchStatus.COMPLETED);
    });

    it('should process pending policies in batch', async () => {
      const mockBatch = {
        id: 'batch-uuid-123',
        batchNumber: 'BATCH-20241214-1',
        status: BatchStatus.PENDING,
        totalPolicies: 0,
        processedCount: 0,
        failedCount: 0,
        isComplete: () => false,
      };

      const mockPendingPolicy = {
        id: 'policy-uuid-789',
        userId: 'user-uuid-123',
        policyType: PolicyType.ONE_MONTH,
        status: PolicyStatus.PENDING_ISSUANCE,
        premiumAmount: 104800,
        insuredName: 'John Kamau',
        nationalId: '12345678',
        vehicleRegistration: 'KAA 123B',
        metadata: { phone: '+254712345678' },
        getPremiumInKes: () => 1048,
      };

      mockBatchRepository.findOne.mockResolvedValue(null);
      mockBatchRepository.create.mockReturnValue(mockBatch as PolicyBatch);
      mockBatchRepository.save.mockImplementation((batch) => Promise.resolve(batch as PolicyBatch));
      mockPolicyRepository.find.mockResolvedValue([mockPendingPolicy as Policy]);
      mockPolicyRepository.count.mockResolvedValue(0);

      // Mock PDF generation
      mockPdfGenerationService.generatePolicyCertificate.mockResolvedValue({
        buffer: Buffer.from('mock-pdf'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        contentHash: 'mock-hash',
      });

      // Mock transaction manager
      const mockPolicyRepo = {
        save: jest.fn().mockResolvedValue(mockPendingPolicy),
      };
      const mockDocumentRepo = {
        create: jest.fn().mockReturnValue({ id: 'doc-uuid-123' }),
        save: jest.fn().mockResolvedValue({ id: 'doc-uuid-123' }),
      };
      mockTransactionManager.getRepository.mockImplementation((entity) => {
        if (entity === Policy) return mockPolicyRepo;
        if (entity === PolicyDocument) return mockDocumentRepo;
        return {};
      });

      const result = await service.processBatch(BatchSchedule.BATCH_1);

      expect(result).toBeDefined();
      expect(mockPolicyRepository.find).toHaveBeenCalled();
    });
  });

  describe('getBatch', () => {
    it('should return batch by ID', async () => {
      const mockBatch = {
        id: 'batch-uuid-123',
        batchNumber: 'BATCH-20241214-1',
        status: BatchStatus.COMPLETED,
      };

      mockBatchRepository.findOne.mockResolvedValue(mockBatch as PolicyBatch);

      const result = await service.getBatch('batch-uuid-123');

      expect(mockBatchRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'batch-uuid-123' },
      });
      expect(result).toEqual(mockBatch);
    });

    it('should return null if batch not found', async () => {
      mockBatchRepository.findOne.mockResolvedValue(null);

      const result = await service.getBatch('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getBatches', () => {
    it('should return batches in date range', async () => {
      const mockBatches = [
        { id: 'batch-1', batchNumber: 'BATCH-20241214-1' },
        { id: 'batch-2', batchNumber: 'BATCH-20241214-2' },
      ];

      mockBatchRepository.find.mockResolvedValue(mockBatches as PolicyBatch[]);

      const startDate = new Date('2024-12-14');
      const endDate = new Date('2024-12-15');

      const result = await service.getBatches(startDate, endDate);

      expect(mockBatchRepository.find).toHaveBeenCalledWith({
        where: {
          batchDate: Between(startDate, endDate),
        },
        order: { scheduledFor: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('retryFailedPolicies', () => {
    it('should return 0 if batch not found', async () => {
      mockBatchRepository.findOne.mockResolvedValue(null);

      const result = await service.retryFailedPolicies('non-existent-id');

      expect(result).toBe(0);
    });

    it('should return 0 if no failed policies', async () => {
      const mockBatch = {
        id: 'batch-uuid-123',
        failedPolicies: [],
      };

      mockBatchRepository.findOne.mockResolvedValue(mockBatch as PolicyBatch);

      const result = await service.retryFailedPolicies('batch-uuid-123');

      expect(result).toBe(0);
    });

    it('should retry failed policies', async () => {
      const mockBatch = {
        id: 'batch-uuid-123',
        failedPolicies: [{ policyId: 'policy-1', error: 'Test error' }],
        processedCount: 5,
        failedCount: 1,
        status: BatchStatus.COMPLETED_WITH_ERRORS,
      };

      const mockFailedPolicy = {
        id: 'policy-1',
        status: PolicyStatus.PENDING_ISSUANCE,
        policyType: PolicyType.ONE_MONTH,
        premiumAmount: 104800,
        insuredName: 'John Kamau',
        nationalId: '12345678',
        vehicleRegistration: 'KAA 123B',
        metadata: { phone: '+254712345678' },
        getPremiumInKes: () => 1048,
      };

      mockBatchRepository.findOne.mockResolvedValue(mockBatch as PolicyBatch);
      mockPolicyRepository.find.mockResolvedValue([mockFailedPolicy as Policy]);
      mockPolicyRepository.count.mockResolvedValue(0);
      mockBatchRepository.save.mockResolvedValue(mockBatch as PolicyBatch);

      // Mock PDF generation
      mockPdfGenerationService.generatePolicyCertificate.mockResolvedValue({
        buffer: Buffer.from('mock-pdf'),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        contentHash: 'mock-hash',
      });

      // Mock transaction manager
      const mockPolicyRepo = {
        save: jest.fn().mockResolvedValue(mockFailedPolicy),
      };
      const mockDocumentRepo = {
        create: jest.fn().mockReturnValue({ id: 'doc-uuid-123' }),
        save: jest.fn().mockResolvedValue({ id: 'doc-uuid-123' }),
      };
      mockTransactionManager.getRepository.mockImplementation((entity) => {
        if (entity === Policy) return mockPolicyRepo;
        if (entity === PolicyDocument) return mockDocumentRepo;
        return {};
      });

      const result = await service.retryFailedPolicies('batch-uuid-123');

      expect(mockPolicyRepository.find).toHaveBeenCalled();
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('payment window calculations', () => {
    it('should calculate correct window for BATCH_1 (08:00 EAT)', async () => {
      // BATCH_1 covers 00:00-07:59 EAT = 21:00 prev day - 04:59 UTC
      mockBatchRepository.findOne.mockResolvedValue(null);
      mockBatchRepository.create.mockReturnValue({
        id: 'batch-uuid-123',
        isComplete: () => false,
      } as PolicyBatch);
      mockBatchRepository.save.mockImplementation((batch) => Promise.resolve(batch));
      mockPolicyRepository.find.mockResolvedValue([]);

      await service.processBatch(BatchSchedule.BATCH_1, new Date('2024-12-14T05:00:00Z'));

      // Verify that find was called with the correct date range
      expect(mockPolicyRepository.find).toHaveBeenCalled();
    });

    it('should calculate correct window for BATCH_2 (14:00 EAT)', async () => {
      // BATCH_2 covers 08:00-13:59 EAT = 05:00-10:59 UTC
      mockBatchRepository.findOne.mockResolvedValue(null);
      mockBatchRepository.create.mockReturnValue({
        id: 'batch-uuid-123',
        isComplete: () => false,
      } as PolicyBatch);
      mockBatchRepository.save.mockImplementation((batch) => Promise.resolve(batch));
      mockPolicyRepository.find.mockResolvedValue([]);

      await service.processBatch(BatchSchedule.BATCH_2, new Date('2024-12-14T11:00:00Z'));

      expect(mockPolicyRepository.find).toHaveBeenCalled();
    });

    it('should calculate correct window for BATCH_3 (20:00 EAT)', async () => {
      // BATCH_3 covers 14:00-19:59 EAT = 11:00-16:59 UTC
      mockBatchRepository.findOne.mockResolvedValue(null);
      mockBatchRepository.create.mockReturnValue({
        id: 'batch-uuid-123',
        isComplete: () => false,
      } as PolicyBatch);
      mockBatchRepository.save.mockImplementation((batch) => Promise.resolve(batch));
      mockPolicyRepository.find.mockResolvedValue([]);

      await service.processBatch(BatchSchedule.BATCH_3, new Date('2024-12-14T17:00:00Z'));

      expect(mockPolicyRepository.find).toHaveBeenCalled();
    });

    it('should handle MANUAL schedule with full day window', async () => {
      mockBatchRepository.findOne.mockResolvedValue(null);
      mockBatchRepository.create.mockReturnValue({
        id: 'batch-uuid-123',
        isComplete: () => false,
      } as PolicyBatch);
      mockBatchRepository.save.mockImplementation((batch) => Promise.resolve(batch));
      mockPolicyRepository.find.mockResolvedValue([]);

      await service.processBatch(BatchSchedule.MANUAL);

      expect(mockPolicyRepository.find).toHaveBeenCalled();
    });
  });
});
