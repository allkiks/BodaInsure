import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import {
  Organization,
  OrganizationType,
  OrganizationStatus,
} from '../entities/organization.entity.js';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let repository: jest.Mocked<Repository<Organization>>;

  const mockOrganization: Partial<Organization> = {
    id: 'org-1',
    code: 'KBA-001',
    name: 'Kenya Bodaboda Association',
    type: OrganizationType.UMBRELLA_BODY,
    status: OrganizationStatus.ACTIVE,
    countyCode: '047',
    verifiedMembers: 1000,
    estimatedMembers: 5000,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: () => true,
    isTopLevel: () => true,
    isUmbrellaBody: () => true,
    getFullAddress: () => 'Nairobi, Kenya',
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    repository = module.get(getRepositoryToken(Organization));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new organization', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockOrganization as Organization);
      repository.save.mockResolvedValue(mockOrganization as Organization);

      const result = await service.create({
        name: 'Kenya Bodaboda Association',
        code: 'KBA-001',
        type: OrganizationType.UMBRELLA_BODY,
      });

      expect(result).toEqual(mockOrganization);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kenya Bodaboda Association',
          code: 'KBA-001',
          type: OrganizationType.UMBRELLA_BODY,
          status: OrganizationStatus.PENDING,
        }),
      );
    });

    it('should throw ConflictException for duplicate code', async () => {
      repository.findOne.mockResolvedValue(mockOrganization as Organization);

      await expect(
        service.create({
          name: 'Another Org',
          code: 'KBA-001',
          type: OrganizationType.SACCO,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for invalid parent', async () => {
      repository.findOne
        .mockResolvedValueOnce(null) // No duplicate code
        .mockResolvedValueOnce(null); // Parent not found

      await expect(
        service.create({
          name: 'Child Org',
          code: 'CHILD-001',
          type: OrganizationType.SACCO,
          parentId: 'invalid-parent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getById', () => {
    it('should return organization by ID', async () => {
      repository.findOne.mockResolvedValue(mockOrganization as Organization);

      const result = await service.getById('org-1');

      expect(result).toEqual(mockOrganization);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'org-1', deletedAt: expect.anything() },
        relations: ['parent'],
      });
    });

    it('should throw NotFoundException for missing organization', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getById('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByCode', () => {
    it('should return organization by code', async () => {
      repository.findOne.mockResolvedValue(mockOrganization as Organization);

      const result = await service.getByCode('KBA-001');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException for missing code', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getByCode('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update organization', async () => {
      const updated = { ...mockOrganization, name: 'Updated Name' };
      repository.findOne.mockResolvedValue(mockOrganization as Organization);
      repository.save.mockResolvedValue(updated as Organization);

      const result = await service.update('org-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });
  });

  describe('verify', () => {
    it('should verify organization', async () => {
      const pending = {
        ...mockOrganization,
        status: OrganizationStatus.PENDING,
      };
      const verified = {
        ...mockOrganization,
        status: OrganizationStatus.ACTIVE,
        verifiedAt: new Date(),
        verifiedBy: 'admin-1',
      };
      repository.findOne.mockResolvedValue(pending as Organization);
      repository.save.mockResolvedValue(verified as Organization);

      const result = await service.verify('org-1', 'admin-1');

      expect(result.status).toBe(OrganizationStatus.ACTIVE);
      expect(result.verifiedBy).toBe('admin-1');
    });
  });

  describe('suspend', () => {
    it('should suspend organization with reason', async () => {
      const suspended = {
        ...mockOrganization,
        status: OrganizationStatus.SUSPENDED,
        metadata: { suspensionReason: 'Policy violation' },
      };
      repository.findOne.mockResolvedValue(mockOrganization as Organization);
      repository.save.mockResolvedValue(suspended as Organization);

      const result = await service.suspend('org-1', 'Policy violation');

      expect(result.status).toBe(OrganizationStatus.SUSPENDED);
    });
  });

  describe('reactivate', () => {
    it('should reactivate suspended organization', async () => {
      const suspended = {
        ...mockOrganization,
        status: OrganizationStatus.SUSPENDED,
      };
      const active = {
        ...mockOrganization,
        status: OrganizationStatus.ACTIVE,
      };
      repository.findOne.mockResolvedValue(suspended as Organization);
      repository.save.mockResolvedValue(active as Organization);

      const result = await service.reactivate('org-1');

      expect(result.status).toBe(OrganizationStatus.ACTIVE);
    });
  });

  describe('delete', () => {
    it('should soft delete organization', async () => {
      const deleted = {
        ...mockOrganization,
        status: OrganizationStatus.INACTIVE,
        deletedAt: new Date(),
      };
      repository.findOne.mockResolvedValue(mockOrganization as Organization);
      repository.save.mockResolvedValue(deleted as Organization);

      await service.delete('org-1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrganizationStatus.INACTIVE,
        }),
      );
    });
  });

  describe('list', () => {
    it('should list organizations with pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockOrganization], 1]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.organizations).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by type', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockOrganization], 1]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.list({ type: OrganizationType.UMBRELLA_BODY });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('org.type = :type', {
        type: OrganizationType.UMBRELLA_BODY,
      });
    });

    it('should filter by status', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockOrganization], 1]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.list({ status: OrganizationStatus.ACTIVE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('org.status = :status', {
        status: OrganizationStatus.ACTIVE,
      });
    });

    it('should search by name or code', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockOrganization], 1]);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.list({ search: 'KBA' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(org.name ILIKE :search OR org.code ILIKE :search)',
        { search: '%KBA%' },
      );
    });
  });

  describe('getUmbrellaBodies', () => {
    it('should return umbrella bodies', async () => {
      repository.find.mockResolvedValue([mockOrganization as Organization]);

      const result = await service.getUmbrellaBodies();

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          type: OrganizationType.UMBRELLA_BODY,
          status: OrganizationStatus.ACTIVE,
          deletedAt: expect.anything(),
        },
        order: { name: 'ASC' },
      });
    });
  });

  describe('getChildren', () => {
    it('should return child organizations', async () => {
      const child = {
        ...mockOrganization,
        id: 'child-1',
        parentId: 'org-1',
        type: OrganizationType.SACCO,
      };
      repository.find.mockResolvedValue([child as Organization]);

      const result = await service.getChildren('org-1');

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          parentId: 'org-1',
          deletedAt: expect.anything(),
        },
        order: { name: 'ASC' },
      });
    });
  });

  describe('getByCounty', () => {
    it('should return organizations by county', async () => {
      repository.find.mockResolvedValue([mockOrganization as Organization]);

      const result = await service.getByCounty('047');

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          countyCode: '047',
          status: OrganizationStatus.ACTIVE,
          deletedAt: expect.anything(),
        },
        order: { name: 'ASC' },
      });
    });
  });

  describe('updateMemberCount', () => {
    it('should update member count', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateMemberCount('org-1', 100);

      expect(repository.update).toHaveBeenCalledWith('org-1', { verifiedMembers: 100 });
    });
  });

  describe('getStats', () => {
    it('should return organization statistics', async () => {
      const orgs = [
        { ...mockOrganization, type: OrganizationType.UMBRELLA_BODY, countyCode: '047', isActive: () => true },
        { ...mockOrganization, id: 'org-2', type: OrganizationType.SACCO, countyCode: '047', isActive: () => true },
        { ...mockOrganization, id: 'org-3', type: OrganizationType.SACCO, countyCode: '001', isActive: () => false },
      ];
      repository.find.mockResolvedValue(orgs as Organization[]);

      const result = await service.getStats();

      expect(result.totalOrganizations).toBe(3);
      expect(result.activeOrganizations).toBe(2);
      expect(result.byType[OrganizationType.UMBRELLA_BODY]).toBe(1);
      expect(result.byType[OrganizationType.SACCO]).toBe(2);
      expect(result.byCounty).toContainEqual({ countyCode: '047', count: 2 });
    });
  });
});
