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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ICurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { OrganizationService } from '../services/organization.service.js';
import { CreateOrganizationDto } from '../dto/create-organization.dto.js';
import { UpdateOrganizationDto } from '../dto/update-organization.dto.js';
import { OrganizationQueryDto } from '../dto/organization-query.dto.js';
import { UserRole } from '../../identity/entities/user.entity.js';
import { MembershipStatus } from '../entities/membership.entity.js';

/**
 * Organization Controller
 * Manages KBA/SACCO organizations
 *
 * Security: Requires admin roles for modification, read access for authenticated users
 */
@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * Create a new organization
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.KBA_ADMIN)
  @ApiOperation({ summary: 'Create organization', description: 'Create a new organization (KBA, SACCO, etc.)' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    const organization = await this.organizationService.create(dto);
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      type: organization.type,
      status: organization.status,
    };
  }

  /**
   * Get organization by ID
   * GAP-004: SACCO_admin can only view their own org or parent Umbrella Body
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  @ApiResponse({ status: 403, description: 'Forbidden - cannot access this organization' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const organization = await this.organizationService.getById(id, user);
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      type: organization.type,
      status: organization.status,
      description: organization.description,
      registrationNumber: organization.registrationNumber,
      contactPhone: organization.contactPhone,
      contactEmail: organization.contactEmail,
      address: organization.address,
      countyCode: organization.countyCode,
      subCounty: organization.subCounty,
      ward: organization.ward,
      leaderName: organization.leaderName,
      leaderPhone: organization.leaderPhone,
      secretaryName: organization.secretaryName,
      treasurerName: organization.treasurerName,
      estimatedMembers: organization.estimatedMembers,
      verifiedMembers: organization.verifiedMembers,
      parentId: organization.parentId,
      verifiedAt: organization.verifiedAt,
      createdAt: organization.createdAt,
    };
  }

  /**
   * Get organization by code
   */
  @Get('code/:code')
  async getByCode(@Param('code') code: string) {
    const organization = await this.organizationService.getByCode(code);
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      type: organization.type,
      status: organization.status,
    };
  }

  /**
   * List organizations with filtering
   * GAP-004: Filter organizations based on user role and scope
   */
  @Get()
  async list(
    @Query() query: OrganizationQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    // Merge q into search for compatibility
    const search = query.search || query.q;

    const { organizations, total } = await this.organizationService.list({
      type: query.type,
      status: query.status,
      countyCode: query.countyCode,
      parentId: query.parentId,
      search,
      page: query.page,
      limit: query.limit,
      user,
    });
    return {
      organizations,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      totalPages: Math.ceil(total / (query.limit ?? 20)),
    };
  }

  /**
   * Update organization
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.KBA_ADMIN, UserRole.SACCO_ADMIN)
  @ApiOperation({ summary: 'Update organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    const organization = await this.organizationService.update(id, dto);
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      status: organization.status,
      updatedAt: organization.updatedAt,
    };
  }

  /**
   * Verify/activate organization
   */
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.KBA_ADMIN)
  @ApiOperation({ summary: 'Verify organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization verified' })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const organization = await this.organizationService.verify(id, user.userId);
    return {
      id: organization.id,
      status: organization.status,
      verifiedAt: organization.verifiedAt,
    };
  }

  /**
   * Suspend organization
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.KBA_ADMIN)
  @ApiOperation({ summary: 'Suspend organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization suspended' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    const organization = await this.organizationService.suspend(id, reason);
    return {
      id: organization.id,
      status: organization.status,
    };
  }

  /**
   * Reactivate organization
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.KBA_ADMIN)
  @ApiOperation({ summary: 'Reactivate organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization reactivated' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const organization = await this.organizationService.reactivate(id);
    return {
      id: organization.id,
      status: organization.status,
    };
  }

  /**
   * Delete organization (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Delete organization (soft delete)' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 204, description: 'Organization deleted' })
  @ApiResponse({ status: 403, description: 'Platform admin only' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.organizationService.delete(id);
  }

  /**
   * Get umbrella bodies (top-level organizations)
   */
  @Get('hierarchy/umbrella-bodies')
  async getUmbrellaBodies() {
    const organizations = await this.organizationService.getUmbrellaBodies();
    return organizations.map((org) => ({
      id: org.id,
      code: org.code,
      name: org.name,
      countyCode: org.countyCode,
      verifiedMembers: org.verifiedMembers,
    }));
  }

  /**
   * Get children of an organization
   */
  @Get(':id/children')
  async getChildren(@Param('id', ParseUUIDPipe) id: string) {
    const children = await this.organizationService.getChildren(id);
    return children.map((org) => ({
      id: org.id,
      code: org.code,
      name: org.name,
      type: org.type,
      status: org.status,
      verifiedMembers: org.verifiedMembers,
    }));
  }

  /**
   * Get full hierarchy tree
   */
  @Get(':id/hierarchy')
  async getHierarchy(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getHierarchyTree(id);
  }

  /**
   * Get global organization statistics
   */
  @Get('stats/overview')
  async getGlobalStats() {
    return this.organizationService.getStats();
  }

  /**
   * Get organization-specific statistics
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get organization statistics' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization statistics' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganizationStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getOrganizationStats(id);
  }

  /**
   * Get organization members
   * GAP-004: SACCO_admin can only view members of their own organization
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization members' })
  @ApiResponse({ status: 403, description: 'Forbidden - cannot access members of this organization' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
    @Query('q') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: ICurrentUser,
  ) {
    const { members, total } = await this.organizationService.getMembers(id, {
      status: status as MembershipStatus | undefined,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      user,
    });

    return {
      members,
      total,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      totalPages: Math.ceil(total / (limit ? parseInt(limit, 10) : 20)),
    };
  }
}
