import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Membership,
  MembershipStatus,
  MemberRole,
} from '../entities/membership.entity.js';
import { OrganizationService } from './organization.service.js';

/**
 * Create membership request
 */
export interface CreateMembershipRequest {
  userId: string;
  organizationId: string;
  role?: MemberRole;
  memberNumber?: string;
  isPrimary?: boolean;
}

/**
 * Update membership request
 */
export interface UpdateMembershipRequest {
  role?: MemberRole;
  memberNumber?: string;
  isPrimary?: boolean;
  expiresAt?: Date;
}

/**
 * Membership summary
 */
export interface MembershipSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  role: MemberRole;
  status: MembershipStatus;
  memberNumber: string | null;
  isPrimary: boolean;
  joinedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Member details
 */
export interface MemberDetails {
  id: string;
  userId: string;
  role: MemberRole;
  status: MembershipStatus;
  memberNumber: string | null;
  joinedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Membership Service
 * Manages user memberships in organizations
 */
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    private readonly organizationService: OrganizationService,
  ) {}

  /**
   * Create a new membership
   */
  async create(request: CreateMembershipRequest): Promise<Membership> {
    const { userId, organizationId, role = MemberRole.MEMBER, memberNumber, isPrimary = false } = request;

    // Validate organization exists
    await this.organizationService.getById(organizationId);

    // Check for existing membership
    const existing = await this.membershipRepository.findOne({
      where: { userId, organizationId },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    // If setting as primary, remove primary from other memberships
    if (isPrimary) {
      await this.membershipRepository.update(
        { userId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const membership = this.membershipRepository.create({
      userId,
      organizationId,
      role,
      memberNumber,
      isPrimary,
      status: MembershipStatus.PENDING,
    });

    await this.membershipRepository.save(membership);

    this.logger.log(`Created membership for user ${userId} in org ${organizationId}`);

    return membership;
  }

  /**
   * Get membership by ID
   */
  async getById(id: string): Promise<Membership> {
    const membership = await this.membershipRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!membership) {
      throw new NotFoundException(`Membership not found: ${id}`);
    }

    return membership;
  }

  /**
   * Get user's memberships
   */
  async getUserMemberships(userId: string): Promise<MembershipSummary[]> {
    const memberships = await this.membershipRepository.find({
      where: { userId },
      relations: ['organization'],
      order: { isPrimary: 'DESC', joinedAt: 'DESC' },
    });

    return memberships.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization?.name ?? '',
      organizationCode: m.organization?.code ?? '',
      role: m.role,
      status: m.status,
      memberNumber: m.memberNumber ?? null,
      isPrimary: m.isPrimary,
      joinedAt: m.joinedAt ?? null,
      expiresAt: m.expiresAt ?? null,
    }));
  }

  /**
   * Get user's primary organization membership
   */
  async getPrimaryMembership(userId: string): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { userId, isPrimary: true },
      relations: ['organization'],
    });
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(
    organizationId: string,
    options?: {
      status?: MembershipStatus;
      role?: MemberRole;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ members: MemberDetails[]; total: number }> {
    const { status, role, page = 1, limit = 20 } = options ?? {};

    const query = this.membershipRepository
      .createQueryBuilder('m')
      .where('m.organization_id = :organizationId', { organizationId });

    if (status) {
      query.andWhere('m.status = :status', { status });
    }

    if (role) {
      query.andWhere('m.role = :role', { role });
    }

    const [memberships, total] = await query
      .orderBy('m.role', 'ASC')
      .addOrderBy('m.joined_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const members: MemberDetails[] = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      memberNumber: m.memberNumber ?? null,
      joinedAt: m.joinedAt ?? null,
      expiresAt: m.expiresAt ?? null,
    }));

    return { members, total };
  }

  /**
   * Approve membership
   */
  async approve(id: string, approvedBy: string): Promise<Membership> {
    const membership = await this.getById(id);

    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Membership is not pending approval');
    }

    membership.status = MembershipStatus.ACTIVE;
    membership.approvedBy = approvedBy;
    membership.approvedAt = new Date();
    membership.joinedAt = new Date();

    await this.membershipRepository.save(membership);

    // Update organization member count
    await this.updateOrganizationMemberCount(membership.organizationId);

    this.logger.log(`Approved membership ${id}`);

    return membership;
  }

  /**
   * Suspend membership
   */
  async suspend(id: string, suspendedBy: string, reason?: string): Promise<Membership> {
    const membership = await this.getById(id);

    membership.status = MembershipStatus.SUSPENDED;
    membership.suspendedBy = suspendedBy;
    membership.suspendedAt = new Date();
    membership.suspensionReason = reason;

    await this.membershipRepository.save(membership);

    this.logger.log(`Suspended membership ${id}`);

    return membership;
  }

  /**
   * Reactivate membership
   */
  async reactivate(id: string): Promise<Membership> {
    const membership = await this.getById(id);

    if (membership.status !== MembershipStatus.SUSPENDED) {
      throw new BadRequestException('Membership is not suspended');
    }

    membership.status = MembershipStatus.ACTIVE;
    membership.suspendedBy = undefined;
    membership.suspendedAt = undefined;
    membership.suspensionReason = undefined;

    await this.membershipRepository.save(membership);

    this.logger.log(`Reactivated membership ${id}`);

    return membership;
  }

  /**
   * Revoke membership
   */
  async revoke(id: string): Promise<void> {
    const membership = await this.getById(id);
    const orgId = membership.organizationId;

    membership.status = MembershipStatus.REVOKED;
    await this.membershipRepository.save(membership);

    // Update organization member count
    await this.updateOrganizationMemberCount(orgId);

    this.logger.log(`Revoked membership ${id}`);
  }

  /**
   * Update membership
   */
  async update(id: string, request: UpdateMembershipRequest): Promise<Membership> {
    const membership = await this.getById(id);

    // If setting as primary, remove primary from other memberships
    if (request.isPrimary && !membership.isPrimary) {
      await this.membershipRepository.update(
        { userId: membership.userId, isPrimary: true },
        { isPrimary: false },
      );
    }

    Object.assign(membership, request);
    await this.membershipRepository.save(membership);

    return membership;
  }

  /**
   * Update membership role
   */
  async updateRole(id: string, role: MemberRole): Promise<Membership> {
    const membership = await this.getById(id);

    membership.role = role;
    await this.membershipRepository.save(membership);

    this.logger.log(`Updated role for membership ${id} to ${role}`);

    return membership;
  }

  /**
   * Set primary organization
   */
  async setPrimary(userId: string, membershipId: string): Promise<Membership> {
    const membership = await this.getById(membershipId);

    if (membership.userId !== userId) {
      throw new BadRequestException('Membership does not belong to user');
    }

    // Remove primary from all user's memberships
    await this.membershipRepository.update(
      { userId, isPrimary: true },
      { isPrimary: false },
    );

    // Set this one as primary
    membership.isPrimary = true;
    await this.membershipRepository.save(membership);

    return membership;
  }

  /**
   * Check if user is member of organization
   */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.membershipRepository.findOne({
      where: {
        userId,
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    return !!membership;
  }

  /**
   * Check if user is admin of organization
   */
  async isAdmin(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.membershipRepository.findOne({
      where: {
        userId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        role: In([MemberRole.ADMIN, MemberRole.CHAIRPERSON]),
      },
    });

    return !!membership;
  }

  /**
   * Get member count for organization
   */
  async getMemberCount(organizationId: string): Promise<number> {
    return this.membershipRepository.count({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
    });
  }

  /**
   * Bulk add members to organization
   */
  async bulkAdd(
    organizationId: string,
    userIds: string[],
    role: MemberRole = MemberRole.MEMBER,
  ): Promise<{ added: number; skipped: number }> {
    // Validate organization
    await this.organizationService.getById(organizationId);

    // Get existing memberships
    const existing = await this.membershipRepository.find({
      where: {
        organizationId,
        userId: In(userIds),
      },
    });

    const existingUserIds = new Set(existing.map((m) => m.userId));

    // Create new memberships
    const newMemberships = userIds
      .filter((id) => !existingUserIds.has(id))
      .map((userId) =>
        this.membershipRepository.create({
          userId,
          organizationId,
          role,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        }),
      );

    if (newMemberships.length > 0) {
      await this.membershipRepository.save(newMemberships);
    }

    // Update member count
    await this.updateOrganizationMemberCount(organizationId);

    return {
      added: newMemberships.length,
      skipped: existingUserIds.size,
    };
  }

  /**
   * Update organization member count
   */
  private async updateOrganizationMemberCount(organizationId: string): Promise<void> {
    const count = await this.getMemberCount(organizationId);
    await this.organizationService.updateMemberCount(organizationId, count);
  }
}
