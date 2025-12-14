import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  Organization,
  OrganizationType,
  OrganizationStatus,
} from '../entities/organization.entity.js';

/**
 * Create organization request
 */
export interface CreateOrganizationRequest {
  name: string;
  code: string;
  type: OrganizationType;
  parentId?: string;
  description?: string;
  registrationNumber?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  countyCode?: string;
  subCounty?: string;
  ward?: string;
  leaderName?: string;
  leaderPhone?: string;
  estimatedMembers?: number;
}

/**
 * Update organization request
 */
export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  countyCode?: string;
  subCounty?: string;
  ward?: string;
  leaderName?: string;
  leaderPhone?: string;
  secretaryName?: string;
  secretaryPhone?: string;
  treasurerName?: string;
  treasurerPhone?: string;
  estimatedMembers?: number;
  commissionRate?: number;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  mpesaNumber?: string;
  logoUrl?: string;
}

/**
 * Organization summary for listings
 */
export interface OrganizationSummary {
  id: string;
  name: string;
  code: string;
  type: OrganizationType;
  status: OrganizationStatus;
  countyCode: string | null;
  memberCount: number;
  childCount: number;
}

/**
 * Organization statistics
 */
export interface OrganizationStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalMembers: number;
  byType: Record<OrganizationType, number>;
  byCounty: Array<{ countyCode: string; count: number }>;
}

/**
 * Organization Service
 * Manages organizations (KBA, SACCOs, etc.)
 */
@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Create a new organization
   */
  async create(request: CreateOrganizationRequest): Promise<Organization> {
    // Check for duplicate code
    const existing = await this.organizationRepository.findOne({
      where: { code: request.code },
    });

    if (existing) {
      throw new ConflictException(`Organization with code ${request.code} already exists`);
    }

    // Validate parent if provided
    if (request.parentId) {
      const parent = await this.organizationRepository.findOne({
        where: { id: request.parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Parent organization not found: ${request.parentId}`);
      }
    }

    const organization = this.organizationRepository.create({
      ...request,
      status: OrganizationStatus.PENDING,
    });

    await this.organizationRepository.save(organization);

    this.logger.log(`Created organization: ${organization.code} (${organization.name})`);

    return organization;
  }

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['parent'],
    });

    if (!organization) {
      throw new NotFoundException(`Organization not found: ${id}`);
    }

    return organization;
  }

  /**
   * Get organization by code
   */
  async getByCode(code: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { code, deletedAt: IsNull() },
      relations: ['parent'],
    });

    if (!organization) {
      throw new NotFoundException(`Organization not found: ${code}`);
    }

    return organization;
  }

  /**
   * Update organization
   */
  async update(id: string, request: UpdateOrganizationRequest): Promise<Organization> {
    const organization = await this.getById(id);

    Object.assign(organization, request);
    await this.organizationRepository.save(organization);

    this.logger.log(`Updated organization: ${organization.code}`);

    return organization;
  }

  /**
   * Verify/activate organization
   */
  async verify(id: string, verifiedBy: string): Promise<Organization> {
    const organization = await this.getById(id);

    organization.status = OrganizationStatus.ACTIVE;
    organization.verifiedAt = new Date();
    organization.verifiedBy = verifiedBy;

    await this.organizationRepository.save(organization);

    this.logger.log(`Verified organization: ${organization.code}`);

    return organization;
  }

  /**
   * Suspend organization
   */
  async suspend(id: string, reason?: string): Promise<Organization> {
    const organization = await this.getById(id);

    organization.status = OrganizationStatus.SUSPENDED;
    if (reason) {
      organization.metadata = { ...organization.metadata, suspensionReason: reason };
    }

    await this.organizationRepository.save(organization);

    this.logger.log(`Suspended organization: ${organization.code}`);

    return organization;
  }

  /**
   * Reactivate organization
   */
  async reactivate(id: string): Promise<Organization> {
    const organization = await this.getById(id);

    organization.status = OrganizationStatus.ACTIVE;

    await this.organizationRepository.save(organization);

    this.logger.log(`Reactivated organization: ${organization.code}`);

    return organization;
  }

  /**
   * Soft delete organization
   */
  async delete(id: string): Promise<void> {
    const organization = await this.getById(id);

    organization.status = OrganizationStatus.INACTIVE;
    organization.deletedAt = new Date();

    await this.organizationRepository.save(organization);

    this.logger.log(`Deleted organization: ${organization.code}`);
  }

  /**
   * List organizations with filtering
   */
  async list(options?: {
    type?: OrganizationType;
    status?: OrganizationStatus;
    countyCode?: string;
    parentId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ organizations: OrganizationSummary[]; total: number }> {
    const {
      type,
      status,
      countyCode,
      parentId,
      search,
      page = 1,
      limit = 20,
    } = options ?? {};

    const query = this.organizationRepository
      .createQueryBuilder('org')
      .where('org.deleted_at IS NULL');

    if (type) {
      query.andWhere('org.type = :type', { type });
    }

    if (status) {
      query.andWhere('org.status = :status', { status });
    }

    if (countyCode) {
      query.andWhere('org.county_code = :countyCode', { countyCode });
    }

    if (parentId) {
      query.andWhere('org.parent_id = :parentId', { parentId });
    } else if (parentId === null) {
      query.andWhere('org.parent_id IS NULL');
    }

    if (search) {
      query.andWhere(
        '(org.name ILIKE :search OR org.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [organizations, total] = await query
      .orderBy('org.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get child counts for each organization
    const orgIds = organizations.map((o) => o.id);
    const childCounts = await this.getChildCounts(orgIds);

    const summaries: OrganizationSummary[] = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      code: org.code,
      type: org.type,
      status: org.status,
      countyCode: org.countyCode ?? null,
      memberCount: org.verifiedMembers,
      childCount: childCounts[org.id] ?? 0,
    }));

    return { organizations: summaries, total };
  }

  /**
   * Get top-level organizations (umbrella bodies)
   */
  async getUmbrellaBodies(): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: {
        type: OrganizationType.UMBRELLA_BODY,
        status: OrganizationStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get organization hierarchy (children)
   */
  async getChildren(parentId: string): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: {
        parentId,
        deletedAt: IsNull(),
      },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get full hierarchy tree for an organization
   */
  async getHierarchyTree(rootId: string): Promise<{
    id: string;
    code: string;
    name: string;
    type: OrganizationType;
    children: Array<{
      id: string;
      code: string;
      name: string;
      type: OrganizationType;
      children: Organization[];
    }>;
  }> {
    const root = await this.getById(rootId);
    const children = await this.getChildren(rootId);

    // Recursively get children
    const childrenWithNested = await Promise.all(
      children.map(async (child) => {
        const nested = await this.getChildren(child.id);
        return {
          id: child.id,
          code: child.code,
          name: child.name,
          type: child.type,
          children: nested,
        };
      }),
    );

    return {
      id: root.id,
      code: root.code,
      name: root.name,
      type: root.type,
      children: childrenWithNested,
    };
  }

  /**
   * Get organizations by county
   */
  async getByCounty(countyCode: string): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: {
        countyCode,
        status: OrganizationStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      order: { name: 'ASC' },
    });
  }

  /**
   * Update member count for an organization
   */
  async updateMemberCount(id: string, count: number): Promise<void> {
    await this.organizationRepository.update(id, { verifiedMembers: count });
  }

  /**
   * Get organization statistics
   */
  async getStats(): Promise<OrganizationStats> {
    const organizations = await this.organizationRepository.find({
      where: { deletedAt: IsNull() },
    });

    const stats: OrganizationStats = {
      totalOrganizations: organizations.length,
      activeOrganizations: organizations.filter((o) => o.isActive()).length,
      totalMembers: organizations.reduce((sum, o) => sum + o.verifiedMembers, 0),
      byType: {} as Record<OrganizationType, number>,
      byCounty: [],
    };

    // Count by type
    for (const type of Object.values(OrganizationType)) {
      stats.byType[type] = organizations.filter((o) => o.type === type).length;
    }

    // Count by county
    const countyCounts: Record<string, number> = {};
    for (const org of organizations) {
      if (org.countyCode) {
        countyCounts[org.countyCode] = (countyCounts[org.countyCode] ?? 0) + 1;
      }
    }
    stats.byCounty = Object.entries(countyCounts).map(([countyCode, count]) => ({
      countyCode,
      count,
    }));

    return stats;
  }

  /**
   * Get child counts for multiple organizations
   */
  private async getChildCounts(parentIds: string[]): Promise<Record<string, number>> {
    if (parentIds.length === 0) return {};

    const results = await this.organizationRepository
      .createQueryBuilder('org')
      .select('org.parent_id', 'parentId')
      .addSelect('COUNT(*)', 'count')
      .where('org.parent_id IN (:...parentIds)', { parentIds })
      .andWhere('org.deleted_at IS NULL')
      .groupBy('org.parent_id')
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.parentId] = parseInt(row.count, 10);
    }

    return counts;
  }
}
