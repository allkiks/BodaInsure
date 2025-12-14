import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditService } from '../services/audit.service.js';
import { AuditEventType } from '../entities/audit-event.entity.js';

/**
 * Audit Controller
 * Query audit events (admin only in production)
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Query audit events
   */
  @Get()
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
  async getStats(@Query('days') days?: string) {
    return this.auditService.getStats(days ? parseInt(days, 10) : 30);
  }

  /**
   * Get user audit trail
   */
  @Get('users/:userId')
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
  getEventTypes() {
    return Object.values(AuditEventType);
  }
}
