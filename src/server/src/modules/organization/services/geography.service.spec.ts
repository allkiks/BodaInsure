import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeographyService } from './geography.service.js';
import { Geography, GeographyLevel, KENYA_COUNTIES } from '../entities/geography.entity.js';

describe('GeographyService', () => {
  let service: GeographyService;
  let repository: jest.Mocked<Repository<Geography>>;

  const mockCounty: Partial<Geography> = {
    id: 'geo-1',
    code: '047',
    name: 'Nairobi',
    level: GeographyLevel.COUNTY,
    countyCode: '047',
    countyName: 'Nairobi',
    isActive: true,
  };

  const mockSubCounty: Partial<Geography> = {
    id: 'geo-2',
    code: '047-01',
    name: 'Westlands',
    level: GeographyLevel.SUB_COUNTY,
    parentCode: '047',
    countyCode: '047',
    countyName: 'Nairobi',
    isActive: true,
  };

  const mockWard: Partial<Geography> = {
    id: 'geo-3',
    code: '047-01-01',
    name: 'Parklands',
    level: GeographyLevel.WARD,
    parentCode: '047-01',
    countyCode: '047',
    countyName: 'Nairobi',
    isActive: true,
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeographyService,
        {
          provide: getRepositoryToken(Geography),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<GeographyService>(GeographyService);
    repository = module.get(getRepositoryToken(Geography));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCounties', () => {
    it('should return all counties', async () => {
      repository.find.mockResolvedValue([mockCounty as Geography]);

      const result = await service.getCounties();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        code: '047',
        name: 'Nairobi',
        level: GeographyLevel.COUNTY,
        parentCode: null,
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { level: GeographyLevel.COUNTY, isActive: true },
        order: { name: 'ASC' },
      });
    });
  });

  describe('getSubCounties', () => {
    it('should return sub-counties for a county', async () => {
      repository.find.mockResolvedValue([mockSubCounty as Geography]);

      const result = await service.getSubCounties('047');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        code: '047-01',
        name: 'Westlands',
        level: GeographyLevel.SUB_COUNTY,
        parentCode: '047',
      });
    });
  });

  describe('getWards', () => {
    it('should return wards for a sub-county', async () => {
      repository.find.mockResolvedValue([mockWard as Geography]);

      const result = await service.getWards('047-01');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        code: '047-01-01',
        name: 'Parklands',
        level: GeographyLevel.WARD,
        parentCode: '047-01',
      });
    });
  });

  describe('getByCode', () => {
    it('should return geography by code', async () => {
      repository.findOne.mockResolvedValue(mockCounty as Geography);

      const result = await service.getByCode('047');

      expect(result).toEqual(mockCounty);
    });

    it('should return null for missing code', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getByCode('999');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search geography by name', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockCounty, mockSubCounty]);

      const result = await service.search('Nairobi');

      expect(result).toHaveLength(2);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('g.name ILIKE :query', {
        query: '%Nairobi%',
      });
    });

    it('should filter search by level', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockCounty]);

      await service.search('Nairobi', GeographyLevel.COUNTY);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('g.level = :level', {
        level: GeographyLevel.COUNTY,
      });
    });
  });

  describe('getCountyName', () => {
    it('should return county name', async () => {
      repository.findOne.mockResolvedValue(mockCounty as Geography);

      const result = await service.getCountyName('047');

      expect(result).toBe('Nairobi');
    });

    it('should return null for missing county', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getCountyName('999');

      expect(result).toBeNull();
    });
  });

  describe('seedCounties', () => {
    it('should seed all counties', async () => {
      repository.findOne.mockResolvedValue(null); // No existing counties
      repository.save.mockResolvedValue({} as Geography);

      const result = await service.seedCounties();

      expect(result).toBe(KENYA_COUNTIES.length);
      expect(repository.save).toHaveBeenCalledTimes(KENYA_COUNTIES.length);
    });

    it('should skip existing counties', async () => {
      repository.findOne.mockResolvedValue(mockCounty as Geography); // All exist

      const result = await service.seedCounties();

      expect(result).toBe(0);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getHierarchy', () => {
    it('should return full hierarchy for a ward', async () => {
      repository.findOne
        .mockResolvedValueOnce(mockWard as Geography)
        .mockResolvedValueOnce(mockSubCounty as Geography)
        .mockResolvedValueOnce(mockCounty as Geography)
        .mockResolvedValueOnce(null);

      const result = await service.getHierarchy('047-01-01');

      expect(result).toHaveLength(3);
      expect(result[0].level).toBe(GeographyLevel.COUNTY);
      expect(result[1].level).toBe(GeographyLevel.SUB_COUNTY);
      expect(result[2].level).toBe(GeographyLevel.WARD);
    });

    it('should return single item for county', async () => {
      const countyWithNoParent = { ...mockCounty, parentCode: undefined };
      repository.findOne.mockResolvedValueOnce(countyWithNoParent as Geography);

      const result = await service.getHierarchy('047');

      expect(result).toHaveLength(1);
      expect(result[0].level).toBe(GeographyLevel.COUNTY);
    });
  });

  describe('validateLocation', () => {
    it('should validate valid county', async () => {
      repository.findOne.mockResolvedValue(mockCounty as Geography);

      const result = await service.validateLocation('047');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for invalid county', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.validateLocation('999');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid county code: 999');
    });

    it('should validate sub-county belongs to county', async () => {
      repository.findOne
        .mockResolvedValueOnce(mockCounty as Geography)
        .mockResolvedValueOnce(mockSubCounty as Geography);

      const result = await service.validateLocation('047', '047-01');

      expect(result.valid).toBe(true);
    });

    it('should return error if sub-county does not belong to county', async () => {
      const wrongSubCounty = { ...mockSubCounty, countyCode: '001' };
      repository.findOne
        .mockResolvedValueOnce(mockCounty as Geography)
        .mockResolvedValueOnce(wrongSubCounty as Geography);

      const result = await service.validateLocation('047', '047-01');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sub-county 047-01 does not belong to county 047');
    });

    it('should validate ward belongs to sub-county', async () => {
      repository.findOne
        .mockResolvedValueOnce(mockCounty as Geography)
        .mockResolvedValueOnce(mockSubCounty as Geography)
        .mockResolvedValueOnce(mockWard as Geography);

      const result = await service.validateLocation('047', '047-01', '047-01-01');

      expect(result.valid).toBe(true);
    });

    it('should return error if ward does not belong to sub-county', async () => {
      const wrongWard = { ...mockWard, parentCode: '001-01' };
      repository.findOne
        .mockResolvedValueOnce(mockCounty as Geography)
        .mockResolvedValueOnce(mockSubCounty as Geography)
        .mockResolvedValueOnce(wrongWard as Geography);

      const result = await service.validateLocation('047', '047-01', '047-01-01');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Ward 047-01-01 does not belong to sub-county 047-01');
    });

    it('should return multiple errors', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.validateLocation('999', '999-01', '999-01-01');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('KENYA_COUNTIES constant', () => {
    it('should have 47 counties', () => {
      expect(KENYA_COUNTIES).toHaveLength(47);
    });

    it('should include Nairobi', () => {
      const nairobi = KENYA_COUNTIES.find((c) => c.name === 'Nairobi');
      expect(nairobi).toBeDefined();
      expect(nairobi?.code).toBe('047');
    });

    it('should include Mombasa', () => {
      const mombasa = KENYA_COUNTIES.find((c) => c.name === 'Mombasa');
      expect(mombasa).toBeDefined();
      expect(mombasa?.code).toBe('001');
    });
  });
});
