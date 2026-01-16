import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../identity/guards/roles.guard.js';
import { Roles } from '../../identity/decorators/roles.decorator.js';
import { CurrentUser } from '../../identity/decorators/current-user.decorator.js';
import { TemplateService, CreateTemplateDto, UpdateTemplateDto } from '../services/template.service.js';
import { NotificationChannel, NotificationType } from '../entities/notification.entity.js';
import { TemplateStatus, NotificationTemplate } from '../entities/notification-template.entity.js';

/**
 * Template preview request DTO
 */
interface PreviewTemplateDto {
  variables: Record<string, string | number>;
}

/**
 * Template Controller
 * Full CRUD API for notification templates (SMS and Email)
 *
 * Access: Platform Admin only
 */
@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * List all templates with filtering
   */
  @Get()
  @ApiOperation({ summary: 'List notification templates' })
  @ApiQuery({ name: 'channel', enum: NotificationChannel, required: false })
  @ApiQuery({ name: 'notificationType', enum: NotificationType, required: false })
  @ApiQuery({ name: 'status', enum: TemplateStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async list(
    @Query('channel') channel?: NotificationChannel,
    @Query('notificationType') notificationType?: NotificationType,
    @Query('status') status?: TemplateStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.templateService.list({
      channel,
      notificationType,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      data: result.templates,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Get templates grouped by channel
   */
  @Get('grouped')
  @ApiOperation({ summary: 'Get templates grouped by channel' })
  @ApiResponse({ status: 200, description: 'Templates grouped by channel' })
  async getGrouped() {
    const grouped = await this.templateService.getGroupedByChannel();
    return { data: grouped };
  }

  /**
   * Get a single template by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template details' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const template = await this.templateService.findById(id);
    return { data: template };
  }

  /**
   * Create a new template
   */
  @Post()
  @ApiOperation({ summary: 'Create a new notification template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  @ApiResponse({ status: 409, description: 'Template code already exists' })
  async create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: { userId: string },
  ) {
    const template = await this.templateService.create({
      ...dto,
      createdBy: user.userId,
    });
    return { data: template };
  }

  /**
   * Update an existing template
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a notification template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: { userId: string },
  ) {
    const template = await this.templateService.update(id, {
      ...dto,
      updatedBy: user.userId,
    });
    return { data: template };
  }

  /**
   * Delete (archive) a template
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (archive) a notification template' })
  @ApiResponse({ status: 204, description: 'Template archived' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.templateService.delete(id, user.userId);
  }

  /**
   * Duplicate a template
   */
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a template' })
  @ApiResponse({ status: 201, description: 'Template duplicated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 409, description: 'New template code already exists' })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('code') newCode: string,
    @CurrentUser() user: { userId: string },
  ) {
    const template = await this.templateService.duplicate(id, newCode, user.userId);
    return { data: template };
  }

  /**
   * Preview a template with sample data
   */
  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview template with sample data' })
  @ApiResponse({ status: 200, description: 'Template preview' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    const template = await this.templateService.findById(id);
    const preview = this.templateService.preview(template, dto.variables);
    return { data: preview };
  }

  /**
   * Seed default templates
   */
  @Post('seed')
  @ApiOperation({ summary: 'Seed default templates' })
  @ApiResponse({ status: 200, description: 'Templates seeded' })
  async seedDefaults() {
    const count = await this.templateService.seedDefaults();
    return { data: { seededCount: count } };
  }

  /**
   * Get notification channels enum
   */
  @Get('enum/channels')
  @ApiOperation({ summary: 'Get available notification channels' })
  @ApiResponse({ status: 200, description: 'Notification channels' })
  async getChannels() {
    return {
      data: Object.values(NotificationChannel).map((channel) => ({
        value: channel,
        label: channel,
      })),
    };
  }

  /**
   * Get notification types enum
   */
  @Get('enum/types')
  @ApiOperation({ summary: 'Get available notification types' })
  @ApiResponse({ status: 200, description: 'Notification types' })
  async getTypes() {
    return {
      data: Object.values(NotificationType).map((type) => ({
        value: type,
        label: type.replace(/_/g, ' '),
      })),
    };
  }

  /**
   * Get template statuses enum
   */
  @Get('enum/statuses')
  @ApiOperation({ summary: 'Get available template statuses' })
  @ApiResponse({ status: 200, description: 'Template statuses' })
  async getStatuses() {
    return {
      data: Object.values(TemplateStatus).map((status) => ({
        value: status,
        label: status,
      })),
    };
  }
}
