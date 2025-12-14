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
import { OrganizationService } from '../services/organization.service.js';
import { CreateOrganizationDto } from '../dto/create-organization.dto.js';
import { UpdateOrganizationDto } from '../dto/update-organization.dto.js';
import { OrganizationQueryDto } from '../dto/organization-query.dto.js';

/**
 * Organization Controller
 * Manages KBA/SACCO organizations
 */
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * Create a new organization
   */
  @Post()
  async create(@Body() dto: CreateOrganizationDto) {
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
   */
  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const organization = await this.organizationService.getById(id);
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
   */
  @Get()
  async list(@Query() query: OrganizationQueryDto) {
    const { organizations, total } = await this.organizationService.list(query);
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
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
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('verifiedBy') verifiedBy: string,
  ) {
    const organization = await this.organizationService.verify(id, verifiedBy);
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
   * Get organization statistics
   */
  @Get('stats/overview')
  async getStats() {
    return this.organizationService.getStats();
  }
}
