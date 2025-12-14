import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReportService } from './report.service.js';
import {
  ReportDefinition,
  ReportType,
  ReportFormat,
  ReportFrequency,
} from '../entities/report-definition.entity.js';
import {
  GeneratedReport,
  ReportStatus,
} from '../entities/generated-report.entity.js';

describe('ReportService', () => {
  let service: ReportService;
  let definitionRepository: jest.Mocked<Repository<ReportDefinition>>;
  let reportRepository: jest.Mocked<Repository<GeneratedReport>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockDefinition: Partial<ReportDefinition> = {
    id: 'def-1',
    name: 'Test Report',
    type: ReportType.ENROLLMENT,
    defaultFormat: ReportFormat.CSV,
    availableFormats: [ReportFormat.JSON, ReportFormat.CSV],
    frequency: ReportFrequency.MANUAL,
    isActive: true,
  };

  const mockReport: Partial<GeneratedReport> = {
    id: 'report-1',
    reportDefinitionId: 'def-1',
    name: 'Test Report',
    format: ReportFormat.CSV,
    status: ReportStatus.COMPLETED,
    userId: 'user-1',
    recordCount: 10,
    createdAt: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(ReportDefinition),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(GeneratedReport),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    definitionRepository = module.get(getRepositoryToken(ReportDefinition));
    reportRepository = module.get(getRepositoryToken(GeneratedReport));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDefinition', () => {
    it('should create a report definition', async () => {
      definitionRepository.create.mockReturnValue(mockDefinition as ReportDefinition);
      definitionRepository.save.mockResolvedValue(mockDefinition as ReportDefinition);

      const result = await service.createDefinition(
        {
          name: 'Test Report',
          type: ReportType.ENROLLMENT,
        },
        'user-1',
      );

      expect(result).toEqual(mockDefinition);
      expect(definitionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Report',
          type: ReportType.ENROLLMENT,
          createdBy: 'user-1',
        }),
      );
    });
  });

  describe('getDefinitionById', () => {
    it('should return definition by ID', async () => {
      definitionRepository.findOne.mockResolvedValue(mockDefinition as ReportDefinition);

      const result = await service.getDefinitionById('def-1');

      expect(result).toEqual(mockDefinition);
    });

    it('should throw NotFoundException for missing definition', async () => {
      definitionRepository.findOne.mockResolvedValue(null);

      await expect(service.getDefinitionById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listDefinitions', () => {
    it('should list active definitions', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockDefinition]);

      const result = await service.listDefinitions();

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('d.is_active = true');
    });

    it('should filter by type', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockDefinition]);

      await service.listDefinitions({ type: ReportType.ENROLLMENT });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('d.type = :type', {
        type: ReportType.ENROLLMENT,
      });
    });
  });

  describe('updateDefinition', () => {
    it('should update definition', async () => {
      const updated = { ...mockDefinition, name: 'Updated Report' };
      definitionRepository.findOne.mockResolvedValue(mockDefinition as ReportDefinition);
      definitionRepository.save.mockResolvedValue(updated as ReportDefinition);

      const result = await service.updateDefinition('def-1', { name: 'Updated Report' });

      expect(result.name).toBe('Updated Report');
    });
  });

  describe('deleteDefinition', () => {
    it('should soft delete definition', async () => {
      definitionRepository.findOne.mockResolvedValue(mockDefinition as ReportDefinition);
      definitionRepository.save.mockResolvedValue({
        ...mockDefinition,
        isActive: false,
      } as ReportDefinition);

      await service.deleteDefinition('def-1');

      expect(definitionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('generateReport', () => {
    it('should create a report record', async () => {
      definitionRepository.findOne.mockResolvedValue(mockDefinition as ReportDefinition);
      reportRepository.create.mockReturnValue(mockReport as GeneratedReport);
      reportRepository.save.mockResolvedValue(mockReport as GeneratedReport);
      reportRepository.findOne.mockResolvedValue(mockReport as GeneratedReport);
      dataSource.query.mockResolvedValue([]);

      const result = await service.generateReport(
        {
          reportDefinitionId: 'def-1',
          format: ReportFormat.CSV,
        },
        'user-1',
      );

      expect(result.name).toBe('Test Report');
      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reportDefinitionId: 'def-1',
          format: ReportFormat.CSV,
          userId: 'user-1',
          status: ReportStatus.PENDING,
        }),
      );
    });

    it('should throw BadRequestException for unsupported format', async () => {
      const defNoExcel = {
        ...mockDefinition,
        availableFormats: [ReportFormat.JSON],
      };
      definitionRepository.findOne.mockResolvedValue(defNoExcel as ReportDefinition);

      await expect(
        service.generateReport(
          {
            reportDefinitionId: 'def-1',
            format: ReportFormat.EXCEL,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReportById', () => {
    it('should return report by ID', async () => {
      reportRepository.findOne.mockResolvedValue(mockReport as GeneratedReport);

      const result = await service.getReportById('report-1');

      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException for missing report', async () => {
      reportRepository.findOne.mockResolvedValue(null);

      await expect(service.getReportById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listUserReports', () => {
    it('should list user reports with pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockReport], 1]);

      const result = await service.listUserReports('user-1', { page: 1, limit: 20 });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockReport], 1]);

      await service.listUserReports('user-1', { status: ReportStatus.COMPLETED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: ReportStatus.COMPLETED,
      });
    });
  });

  describe('cleanupExpiredReports', () => {
    it('should expire old reports', async () => {
      reportRepository.update.mockResolvedValue({ affected: 5 } as any);

      const result = await service.cleanupExpiredReports();

      expect(result).toBe(5);
    });
  });

  describe('seedDefaultDefinitions', () => {
    it('should seed default definitions', async () => {
      definitionRepository.findOne.mockResolvedValue(null);
      definitionRepository.create.mockReturnValue({} as ReportDefinition);
      definitionRepository.save.mockResolvedValue({} as ReportDefinition);

      const result = await service.seedDefaultDefinitions();

      expect(result).toBe(5); // 5 default definitions
    });

    it('should skip existing definitions', async () => {
      definitionRepository.findOne.mockResolvedValue(mockDefinition as ReportDefinition);

      const result = await service.seedDefaultDefinitions();

      expect(result).toBe(0);
      expect(definitionRepository.save).not.toHaveBeenCalled();
    });
  });
});
