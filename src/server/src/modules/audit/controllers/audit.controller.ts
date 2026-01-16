import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from '../services/audit.service.js';
import { AuditEventType } from '../entities/audit-event.entity.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/constants/index.js';

/**
 * Audit Controller
 * Query audit events for compliance and monitoring
 *
 * Security: Requires PLATFORM_ADMIN or INSURANCE_ADMIN role
 */
@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Query audit events
   */
  @Get()
  @ApiOperation({ summary: 'Query audit events with filters' })
  @ApiQuery({ name: 'eventType', enum: AuditEventType, required: false })
  @ApiQuery({ name: 'userId', type: String, required: false })
  @ApiQuery({ name: 'entityType', type: String, required: false })
  @ApiQuery({ name: 'entityId', type: String, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiQuery({ name: 'outcome', enum: ['success', 'failure'], required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Paginated audit events' })
  async queryEvents(
    @Query('eventType') eventType?: AuditEventType,
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('outcome') outcome?: 'success' | 'failure',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { events, total } = await this.auditService.query({
      eventType,
      userId,
      entityType,
      entityId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      outcome,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        userId: e.userId,
        actorId: e.actorId,
        entityType: e.entityType,
        entityId: e.entityId,
        description: e.description,
        outcome: e.outcome,
        channel: e.channel,
        createdAt: e.createdAt,
      })),
      total,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    };
  }

  /**
   * Get audit statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get audit event statistics' })
  @ApiQuery({ name: 'days', type: Number, required: false, description: 'Number of days (default: 30)' })
  @ApiResponse({ status: 200, description: 'Audit statistics' })
  async getStats(@Query('days') days?: string) {
    return this.auditService.getStats(days ? parseInt(days, 10) : 30);
  }

  /**
   * Get user audit trail
   */
  @Get('users/:userId')
  @ApiOperation({ summary: 'Get audit trail for a specific user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'User audit trail' })
  async getUserAuditTrail(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { events, total } = await this.auditService.getUserAuditTrail(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        description: e.description,
        outcome: e.outcome,
        details: e.details,
        createdAt: e.createdAt,
      })),
      total,
    };
  }

  /**
   * Get entity audit trail
   */
  @Get('entities/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit trail for a specific entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (e.g., settlement, policy)' })
  @ApiParam({ name: 'entityId', description: 'Entity UUID' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Entity audit trail' })
  async getEntityAuditTrail(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { events, total } = await this.auditService.getEntityAuditTrail(
      entityType,
      entityId,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      },
    );

    return {
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        userId: e.userId,
        description: e.description,
        outcome: e.outcome,
        details: e.details,
        createdAt: e.createdAt,
      })),
      total,
    };
  }

  /**
   * Get event types
   */
  @Get('event-types')
  @ApiOperation({ summary: 'Get all available audit event types' })
  @ApiResponse({ status: 200, description: 'List of event types' })
  getEventTypes() {
    return Object.values(AuditEventType);
  }
}
