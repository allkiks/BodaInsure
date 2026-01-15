import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettlementService } from './settlement.service.js';
import { JournalEntryService } from './journal-entry.service.js';
import {
  PartnerSettlement,
  PartnerType,
  SettlementType,
  SettlementStatus,
} from '../entities/partner-settlement.entity.js';
import { SettlementLineItem } from '../entities/settlement-line-item.entity.js';
import { EscrowTracking, RemittanceStatus } from '../entities/escrow-tracking.entity.js';

describe('SettlementService', () => {
  let service: SettlementService;
  let settlementRepository: Repository<PartnerSettlement>;
  let escrowRepository: Repository<EscrowTracking>;
  let journalEntryService: JournalEntryService;
  let dataSource: DataSource;

  const mockSettlement: Partial<PartnerSettlement> = {
    id: 'settlement-123',
    settlementNumber: 'KBA-SF-20260114-001',
    partnerType: PartnerType.KBA,
    settlementType: SettlementType.SERVICE_FEE,
    totalAmount: 10000,
    transactionCount: 100,
    status: SettlementStatus.PENDING,
    canBeApproved: () => true,
    canBeProcessed: () => false,
    getPartnerDisplayName: () => 'Kenya Bodaboda Association',
    getTypeDisplayName: () => 'Service Fee',
  };

  const mockEscrowRecords = [
    { id: 'e1', riderId: 'r1', createdAt: new Date() },
    { id: 'e2', riderId: 'r1', createdAt: new Date() },
    { id: 'e3', riderId: 'r2', createdAt: new Date() },
  ];

  const mockSettlementRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockEscrowRepository = {
    find: jest.fn(),
  };

  const mockJournalEntryService = {
    create: jest.fn().mockResolvedValue({ id: 'je-123' }),
  };

  const mockEntityManager = {
    getRepository: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback(mockEntityManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: getRepositoryToken(PartnerSettlement), useValue: mockSettlementRepository },
        { provide: getRepositoryToken(EscrowTracking), useValue: mockEscrowRepository },
        { provide: JournalEntryService, useValue: mockJournalEntryService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    settlementRepository = module.get<Repository<PartnerSettlement>>(
      getRepositoryToken(PartnerSettlement),
    );
    escrowRepository = module.get<Repository<EscrowTracking>>(getRepositoryToken(EscrowTracking));
    journalEntryService = module.get<JournalEntryService>(JournalEntryService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createServiceFeeSettlement', () => {
    beforeEach(() => {
      mockEscrowRepository.find.mockResolvedValue(mockEscrowRecords);
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === PartnerSettlement) {
          return {
            create: jest.fn().mockReturnValue(mockSettlement),
            save: jest.fn().mockResolvedValue(mockSettlement),
            count: jest.fn().mockResolvedValue(0),
          };
        }
        if (entity === SettlementLineItem) {
          return {
            save: jest.fn().mockResolvedValue({}),
          };
        }
        return {};
      });
    });

    it('should create service fee settlement for KBA', async () => {
      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-14');

      const result = await service.createServiceFeeSettlement(
        PartnerType.KBA,
        periodStart,
        periodEnd,
        'admin-123',
      );

      expect(result.success).toBe(true);
      expect(result.transactionCount).toBe(3);
      // 3 transactions * 100 cents (KES 1) = 300 cents
      expect(result.totalAmount).toBe(300);
    });

    it('should create service fee settlement for Robs Insurance', async () => {
      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-14');

      const result = await service.createServiceFeeSettlement(
        PartnerType.ROBS_INSURANCE,
        periodStart,
        periodEnd,
        'admin-123',
      );

      expect(result.success).toBe(true);
    });

    it('should reject service fee settlement for invalid partner type', async () => {
      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-14');

      await expect(
        service.createServiceFeeSettlement(
          PartnerType.DEFINITE_ASSURANCE as any,
          periodStart,
          periodEnd,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return success with zero amount when no transactions found', async () => {
      mockEscrowRepository.find.mockResolvedValue([]);

      const result = await service.createServiceFeeSettlement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-14'),
      );

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.message).toContain('No transactions');
    });

    it('should group line items by date', async () => {
      const escrowRecordsMultipleDays = [
        { id: 'e1', riderId: 'r1', createdAt: new Date('2026-01-10') },
        { id: 'e2', riderId: 'r2', createdAt: new Date('2026-01-10') },
        { id: 'e3', riderId: 'r3', createdAt: new Date('2026-01-11') },
      ];
      mockEscrowRepository.find.mockResolvedValue(escrowRecordsMultipleDays);

      const lineItemSaves: any[] = [];
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === PartnerSettlement) {
          return {
            create: jest.fn().mockReturnValue(mockSettlement),
            save: jest.fn().mockResolvedValue(mockSettlement),
            count: jest.fn().mockResolvedValue(0),
          };
        }
        if (entity === SettlementLineItem) {
          return {
            save: jest.fn((item) => {
              lineItemSaves.push(item);
              return Promise.resolve(item);
            }),
          };
        }
        return {};
      });

      await service.createServiceFeeSettlement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-14'),
      );

      // Should create 2 line items (one for each date)
      expect(lineItemSaves.length).toBe(2);
    });
  });

  describe('createCommissionSettlement', () => {
    beforeEach(() => {
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === PartnerSettlement) {
          return {
            create: jest.fn().mockReturnValue({
              ...mockSettlement,
              settlementType: SettlementType.COMMISSION,
            }),
            save: jest.fn().mockResolvedValue({
              ...mockSettlement,
              settlementType: SettlementType.COMMISSION,
            }),
            count: jest.fn().mockResolvedValue(0),
          };
        }
        if (entity === SettlementLineItem) {
          return {
            save: jest.fn().mockResolvedValue({}),
          };
        }
        return {};
      });
    });

    it('should create commission settlement with correct amount', async () => {
      const commissionAmount = 3150000; // 31,500 KES

      const result = await service.createCommissionSettlement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        commissionAmount,
        { policyCount: 100 },
        'admin-123',
      );

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(commissionAmount);
    });

    it('should return success with zero for zero commission', async () => {
      const result = await service.createCommissionSettlement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        0,
      );

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(0);
      expect(result.message).toContain('No commission');
    });

    it('should store metadata with commission settlement', async () => {
      const metadata = { policyCount: 100, uniqueRiders: 100 };
      let savedSettlement: any;

      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === PartnerSettlement) {
          return {
            create: jest.fn((data) => {
              savedSettlement = data;
              return data;
            }),
            save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'new-id' })),
            count: jest.fn().mockResolvedValue(0),
          };
        }
        if (entity === SettlementLineItem) {
          return { save: jest.fn().mockResolvedValue({}) };
        }
        return {};
      });

      await service.createCommissionSettlement(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        3150000,
        metadata,
      );

      expect(savedSettlement.metadata).toEqual(metadata);
    });
  });

  describe('approveSettlement', () => {
    it('should approve pending settlement', async () => {
      const pendingSettlement = {
        ...mockSettlement,
        status: SettlementStatus.PENDING,
        canBeApproved: () => true,
      };
      mockSettlementRepository.findOne.mockResolvedValue(pendingSettlement);
      mockSettlementRepository.save.mockResolvedValue({
        ...pendingSettlement,
        status: SettlementStatus.APPROVED,
        approvedBy: 'admin-123',
        approvedAt: expect.any(Date),
      });

      const result = await service.approveSettlement('settlement-123', 'admin-123');

      expect(result.status).toBe(SettlementStatus.APPROVED);
      expect(result.approvedBy).toBe('admin-123');
    });

    it('should throw NotFoundException for non-existent settlement', async () => {
      mockSettlementRepository.findOne.mockResolvedValue(null);

      await expect(service.approveSettlement('non-existent', 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for already approved settlement', async () => {
      const approvedSettlement = {
        ...mockSettlement,
        status: SettlementStatus.APPROVED,
        canBeApproved: () => false,
      };
      mockSettlementRepository.findOne.mockResolvedValue(approvedSettlement);

      await expect(service.approveSettlement('settlement-123', 'admin-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('processSettlement', () => {
    const approvedSettlement = {
      ...mockSettlement,
      status: SettlementStatus.APPROVED,
      canBeProcessed: () => true,
      getPartnerDisplayName: () => 'Kenya Bodaboda Association',
      getTypeDisplayName: () => 'Service Fee',
    };

    beforeEach(() => {
      mockEntityManager.getRepository.mockImplementation(() => ({
        findOne: jest.fn().mockResolvedValue(approvedSettlement),
        save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      }));
    });

    it('should process approved settlement', async () => {
      const result = await service.processSettlement(
        'settlement-123',
        'BANK-REF-001',
        'UBA-001',
      );

      expect(result.status).toBe(SettlementStatus.COMPLETED);
      expect(result.bankReference).toBe('BANK-REF-001');
    });

    it('should create journal entry when processing', async () => {
      await service.processSettlement('settlement-123', 'BANK-REF-001');

      expect(mockJournalEntryService.create).toHaveBeenCalled();
    });

    it('should reject processing of non-approved settlement', async () => {
      mockEntityManager.getRepository.mockImplementation(() => ({
        findOne: jest.fn().mockResolvedValue({
          ...mockSettlement,
          status: SettlementStatus.PENDING,
          canBeProcessed: () => false,
        }),
      }));

      await expect(
        service.processSettlement('settlement-123', 'BANK-REF-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getById', () => {
    it('should return settlement with relations', async () => {
      mockSettlementRepository.findOne.mockResolvedValue({
        ...mockSettlement,
        lineItems: [],
        journalEntry: null,
      });

      const result = await service.getById('settlement-123');

      expect(result.id).toBe('settlement-123');
      expect(mockSettlementRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'settlement-123' },
        relations: ['lineItems', 'journalEntry'],
      });
    });

    it('should throw NotFoundException for non-existent settlement', async () => {
      mockSettlementRepository.findOne.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByPartner', () => {
    it('should return settlements for partner ordered by date', async () => {
      const settlements = [mockSettlement, { ...mockSettlement, id: 'settlement-456' }];
      mockSettlementRepository.find.mockResolvedValue(settlements);

      const result = await service.getByPartner(PartnerType.KBA);

      expect(result).toHaveLength(2);
      expect(mockSettlementRepository.find).toHaveBeenCalledWith({
        where: { partnerType: PartnerType.KBA },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getPendingSettlements', () => {
    it('should return settlements with PENDING status', async () => {
      mockSettlementRepository.find.mockResolvedValue([mockSettlement]);

      const result = await service.getPendingSettlements();

      expect(result).toHaveLength(1);
      expect(mockSettlementRepository.find).toHaveBeenCalledWith({
        where: { status: SettlementStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getPartnerSummary', () => {
    it('should calculate correct summary for partner', async () => {
      const settlements = [
        { ...mockSettlement, status: SettlementStatus.COMPLETED, totalAmount: 10000 },
        { ...mockSettlement, status: SettlementStatus.COMPLETED, totalAmount: 15000 },
        { ...mockSettlement, status: SettlementStatus.PENDING, totalAmount: 5000 },
      ];
      mockSettlementRepository.find.mockResolvedValue(settlements);

      const result = await service.getPartnerSummary(
        PartnerType.KBA,
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.totalSettled).toBe(25000);
      expect(result.totalPending).toBe(5000);
      expect(result.settlementCount).toBe(2);
      expect(result.pendingCount).toBe(1);
    });
  });
});
