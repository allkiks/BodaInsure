import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { MembershipService } from './membership.service.js';
import { OrganizationService } from './organization.service.js';
import {
  Membership,
  MembershipStatus,
  MemberRole,
} from '../entities/membership.entity.js';

describe('MembershipService', () => {
  let service: MembershipService;
  let repository: jest.Mocked<Repository<Membership>>;
  let organizationService: jest.Mocked<OrganizationService>;

  const mockOrganization = {
    id: 'org-1',
    name: 'KBA Nairobi',
    code: 'KBA-NBI',
  };

  const mockMembership: Partial<Membership> = {
    id: 'mem-1',
    userId: 'user-1',
    organizationId: 'org-1',
    role: MemberRole.MEMBER,
    status: MembershipStatus.ACTIVE,
    isPrimary: true,
    joinedAt: new Date(),
    organization: mockOrganization as any,
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        {
          provide: getRepositoryToken(Membership),
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
        {
          provide: OrganizationService,
          useValue: {
            getById: jest.fn(),
            updateMemberCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
    repository = module.get(getRepositoryToken(Membership));
    organizationService = module.get(OrganizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new membership', async () => {
      organizationService.getById.mockResolvedValue(mockOrganization as any);
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockMembership as Membership);
      repository.save.mockResolvedValue(mockMembership as Membership);

      const result = await service.create({
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result).toEqual(mockMembership);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          status: MembershipStatus.PENDING,
        }),
      );
    });

    it('should throw ConflictException for existing membership', async () => {
      organizationService.getById.mockResolvedValue(mockOrganization as any);
      repository.findOne.mockResolvedValue(mockMembership as Membership);

      await expect(
        service.create({
          userId: 'user-1',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should remove primary from other memberships when setting new primary', async () => {
      organizationService.getById.mockResolvedValue(mockOrganization as any);
      repository.findOne.mockResolvedValue(null);
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.create.mockReturnValue({ ...mockMembership, isPrimary: true } as Membership);
      repository.save.mockResolvedValue({ ...mockMembership, isPrimary: true } as Membership);

      await service.create({
        userId: 'user-1',
        organizationId: 'org-1',
        isPrimary: true,
      });

      expect(repository.update).toHaveBeenCalledWith(
        { userId: 'user-1', isPrimary: true },
        { isPrimary: false },
      );
    });
  });

  describe('getById', () => {
    it('should return membership by ID', async () => {
      repository.findOne.mockResolvedValue(mockMembership as Membership);

      const result = await service.getById('mem-1');

      expect(result).toEqual(mockMembership);
    });

    it('should throw NotFoundException for missing membership', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserMemberships', () => {
    it('should return user memberships', async () => {
      repository.find.mockResolvedValue([mockMembership as Membership]);

      const result = await service.getUserMemberships('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'mem-1',
        organizationId: 'org-1',
        organizationName: 'KBA Nairobi',
        role: MemberRole.MEMBER,
        isPrimary: true,
      });
    });
  });

  describe('getPrimaryMembership', () => {
    it('should return primary membership', async () => {
      repository.findOne.mockResolvedValue(mockMembership as Membership);

      const result = await service.getPrimaryMembership('user-1');

      expect(result).toEqual(mockMembership);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', isPrimary: true },
        relations: ['organization'],
      });
    });

    it('should return null if no primary membership', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getPrimaryMembership('user-1');

      expect(result).toBeNull();
    });
  });

  describe('getOrganizationMembers', () => {
    it('should return organization members with pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockMembership], 1]);

      const result = await service.getOrganizationMembers('org-1', { page: 1, limit: 20 });

      expect(result.members).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockMembership], 1]);

      await service.getOrganizationMembers('org-1', { status: MembershipStatus.ACTIVE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('m.status = :status', {
        status: MembershipStatus.ACTIVE,
      });
    });

    it('should filter by role', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockMembership], 1]);

      await service.getOrganizationMembers('org-1', { role: MemberRole.ADMIN });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('m.role = :role', {
        role: MemberRole.ADMIN,
      });
    });
  });

  describe('approve', () => {
    it('should approve pending membership', async () => {
      const pending = { ...mockMembership, status: MembershipStatus.PENDING };
      const approved = {
        ...mockMembership,
        status: MembershipStatus.ACTIVE,
        approvedBy: 'admin-1',
        approvedAt: expect.any(Date),
        joinedAt: expect.any(Date),
      };
      repository.findOne.mockResolvedValue(pending as Membership);
      repository.save.mockResolvedValue(approved as Membership);
      repository.count.mockResolvedValue(10);
      organizationService.updateMemberCount.mockResolvedValue(undefined);

      const result = await service.approve('mem-1', 'admin-1');

      expect(result.status).toBe(MembershipStatus.ACTIVE);
      expect(result.approvedBy).toBe('admin-1');
    });

    it('should throw BadRequestException if not pending', async () => {
      repository.findOne.mockResolvedValue(mockMembership as Membership);

      await expect(service.approve('mem-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('suspend', () => {
    it('should suspend membership with reason', async () => {
      const suspended = {
        ...mockMembership,
        status: MembershipStatus.SUSPENDED,
        suspendedBy: 'admin-1',
        suspendedAt: new Date(),
        suspensionReason: 'Policy violation',
      };
      repository.findOne.mockResolvedValue(mockMembership as Membership);
      repository.save.mockResolvedValue(suspended as Membership);

      const result = await service.suspend('mem-1', 'admin-1', 'Policy violation');

      expect(result.status).toBe(MembershipStatus.SUSPENDED);
      expect(result.suspensionReason).toBe('Policy violation');
    });
  });

  describe('reactivate', () => {
    it('should reactivate suspended membership', async () => {
      const suspended = { ...mockMembership, status: MembershipStatus.SUSPENDED };
      const active = { ...mockMembership, status: MembershipStatus.ACTIVE };
      repository.findOne.mockResolvedValue(suspended as Membership);
      repository.save.mockResolvedValue(active as Membership);

      const result = await service.reactivate('mem-1');

      expect(result.status).toBe(MembershipStatus.ACTIVE);
    });

    it('should throw BadRequestException if not suspended', async () => {
      const active = { ...mockMembership, status: MembershipStatus.ACTIVE };
      repository.findOne.mockResolvedValue(active as Membership);

      await expect(service.reactivate('mem-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('revoke', () => {
    it('should revoke membership', async () => {
      repository.findOne.mockResolvedValue(mockMembership as Membership);
      repository.save.mockResolvedValue({
        ...mockMembership,
        status: MembershipStatus.REVOKED,
      } as Membership);
      repository.count.mockResolvedValue(9);
      organizationService.updateMemberCount.mockResolvedValue(undefined);

      await service.revoke('mem-1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MembershipStatus.REVOKED }),
      );
    });
  });

  describe('update', () => {
    it('should update membership', async () => {
      const updated = { ...mockMembership, role: MemberRole.ADMIN };
      repository.findOne.mockResolvedValue(mockMembership as Membership);
      repository.save.mockResolvedValue(updated as Membership);

      const result = await service.update('mem-1', { role: MemberRole.ADMIN });

      expect(result.role).toBe(MemberRole.ADMIN);
    });

    it('should remove primary from other memberships when setting new primary', async () => {
      const notPrimary = { ...mockMembership, isPrimary: false };
      repository.findOne.mockResolvedValue(notPrimary as Membership);
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.save.mockResolvedValue({ ...mockMembership, isPrimary: true } as Membership);

      await service.update('mem-1', { isPrimary: true });

      expect(repository.update).toHaveBeenCalledWith(
        { userId: 'user-1', isPrimary: true },
        { isPrimary: false },
      );
    });
  });

  describe('updateRole', () => {
    it('should update membership role', async () => {
      const updated = { ...mockMembership, role: MemberRole.CHAIRPERSON };
      repository.findOne.mockResolvedValue(mockMembership as Membership);
      repository.save.mockResolvedValue(updated as Membership);

      const result = await service.updateRole('mem-1', MemberRole.CHAIRPERSON);

      expect(result.role).toBe(MemberRole.CHAIRPERSON);
    });
  });

  describe('setPrimary', () => {
    it('should set primary organization', async () => {
      repository.findOne.mockResolvedValue(mockMembership as Membership);
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.save.mockResolvedValue({ ...mockMembership, isPrimary: true } as Membership);

      const result = await service.setPrimary('user-1', 'mem-1');

      expect(result.isPrimary).toBe(true);
    });

    it('should throw BadRequestException if membership does not belong to user', async () => {
      const otherMembership = { ...mockMembership, userId: 'other-user' };
      repository.findOne.mockResolvedValue(otherMembership as Membership);

      await expect(service.setPrimary('user-1', 'mem-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('isMember', () => {
    it('should return true if user is active member', async () => {
      repository.findOne.mockResolvedValue(mockMembership as Membership);

      const result = await service.isMember('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false if not a member', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.isMember('user-1', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true if user is admin', async () => {
      const admin = { ...mockMembership, role: MemberRole.ADMIN };
      repository.findOne.mockResolvedValue(admin as Membership);

      const result = await service.isAdmin('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return true if user is chairperson', async () => {
      const chair = { ...mockMembership, role: MemberRole.CHAIRPERSON };
      repository.findOne.mockResolvedValue(chair as Membership);

      const result = await service.isAdmin('user-1', 'org-1');

      expect(result).toBe(true);
    });

    it('should return false if not admin', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.isAdmin('user-1', 'org-1');

      expect(result).toBe(false);
    });
  });

  describe('getMemberCount', () => {
    it('should return member count', async () => {
      repository.count.mockResolvedValue(50);

      const result = await service.getMemberCount('org-1');

      expect(result).toBe(50);
    });
  });

  describe('bulkAdd', () => {
    it('should bulk add members', async () => {
      organizationService.getById.mockResolvedValue(mockOrganization as any);
      repository.find.mockResolvedValue([]);
      repository.save.mockResolvedValue([] as any);
      repository.count.mockResolvedValue(3);
      organizationService.updateMemberCount.mockResolvedValue(undefined);

      const result = await service.bulkAdd('org-1', ['user-1', 'user-2', 'user-3']);

      expect(result).toEqual({ added: 3, skipped: 0 });
    });

    it('should skip existing members', async () => {
      organizationService.getById.mockResolvedValue(mockOrganization as any);
      repository.find.mockResolvedValue([
        { userId: 'user-1' } as Membership,
      ]);
      repository.save.mockResolvedValue([] as any);
      repository.count.mockResolvedValue(3);
      organizationService.updateMemberCount.mockResolvedValue(undefined);

      const result = await service.bulkAdd('org-1', ['user-1', 'user-2', 'user-3']);

      expect(result).toEqual({ added: 2, skipped: 1 });
    });
  });
});
