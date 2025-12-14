import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PolicyService } from './policy.service.js';
import { BatchProcessingService, PolicyIssuanceRequest } from './batch-processing.service.js';
import { Policy, PolicyType, PolicyStatus } from '../entities/policy.entity.js';
import { PolicyDocument, DocumentStatus } from '../entities/policy-document.entity.js';

describe('PolicyService', () => {
  let service: PolicyService;
  let policyRepository: jest.Mocked<Repository<Policy>>;
  let documentRepository: jest.Mocked<Repository<PolicyDocument>>;
  let batchProcessingService: jest.Mocked<BatchProcessingService>;

  const mockPolicyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockBatchProcessingService = {
    createPendingPolicy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        {
          provide: getRepositoryToken(Policy),
          useValue: mockPolicyRepository,
        },
        {
          provide: getRepositoryToken(PolicyDocument),
          useValue: mockDocumentRepository,
        },
        {
          provide: BatchProcessingService,
          useValue: mockBatchProcessingService,
        },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    policyRepository = module.get(getRepositoryToken(Policy));
    documentRepository = module.get(getRepositoryToken(PolicyDocument));
    batchProcessingService = module.get(BatchProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queuePolicyIssuance', () => {
    it('should queue a policy for issuance via batch processing service', async () => {
      const request: PolicyIssuanceRequest = {
        userId: 'user-uuid-123',
        policyType: PolicyType.ONE_MONTH,
        triggeringTransactionId: 'txn-uuid-456',
        insuredName: 'John Kamau',
        nationalId: '12345678',
        phone: '+254712345678',
        vehicleRegistration: 'KAA 123B',
        premiumAmount: 104800,
      };

      const mockPolicy = {
        id: 'policy-uuid-789',
        ...request,
        status: PolicyStatus.PENDING_ISSUANCE,
      };

      mockBatchProcessingService.createPendingPolicy.mockResolvedValue(mockPolicy as Policy);

      const result = await service.queuePolicyIssuance(request);

      expect(mockBatchProcessingService.createPendingPolicy).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockPolicy);
    });
  });

  describe('getUserPolicies', () => {
    it('should return policies for a user with document availability', async () => {
      const userId = 'user-uuid-123';
      const mockPolicies = [
        {
          id: 'policy-1',
          userId,
          policyNumber: 'BDA-2412-000001',
          policyType: PolicyType.ONE_MONTH,
          status: PolicyStatus.ACTIVE,
          coverageStart: new Date('2024-12-01'),
          coverageEnd: new Date('2025-01-01'),
          premiumAmount: 104800,
          getDaysUntilExpiry: () => 15,
          getPremiumInKes: () => 1048,
          isActive: () => true,
        },
        {
          id: 'policy-2',
          userId,
          policyNumber: 'BDB-2412-000001',
          policyType: PolicyType.ELEVEN_MONTH,
          status: PolicyStatus.EXPIRED,
          coverageStart: new Date('2024-01-01'),
          coverageEnd: new Date('2024-12-01'),
          premiumAmount: 261000,
          getDaysUntilExpiry: () => -14,
          getPremiumInKes: () => 2610,
          isActive: () => false,
        },
      ];

      mockPolicyRepository.find.mockResolvedValue(mockPolicies as Policy[]);
      mockDocumentRepository.find.mockResolvedValue([
        { policyId: 'policy-1' } as PolicyDocument,
      ]);

      const result = await service.getUserPolicies(userId);

      expect(mockPolicyRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].documentAvailable).toBe(true);
      expect(result[1].documentAvailable).toBe(false);
    });

    it('should return empty array if user has no policies', async () => {
      mockPolicyRepository.find.mockResolvedValue([]);
      mockDocumentRepository.find.mockResolvedValue([]);

      const result = await service.getUserPolicies('user-uuid-123');

      expect(result).toEqual([]);
    });
  });

  describe('getActivePolicy', () => {
    it('should return the active policy for a user', async () => {
      const userId = 'user-uuid-123';
      const mockPolicy = {
        id: 'policy-1',
        userId,
        policyNumber: 'BDA-2412-000001',
        policyType: PolicyType.ONE_MONTH,
        status: PolicyStatus.ACTIVE,
        coverageStart: new Date('2024-12-01'),
        coverageEnd: new Date('2025-01-01'),
        premiumAmount: 104800,
        getDaysUntilExpiry: () => 15,
        getPremiumInKes: () => 1048,
        isActive: () => true,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockDocumentRepository.findOne.mockResolvedValue({ id: 'doc-1' } as PolicyDocument);

      const result = await service.getActivePolicy(userId);

      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId,
          status: In([PolicyStatus.ACTIVE, PolicyStatus.EXPIRING]),
        },
        order: { coverageEnd: 'DESC' },
      });
      expect(result).not.toBeNull();
      expect(result?.documentAvailable).toBe(true);
    });

    it('should return null if no active policy', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      const result = await service.getActivePolicy('user-uuid-123');

      expect(result).toBeNull();
    });
  });

  describe('getPolicyDetails', () => {
    it('should return policy details for authorized user', async () => {
      const userId = 'user-uuid-123';
      const policyId = 'policy-uuid-789';

      const mockPolicy = {
        id: policyId,
        userId,
        policyNumber: 'BDA-2412-000001',
        policyType: PolicyType.ONE_MONTH,
        status: PolicyStatus.ACTIVE,
        coverageStart: new Date('2024-12-01'),
        coverageEnd: new Date('2025-01-01'),
        premiumAmount: 104800,
        insuredName: 'John Kamau',
        vehicleRegistration: 'KAA 123B',
        issuedAt: new Date('2024-12-01'),
        createdAt: new Date('2024-12-01'),
        getDaysUntilExpiry: () => 15,
        getPremiumInKes: () => 1048,
        isActive: () => true,
      };

      const mockDocument = {
        id: 'doc-uuid-123',
        policyId,
        fileName: 'policy.pdf',
        downloadUrl: 'https://example.com/policy.pdf',
        generatedAt: new Date('2024-12-01'),
        hasValidDownloadUrl: () => true,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument as PolicyDocument);

      const result = await service.getPolicyDetails(policyId, userId);

      expect(result.id).toBe(policyId);
      expect(result.policyNumber).toBe('BDA-2412-000001');
      expect(result.insuredName).toBe('John Kamau');
      expect(result.document).toBeDefined();
      expect(result.document?.fileName).toBe('policy.pdf');
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPolicyDetails('non-existent-id', 'user-uuid-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not own policy', async () => {
      const mockPolicy = {
        id: 'policy-uuid-789',
        userId: 'different-user-id',
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);

      await expect(
        service.getPolicyDetails('policy-uuid-789', 'user-uuid-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPolicyDocument', () => {
    it('should return document and update download count', async () => {
      const userId = 'user-uuid-123';
      const policyId = 'policy-uuid-789';

      const mockPolicy = {
        id: policyId,
        userId,
      };

      const mockDocument = {
        id: 'doc-uuid-123',
        policyId,
        downloadCount: 5,
        lastDownloadedAt: null,
        status: DocumentStatus.GENERATED,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument as PolicyDocument);
      mockDocumentRepository.save.mockResolvedValue({
        ...mockDocument,
        downloadCount: 6,
        lastDownloadedAt: new Date(),
      } as PolicyDocument);

      const result = await service.getPolicyDocument(policyId, userId);

      expect(result).toBeDefined();
      expect(mockDocumentRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if policy not found or not owned', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPolicyDocument('policy-uuid-789', 'user-uuid-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if document not generated', async () => {
      const mockPolicy = {
        id: 'policy-uuid-789',
        userId: 'user-uuid-123',
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPolicyDocument('policy-uuid-789', 'user-uuid-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getExpiringPolicies', () => {
    it('should return policies expiring within given days', async () => {
      const mockPolicies = [
        { id: 'policy-1', status: PolicyStatus.EXPIRING },
        { id: 'policy-2', status: PolicyStatus.ACTIVE },
      ];

      mockPolicyRepository.find.mockResolvedValue(mockPolicies as Policy[]);

      const result = await service.getExpiringPolicies(7);

      expect(mockPolicyRepository.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('updateExpiringPolicies', () => {
    it('should update active policies to EXPIRING status', async () => {
      mockPolicyRepository.update.mockResolvedValue({ affected: 5 });

      const result = await service.updateExpiringPolicies();

      expect(mockPolicyRepository.update).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should return 0 if no policies to update', async () => {
      mockPolicyRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.updateExpiringPolicies();

      expect(result).toBe(0);
    });
  });

  describe('expirePolicies', () => {
    it('should update expired policies to EXPIRED status', async () => {
      mockPolicyRepository.update.mockResolvedValue({ affected: 3 });

      const result = await service.expirePolicies();

      expect(mockPolicyRepository.update).toHaveBeenCalled();
      expect(result).toBe(3);
    });
  });

  describe('cancelPolicy', () => {
    it('should cancel an active policy', async () => {
      const userId = 'user-uuid-123';
      const policyId = 'policy-uuid-789';

      const mockPolicy = {
        id: policyId,
        userId,
        policyNumber: 'BDA-2412-000001',
        status: PolicyStatus.ACTIVE,
        issuedAt: new Date(),
        metadata: {},
        isActive: () => true,
        isPending: () => false,
        getPremiumInKes: () => 1048,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as unknown as Policy);
      mockPolicyRepository.save.mockImplementation(async (policy) => policy as Policy);

      const result = await service.cancelPolicy(policyId, userId, 'User requested');

      expect(result.policy.status).toBe(PolicyStatus.CANCELLED);
      expect(result.refundEligible).toBeDefined();
      expect(result.message).toBeDefined();
      expect(mockPolicyRepository.save).toHaveBeenCalled();
    });

    it('should cancel a pending policy', async () => {
      const mockPolicy = {
        id: 'policy-uuid-789',
        userId: 'user-uuid-123',
        status: PolicyStatus.PENDING_ISSUANCE,
        issuedAt: null,
        metadata: {},
        isActive: () => false,
        isPending: () => true,
        getPremiumInKes: () => 1048,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as unknown as Policy);
      mockPolicyRepository.save.mockImplementation(async (policy) => policy as Policy);

      const result = await service.cancelPolicy('policy-uuid-789', 'user-uuid-123', 'Changed mind');

      expect(result.policy.status).toBe(PolicyStatus.CANCELLED);
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancelPolicy('non-existent-id', 'user-uuid-123', 'Reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if policy cannot be cancelled', async () => {
      const mockPolicy = {
        id: 'policy-uuid-789',
        userId: 'user-uuid-123',
        status: PolicyStatus.EXPIRED,
        isActive: () => false,
        isPending: () => false,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);

      await expect(
        service.cancelPolicy('policy-uuid-789', 'user-uuid-123', 'Reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('hasActivePolicy', () => {
    it('should return true if user has active policy', async () => {
      mockPolicyRepository.count.mockResolvedValue(1);

      const result = await service.hasActivePolicy('user-uuid-123');

      expect(result).toBe(true);
    });

    it('should return false if user has no active policy', async () => {
      mockPolicyRepository.count.mockResolvedValue(0);

      const result = await service.hasActivePolicy('user-uuid-123');

      expect(result).toBe(false);
    });

    it('should filter by policy type when specified', async () => {
      mockPolicyRepository.count.mockResolvedValue(1);

      await service.hasActivePolicy('user-uuid-123', PolicyType.ONE_MONTH);

      expect(mockPolicyRepository.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          policyType: PolicyType.ONE_MONTH,
        }),
      });
    });
  });

  describe('getUserPolicyStats', () => {
    it('should return policy statistics for user', async () => {
      const userId = 'user-uuid-123';
      const mockPolicies = [
        {
          id: 'policy-1',
          policyType: PolicyType.ONE_MONTH,
          status: PolicyStatus.ACTIVE,
          isActive: () => true,
          getPremiumInKes: () => 1048,
        },
        {
          id: 'policy-2',
          policyType: PolicyType.ELEVEN_MONTH,
          status: PolicyStatus.EXPIRED,
          isActive: () => false,
          getPremiumInKes: () => 2610,
        },
        {
          id: 'policy-3',
          policyType: PolicyType.ONE_MONTH,
          status: PolicyStatus.CANCELLED,
          isActive: () => false,
          getPremiumInKes: () => 1048,
        },
      ];

      mockPolicyRepository.find.mockResolvedValue(mockPolicies as Policy[]);

      const result = await service.getUserPolicyStats(userId);

      expect(result.totalPolicies).toBe(3);
      expect(result.activePolicies).toBe(1);
      expect(result.expiredPolicies).toBe(1);
      expect(result.totalPremiumPaid).toBe(1048 + 2610); // Excludes cancelled
      expect(result.currentCoverage.oneMonth).toBe(true);
      expect(result.currentCoverage.elevenMonth).toBe(false);
    });

    it('should return zero stats for user with no policies', async () => {
      mockPolicyRepository.find.mockResolvedValue([]);

      const result = await service.getUserPolicyStats('user-uuid-123');

      expect(result.totalPolicies).toBe(0);
      expect(result.activePolicies).toBe(0);
      expect(result.expiredPolicies).toBe(0);
      expect(result.totalPremiumPaid).toBe(0);
      expect(result.currentCoverage.oneMonth).toBe(false);
      expect(result.currentCoverage.elevenMonth).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return policy when found', async () => {
      const policyId = 'policy-uuid-123';
      const mockPolicy = {
        id: policyId,
        policyNumber: 'BDA-2412-000001',
        status: PolicyStatus.ACTIVE,
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);

      const result = await service.findById(policyId);

      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: policyId },
      });
      expect(result).toEqual(mockPolicy);
    });

    it('should return null when policy not found', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('updatePolicyStatus', () => {
    it('should update policy status to EXPIRED', async () => {
      const policyId = 'policy-uuid-123';
      const mockPolicy = {
        id: policyId,
        status: PolicyStatus.ACTIVE,
        metadata: {},
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockPolicyRepository.save.mockResolvedValue({
        ...mockPolicy,
        status: PolicyStatus.EXPIRED,
        metadata: { expiredAt: expect.any(String) },
      } as Policy);

      const result = await service.updatePolicyStatus(policyId, PolicyStatus.EXPIRED);

      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: policyId },
      });
      expect(mockPolicyRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(PolicyStatus.EXPIRED);
    });

    it('should update policy status to LAPSED', async () => {
      const policyId = 'policy-uuid-456';
      const mockPolicy = {
        id: policyId,
        status: PolicyStatus.EXPIRING,
        metadata: {},
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockPolicyRepository.save.mockResolvedValue({
        ...mockPolicy,
        status: PolicyStatus.LAPSED,
        metadata: { lapsedAt: expect.any(String) },
      } as Policy);

      const result = await service.updatePolicyStatus(policyId, PolicyStatus.LAPSED);

      expect(result.status).toBe(PolicyStatus.LAPSED);
    });

    it('should store status change timestamp in metadata', async () => {
      const policyId = 'policy-uuid-789';
      const mockPolicy = {
        id: policyId,
        status: PolicyStatus.ACTIVE,
        metadata: { existingKey: 'existingValue' },
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
      mockPolicyRepository.save.mockImplementation(async (policy: Policy) => policy);

      await service.updatePolicyStatus(policyId, PolicyStatus.EXPIRED);

      expect(mockPolicyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            existingKey: 'existingValue',
            expiredAt: expect.any(String),
          }),
        }),
      );
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePolicyStatus('non-existent-id', PolicyStatus.EXPIRED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle various status transitions', async () => {
      const statusTransitions = [
        { from: PolicyStatus.PENDING_ISSUANCE, to: PolicyStatus.ACTIVE },
        { from: PolicyStatus.ACTIVE, to: PolicyStatus.EXPIRING },
        { from: PolicyStatus.EXPIRING, to: PolicyStatus.EXPIRED },
        { from: PolicyStatus.EXPIRED, to: PolicyStatus.LAPSED },
        { from: PolicyStatus.ACTIVE, to: PolicyStatus.CANCELLED },
      ];

      for (const { from, to } of statusTransitions) {
        const mockPolicy = {
          id: 'policy-123',
          status: from,
          metadata: {},
        };

        mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
        mockPolicyRepository.save.mockResolvedValue({
          ...mockPolicy,
          status: to,
        } as Policy);

        const result = await service.updatePolicyStatus('policy-123', to);

        expect(result.status).toBe(to);
      }
    });
  });

  describe('Free Look Period (CR-IRA-002)', () => {
    describe('isWithinFreeLookPeriod', () => {
      it('should return true for policy issued within 30 days', () => {
        const policy = {
          issuedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        } as Policy;

        const result = service.isWithinFreeLookPeriod(policy);

        expect(result).toBe(true);
      });

      it('should return true for policy issued exactly 30 days ago', () => {
        const policy = {
          issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        } as Policy;

        const result = service.isWithinFreeLookPeriod(policy);

        expect(result).toBe(true);
      });

      it('should return false for policy issued more than 30 days ago', () => {
        const policy = {
          issuedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        } as Policy;

        const result = service.isWithinFreeLookPeriod(policy);

        expect(result).toBe(false);
      });

      it('should return false for policy with no issuedAt date', () => {
        const policy = {
          issuedAt: null,
        } as unknown as Policy;

        const result = service.isWithinFreeLookPeriod(policy);

        expect(result).toBe(false);
      });
    });

    describe('cancelPolicy with free look period', () => {
      it('should provide full refund within free look period', async () => {
        const policyId = 'policy-free-look';
        const userId = 'user-123';
        const mockPolicy = {
          id: policyId,
          userId,
          status: PolicyStatus.ACTIVE,
          issuedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          policyNumber: 'BDA-2412-000001',
          premiumAmount: 104800, // 1048 KES in cents
          metadata: {},
          isActive: () => true,
          isPending: () => false,
          getPremiumInKes: () => 1048,
        };

        mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
        mockPolicyRepository.save.mockResolvedValue({
          ...mockPolicy,
          status: PolicyStatus.CANCELLED,
        } as Policy);

        const result = await service.cancelPolicy(policyId, userId, 'Changed mind');

        expect(result.refundEligible).toBe(true);
        expect(result.refundAmount).toBe(1048);
        expect(result.message).toContain('free look period');
        expect(result.message).toContain('full refund');
      });

      it('should not provide refund after free look period', async () => {
        const policyId = 'policy-after-free-look';
        const userId = 'user-123';
        const mockPolicy = {
          id: policyId,
          userId,
          status: PolicyStatus.ACTIVE,
          issuedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
          premiumAmount: 104800,
          metadata: {},
          isActive: () => true,
          isPending: () => false,
          getPremiumInKes: () => 1048,
        };

        mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);
        mockPolicyRepository.save.mockResolvedValue({
          ...mockPolicy,
          status: PolicyStatus.CANCELLED,
        } as Policy);

        const result = await service.cancelPolicy(policyId, userId, 'Changed mind');

        expect(result.refundEligible).toBe(false);
        expect(result.refundAmount).toBe(0);
        expect(result.message).toContain('free look period has expired');
      });
    });

    describe('getCancellationPreview', () => {
      it('should show remaining free look days', async () => {
        const policyId = 'policy-preview';
        const userId = 'user-123';
        const mockPolicy = {
          id: policyId,
          userId,
          status: PolicyStatus.ACTIVE,
          issuedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
          premiumAmount: 104800,
          isActive: () => true,
          isPending: () => false,
          getPremiumInKes: () => 1048,
        };

        mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);

        const result = await service.getCancellationPreview(policyId, userId);

        expect(result.canCancel).toBe(true);
        expect(result.withinFreeLookPeriod).toBe(true);
        expect(result.freeLookDaysRemaining).toBe(10); // 30 - 20 = 10
        expect(result.refundAmount).toBe(1048);
      });

      it('should show zero days remaining after free look period', async () => {
        const mockPolicy = {
          id: 'policy-expired-free-look',
          userId: 'user-123',
          status: PolicyStatus.ACTIVE,
          issuedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
          premiumAmount: 104800,
          isActive: () => true,
          isPending: () => false,
          getPremiumInKes: () => 1048,
        };

        mockPolicyRepository.findOne.mockResolvedValue(mockPolicy as Policy);

        const result = await service.getCancellationPreview('policy-expired-free-look', 'user-123');

        expect(result.withinFreeLookPeriod).toBe(false);
        expect(result.freeLookDaysRemaining).toBe(0);
        expect(result.refundAmount).toBe(0);
      });
    });
  });
});
