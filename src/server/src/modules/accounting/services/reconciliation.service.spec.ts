import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReconciliationService, StatementItem } from './reconciliation.service.js';
import {
  ReconciliationRecord,
  ReconciliationType,
  ReconciliationStatus,
} from '../entities/reconciliation-record.entity.js';
import { ReconciliationItem, MatchType } from '../entities/reconciliation-item.entity.js';
import { Transaction, TransactionStatus } from '../../payment/entities/transaction.entity.js';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let recordRepository: Repository<ReconciliationRecord>;
  let itemRepository: Repository<ReconciliationItem>;
  let transactionRepository: Repository<Transaction>;
  let dataSource: DataSource;

  const mockReconciliationRecord: Partial<ReconciliationRecord> = {
    id: 'rec-123',
    reconciliationType: ReconciliationType.DAILY_MPESA,
    reconciliationDate: new Date('2026-01-14'),
    sourceName: 'M-Pesa Statement',
    sourceBalance: 100000,
    ledgerBalance: 100000,
    variance: 0,
    status: ReconciliationStatus.MATCHED,
    totalItems: 10,
    matchedCount: 10,
    unmatchedCount: 0,
    getMatchPercentage: () => 100,
  };

  const mockRecordRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockTransactionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEntityManager = {
    getRepository: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback(mockEntityManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: getRepositoryToken(ReconciliationRecord), useValue: mockRecordRepository },
        { provide: getRepositoryToken(ReconciliationItem), useValue: mockItemRepository },
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
    recordRepository = module.get<Repository<ReconciliationRecord>>(
      getRepositoryToken(ReconciliationRecord),
    );
    itemRepository = module.get<Repository<ReconciliationItem>>(
      getRepositoryToken(ReconciliationItem),
    );
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMpesaReconciliation', () => {
    const statementItems: StatementItem[] = [
      { reference: 'MPESA001', amount: 10000, date: new Date('2026-01-14') },
      { reference: 'MPESA002', amount: 20000, date: new Date('2026-01-14') },
      { reference: 'MPESA003', amount: 30000, date: new Date('2026-01-14') },
    ];

    const ledgerTransactions = [
      {
        id: 'txn-1',
        amount: 10000,
        mpesaReceiptNumber: 'MPESA001',
        status: TransactionStatus.COMPLETED,
        completedAt: new Date('2026-01-14'),
        createdAt: new Date('2026-01-14'),
      },
      {
        id: 'txn-2',
        amount: 20000,
        mpesaReceiptNumber: 'MPESA002',
        status: TransactionStatus.COMPLETED,
        completedAt: new Date('2026-01-14'),
        createdAt: new Date('2026-01-14'),
      },
    ];

    beforeEach(() => {
      mockTransactionRepository.find.mockResolvedValue(ledgerTransactions);

      const savedItems: any[] = [];
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationRecord) {
          return {
            create: jest.fn().mockReturnValue(mockReconciliationRecord),
            save: jest.fn().mockResolvedValue(mockReconciliationRecord),
          };
        }
        if (entity === ReconciliationItem) {
          return {
            create: jest.fn((data) => data),
            save: jest.fn((item) => {
              savedItems.push(item);
              return Promise.resolve(item);
            }),
          };
        }
        return {};
      });
    });

    it('should create reconciliation with correct balances', async () => {
      const result = await service.createMpesaReconciliation(
        new Date('2026-01-14'),
        statementItems,
        'admin-123',
      );

      expect(result.success).toBe(true);
      expect(result.sourceBalance).toBe(60000); // Sum of statement items
    });

    it('should auto-match items with exact reference and amount', async () => {
      const result = await service.createMpesaReconciliation(
        new Date('2026-01-14'),
        statementItems,
        'admin-123',
      );

      // 2 items should match (MPESA001 and MPESA002)
      expect(result.autoMatchedCount).toBe(2);
    });

    it('should mark unmatched items correctly', async () => {
      const result = await service.createMpesaReconciliation(
        new Date('2026-01-14'),
        statementItems,
      );

      // MPESA003 has no matching ledger transaction
      expect(result.unmatchedCount).toBeGreaterThan(0);
    });

    it('should calculate variance correctly', async () => {
      const result = await service.createMpesaReconciliation(
        new Date('2026-01-14'),
        statementItems,
      );

      // Variance = sourceBalance - ledgerBalance
      expect(result.variance).toBe(result.sourceBalance - result.ledgerBalance);
    });
  });

  describe('auto-matching logic', () => {
    it('should assign EXACT match type for matching reference and amount', async () => {
      const statementItems: StatementItem[] = [
        { reference: 'EXACT001', amount: 10000, date: new Date() },
      ];
      const ledgerTransactions = [
        {
          id: 'txn-1',
          amount: 10000,
          mpesaReceiptNumber: 'EXACT001',
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockTransactionRepository.find.mockResolvedValue(ledgerTransactions);

      let savedItem: any;
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationRecord) {
          return {
            create: jest.fn().mockReturnValue(mockReconciliationRecord),
            save: jest.fn().mockResolvedValue(mockReconciliationRecord),
          };
        }
        if (entity === ReconciliationItem) {
          return {
            create: jest.fn((data) => data),
            save: jest.fn((item) => {
              savedItem = item;
              return Promise.resolve(item);
            }),
          };
        }
        return {};
      });

      await service.createMpesaReconciliation(new Date(), statementItems);

      expect(savedItem.matchType).toBe(MatchType.EXACT);
      expect(savedItem.matchConfidence).toBe(100);
    });

    it('should assign AMOUNT_ONLY match type for matching amount only', async () => {
      const statementItems: StatementItem[] = [
        { reference: 'DIFFERENT-REF', amount: 10000, date: new Date() },
      ];
      const ledgerTransactions = [
        {
          id: 'txn-1',
          amount: 10000,
          mpesaReceiptNumber: 'OTHER-REF',
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockTransactionRepository.find.mockResolvedValue(ledgerTransactions);

      let savedItem: any;
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationRecord) {
          return {
            create: jest.fn().mockReturnValue(mockReconciliationRecord),
            save: jest.fn().mockResolvedValue(mockReconciliationRecord),
          };
        }
        if (entity === ReconciliationItem) {
          return {
            create: jest.fn((data) => data),
            save: jest.fn((item) => {
              savedItem = item;
              return Promise.resolve(item);
            }),
          };
        }
        return {};
      });

      await service.createMpesaReconciliation(new Date(), statementItems);

      expect(savedItem.matchType).toBe(MatchType.AMOUNT_ONLY);
      expect(savedItem.matchConfidence).toBe(80);
    });

    it('should assign REFERENCE_ONLY match type for matching reference only', async () => {
      const statementItems: StatementItem[] = [
        { reference: 'REF001', amount: 10000, date: new Date() },
      ];
      const ledgerTransactions = [
        {
          id: 'txn-1',
          amount: 99999, // Different amount
          mpesaReceiptNumber: 'REF001',
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockTransactionRepository.find.mockResolvedValue(ledgerTransactions);

      let savedItem: any;
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationRecord) {
          return {
            create: jest.fn().mockReturnValue(mockReconciliationRecord),
            save: jest.fn().mockResolvedValue(mockReconciliationRecord),
          };
        }
        if (entity === ReconciliationItem) {
          return {
            create: jest.fn((data) => data),
            save: jest.fn((item) => {
              savedItem = item;
              return Promise.resolve(item);
            }),
          };
        }
        return {};
      });

      await service.createMpesaReconciliation(new Date(), statementItems);

      expect(savedItem.matchType).toBe(MatchType.REFERENCE_ONLY);
      expect(savedItem.matchConfidence).toBe(70);
    });

    it('should assign FUZZY match type for partial matches', async () => {
      const statementItems: StatementItem[] = [
        { reference: 'MPESA123456', amount: 10050, date: new Date() }, // Amount within 100 cents
      ];
      const ledgerTransactions = [
        {
          id: 'txn-1',
          amount: 10000,
          mpesaReceiptNumber: '123456', // Partial reference match
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockTransactionRepository.find.mockResolvedValue(ledgerTransactions);

      let savedItem: any;
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationRecord) {
          return {
            create: jest.fn().mockReturnValue(mockReconciliationRecord),
            save: jest.fn().mockResolvedValue(mockReconciliationRecord),
          };
        }
        if (entity === ReconciliationItem) {
          return {
            create: jest.fn((data) => data),
            save: jest.fn((item) => {
              savedItem = item;
              return Promise.resolve(item);
            }),
          };
        }
        return {};
      });

      await service.createMpesaReconciliation(new Date(), statementItems);

      expect(savedItem.matchType).toBe(MatchType.FUZZY);
      expect(savedItem.matchConfidence).toBe(60);
    });
  });

  describe('manualMatch', () => {
    const mockItem = {
      id: 'item-123',
      reconciliationId: 'rec-123',
      sourceAmount: 10000,
      status: ReconciliationStatus.UNMATCHED,
    };

    const mockTransaction = {
      id: 'txn-123',
      amount: 10000,
      completedAt: new Date(),
      createdAt: new Date(),
      description: 'Test transaction',
    };

    beforeEach(() => {
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationItem) {
          return {
            findOne: jest.fn().mockResolvedValue(mockItem),
            save: jest.fn().mockImplementation((item) => Promise.resolve(item)),
          };
        }
        if (entity === ReconciliationRecord) {
          return {
            findOne: jest.fn().mockResolvedValue(mockReconciliationRecord),
            save: jest.fn().mockResolvedValue(mockReconciliationRecord),
          };
        }
        return {};
      });
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
    });

    it('should manually match item to transaction', async () => {
      const result = await service.manualMatch(
        'item-123',
        'txn-123',
        'admin-123',
        'Manual match note',
      );

      expect(result.matchType).toBe(MatchType.MANUAL);
      expect(result.matchConfidence).toBe(100);
      expect(result.status).toBe(ReconciliationStatus.MATCHED);
    });

    it('should update record counts after manual match', async () => {
      let savedRecord: any;
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationItem) {
          return {
            findOne: jest.fn().mockResolvedValue(mockItem),
            save: jest.fn().mockImplementation((item) => Promise.resolve(item)),
          };
        }
        if (entity === ReconciliationRecord) {
          return {
            findOne: jest.fn().mockResolvedValue({
              ...mockReconciliationRecord,
              matchedCount: 5,
              unmatchedCount: 5,
              manualMatchedCount: 0,
            }),
            save: jest.fn().mockImplementation((record) => {
              savedRecord = record;
              return Promise.resolve(record);
            }),
          };
        }
        return {};
      });

      await service.manualMatch('item-123', 'txn-123', 'admin-123');

      expect(savedRecord.matchedCount).toBe(6);
      expect(savedRecord.unmatchedCount).toBe(4);
      expect(savedRecord.manualMatchedCount).toBe(1);
    });

    it('should throw NotFoundException for non-existent item', async () => {
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationItem) {
          return {
            findOne: jest.fn().mockResolvedValue(null),
          };
        }
        return {};
      });

      await expect(service.manualMatch('non-existent', 'txn-123', 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent transaction', async () => {
      mockEntityManager.getRepository.mockImplementation((entity) => {
        if (entity === ReconciliationItem) {
          return {
            findOne: jest.fn().mockResolvedValue(mockItem),
          };
        }
        return {};
      });
      mockTransactionRepository.findOne.mockResolvedValue(null);

      await expect(service.manualMatch('item-123', 'non-existent', 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolveItem', () => {
    it('should resolve unmatched item with notes', async () => {
      const mockItem = {
        id: 'item-123',
        reconciliationId: 'rec-123',
        status: ReconciliationStatus.UNMATCHED,
      };
      mockItemRepository.findOne.mockResolvedValue(mockItem);
      mockItemRepository.save.mockImplementation((item) => Promise.resolve(item));
      mockRecordRepository.findOne.mockResolvedValue({
        ...mockReconciliationRecord,
        unmatchedCount: 5,
      });

      const result = await service.resolveItem(
        'item-123',
        'admin-123',
        'Write-off: Bank fee discrepancy',
      );

      expect(result.status).toBe(ReconciliationStatus.RESOLVED);
      expect(result.resolvedBy).toBe('admin-123');
      expect(result.resolutionNotes).toBe('Write-off: Bank fee discrepancy');
    });
  });

  describe('getById', () => {
    it('should return reconciliation record with items', async () => {
      mockRecordRepository.findOne.mockResolvedValue({
        ...mockReconciliationRecord,
        items: [],
      });

      const result = await service.getById('rec-123');

      expect(result.id).toBe('rec-123');
      expect(mockRecordRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'rec-123' },
        relations: ['items'],
      });
    });

    it('should throw NotFoundException for non-existent record', async () => {
      mockRecordRepository.findOne.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummaryStats', () => {
    it('should calculate correct summary statistics', async () => {
      const records = [
        { ...mockReconciliationRecord, status: ReconciliationStatus.MATCHED, variance: 0, getMatchPercentage: () => 100 },
        { ...mockReconciliationRecord, status: ReconciliationStatus.MATCHED, variance: 100, getMatchPercentage: () => 95 },
        { ...mockReconciliationRecord, status: ReconciliationStatus.UNMATCHED, variance: 5000, getMatchPercentage: () => 80 },
      ];
      mockRecordRepository.find.mockResolvedValue(records);

      const result = await service.getSummaryStats(new Date('2026-01-01'), new Date('2026-01-31'));

      expect(result.totalReconciliations).toBe(3);
      expect(result.fullyMatched).toBe(2);
      expect(result.withUnmatched).toBe(1);
      expect(result.totalVariance).toBe(5100);
      expect(result.averageMatchRate).toBe(92); // (100+95+80)/3 rounded
    });
  });
});
