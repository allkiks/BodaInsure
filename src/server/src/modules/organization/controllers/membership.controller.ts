import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MembershipService } from '../services/membership.service.js';
import {
  CreateMembershipDto,
  UpdateMembershipDto,
  MemberQueryDto,
  BulkAddMembersDto,
  SuspendMembershipDto,
} from '../dto/membership.dto.js';

/**
 * Membership Controller
 * Manages user memberships in organizations
 */
@Controller('memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  /**
   * Create a new membership
   */
  @Post()
  async create(@Body() dto: CreateMembershipDto) {
    const membership = await this.membershipService.create(dto);
    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
    };
  }

  /**
   * Get membership by ID
   */
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const membership = await this.membershipService.getById(id);
    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      organizationName: membership.organization?.name,
      role: membership.role,
      status: membership.status,
      memberNumber: membership.memberNumber,
      isPrimary: membership.isPrimary,
      joinedAt: membership.joinedAt,
      expiresAt: membership.expiresAt,
    };
  }

  /**
   * Get user's memberships
   */
  @Get('user/:userId')
  async getUserMemberships(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.membershipService.getUserMemberships(userId);
  }

  /**
   * Get user's primary membership
   */
  @Get('user/:userId/primary')
  async getPrimaryMembership(@Param('userId', ParseUUIDPipe) userId: string) {
    const membership = await this.membershipService.getPrimaryMembership(userId);
    if (!membership) {
      return null;
    }
    return {
      id: membership.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization?.name,
      role: membership.role,
      status: membership.status,
    };
  }

  /**
   * Get organization members
   */
  @Get('organization/:organizationId')
  async getOrganizationMembers(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: MemberQueryDto,
  ) {
    const { members, total } = await this.membershipService.getOrganizationMembers(
      organizationId,
      query,
    );
    return {
      members,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      totalPages: Math.ceil(total / (query.limit ?? 20)),
    };
  }

  /**
   * Update membership
   */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    const membership = await this.membershipService.update(id, dto);
    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      isPrimary: membership.isPrimary,
    };
  }

  /**
   * Approve membership
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('approvedBy') approvedBy: string,
  ) {
    const membership = await this.membershipService.approve(id, approvedBy);
    return {
      id: membership.id,
      status: membership.status,
      approvedAt: membership.approvedAt,
      joinedAt: membership.joinedAt,
    };
  }

  /**
   * Suspend membership
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('suspendedBy') suspendedBy: string,
    @Body() dto: SuspendMembershipDto,
  ) {
    const membership = await this.membershipService.suspend(id, suspendedBy, dto.reason);
    return {
      id: membership.id,
      status: membership.status,
      suspendedAt: membership.suspendedAt,
    };
  }

  /**
   * Reactivate membership
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const membership = await this.membershipService.reactivate(id);
    return {
      id: membership.id,
      status: membership.status,
    };
  }

  /**
   * Revoke membership
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    await this.membershipService.revoke(id);
  }

  /**
   * Set primary organization for user
   */
  @Post('user/:userId/primary/:membershipId')
  @HttpCode(HttpStatus.OK)
  async setPrimary(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    const membership = await this.membershipService.setPrimary(userId, membershipId);
    return {
      id: membership.id,
      isPrimary: membership.isPrimary,
    };
  }

  /**
   * Check if user is member of organization
   */
  @Get('check/:userId/:organizationId')
  async checkMembership(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    const [isMember, isAdmin] = await Promise.all([
      this.membershipService.isMember(userId, organizationId),
      this.membershipService.isAdmin(userId, organizationId),
    ]);
    return { isMember, isAdmin };
  }

  /**
   * Bulk add members to organization
   */
  @Post('organization/:organizationId/bulk')
  async bulkAdd(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: BulkAddMembersDto,
  ) {
    return this.membershipService.bulkAdd(organizationId, dto.userIds, dto.role);
  }

  /**
   * Get member count for organization
   */
  @Get('organization/:organizationId/count')
  async getMemberCount(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const count = await this.membershipService.getMemberCount(organizationId);
    return { count };
  }
}
