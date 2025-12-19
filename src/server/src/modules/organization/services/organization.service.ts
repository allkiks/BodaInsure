import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import {
  Organization,
  OrganizationType,
  OrganizationStatus,
} from '../entities/organization.entity.js';
import { MembershipStatus } from '../entities/membership.entity.js';

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
 * Single organization statistics
 */
export interface SingleOrganizationStats {
  totalMembers: number;
  activeMembers: number;
  enrolledMembers: number;
  complianceRate: number;
}

/**
 * Member with user info
 */
export interface MemberWithUser {
  id: string;
  userId: string;
  role: string;
  status: string;
  memberNumber: string | null;
  joinedAt: Date | null;
  user: {
    id: string;
    phone: string;
    fullName: string | null;
    kycStatus: string;
  };
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
    private readonly dataSource: DataSource,
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

  /**
   * Get statistics for a specific organization
   */
  async getOrganizationStats(id: string): Promise<SingleOrganizationStats> {
    // Verify organization exists
    await this.getById(id);

    // Count members
    const [memberStats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE m.status = 'ACTIVE') as active_members
      FROM memberships m
      WHERE m.organization_id = $1
    `, [id]);

    // Count members with active policies (enrolled)
    const [enrolledStats] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT m.user_id) as enrolled_members
      FROM memberships m
      JOIN policies p ON p.user_id = m.user_id
      WHERE m.organization_id = $1
        AND m.status = 'ACTIVE'
        AND p.status = 'ACTIVE'
    `, [id]);

    const totalMembers = parseInt(memberStats?.total_members || '0', 10);
    const activeMembers = parseInt(memberStats?.active_members || '0', 10);
    const enrolledMembers = parseInt(enrolledStats?.enrolled_members || '0', 10);
    const complianceRate = activeMembers > 0 ? (enrolledMembers / activeMembers) * 100 : 0;

    return {
      totalMembers,
      activeMembers,
      enrolledMembers,
      complianceRate: Math.round(complianceRate * 100) / 100,
    };
  }

  /**
   * Get members of an organization
   */
  async getMembers(
    organizationId: string,
    options?: {
      status?: MembershipStatus;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ members: MemberWithUser[]; total: number }> {
    // Verify organization exists
    await this.getById(organizationId);

    const { status, search, page = 1, limit = 20 } = options ?? {};

    // Build query to get members with user info
    let query = `
      SELECT
        m.id,
        m.user_id as "userId",
        m.role,
        m.status,
        m.member_number as "memberNumber",
        m.joined_at as "joinedAt",
        u.id as "user_id",
        u.phone as "user_phone",
        u.full_name as "user_fullName",
        u.kyc_status as "user_kycStatus"
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = $1
        AND u.deleted_at IS NULL
    `;

    const params: (string | number)[] = [organizationId];
    let paramIndex = 2;

    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        u.phone ILIKE $${paramIndex}
        OR u.full_name ILIKE $${paramIndex}
        OR m.member_number ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const [countResult] = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult?.total || '0', 10);

    // Add pagination
    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const rows = await this.dataSource.query(query, params);

    const members: MemberWithUser[] = rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId: row.userId as string,
      role: row.role as string,
      status: row.status as string,
      memberNumber: row.memberNumber as string | null,
      joinedAt: row.joinedAt as Date | null,
      user: {
        id: row.user_id as string,
        phone: row.user_phone as string,
        fullName: row.user_fullName as string | null,
        kycStatus: row.user_kycStatus as string,
      },
    }));

    return { members, total };
  }
}
