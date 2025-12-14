import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditEvent, AuditEventType } from '../entities/audit-event.entity.js';

/**
 * Log audit event request
 */
export interface LogAuditEventRequest {
  eventType: AuditEventType;
  userId?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  channel?: string;
  outcome?: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  eventType?: AuditEventType;
  userId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  outcome?: 'success' | 'failure';
  page?: number;
  limit?: number;
}

/**
 * Audit Service
 * Manages immutable audit logging
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepository: Repository<AuditEvent>,
  ) {}

  /**
   * Log an audit event
   */
  async log(request: LogAuditEventRequest): Promise<AuditEvent> {
    const event = this.auditRepository.create({
      ...request,
      outcome: request.outcome ?? 'success',
    });

    await this.auditRepository.save(event);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `Audit: ${request.eventType} - User: ${request.userId ?? 'system'} - ` +
        `Entity: ${request.entityType}:${request.entityId}`,
      );
    }

    return event;
  }

  /**
   * Log authentication event
   */
  async logAuth(
    eventType: AuditEventType,
    userId: string | undefined,
    details: {
      phone?: string;
      ipAddress?: string;
      userAgent?: string;
      success: boolean;
      reason?: string;
    },
  ): Promise<AuditEvent> {
    return this.log({
      eventType,
      userId,
      entityType: 'user',
      entityId: userId,
      details: {
        phone: details.phone,
      },
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      outcome: details.success ? 'success' : 'failure',
      errorMessage: details.reason,
      channel: 'auth',
    });
  }

  /**
   * Log payment event
   */
  async logPayment(
    eventType: AuditEventType,
    userId: string,
    paymentId: string,
    details: {
      amount: number;
      type: string;
      mpesaRef?: string;
      success: boolean;
      reason?: string;
    },
  ): Promise<AuditEvent> {
    return this.log({
      eventType,
      userId,
      entityType: 'payment',
      entityId: paymentId,
      description: `${details.type} payment of KES ${details.amount}`,
      details: {
        amount: details.amount,
        type: details.type,
        mpesaRef: details.mpesaRef,
      },
      outcome: details.success ? 'success' : 'failure',
      errorMessage: details.reason,
      channel: 'payment',
    });
  }

  /**
   * Log policy event
   */
  async logPolicy(
    eventType: AuditEventType,
    userId: string,
    policyId: string,
    details: {
      policyNumber: string;
      policyType: string;
      action?: string;
    },
  ): Promise<AuditEvent> {
    return this.log({
      eventType,
      userId,
      entityType: 'policy',
      entityId: policyId,
      description: `Policy ${details.policyNumber} ${details.action ?? eventType}`,
      details: {
        policyNumber: details.policyNumber,
        policyType: details.policyType,
      },
      channel: 'policy',
    });
  }

  /**
   * Log admin action
   */
  async logAdmin(
    eventType: AuditEventType,
    actorId: string,
    targetUserId: string | undefined,
    details: {
      action: string;
      reason?: string;
      changes?: Record<string, unknown>;
    },
  ): Promise<AuditEvent> {
    return this.log({
      eventType,
      userId: targetUserId,
      actorId,
      entityType: 'admin_action',
      description: details.action,
      details: {
        action: details.action,
        reason: details.reason,
        changes: details.changes,
      },
      channel: 'admin',
    });
  }

  /**
   * Query audit events
   */
  async query(options: AuditQueryOptions): Promise<{
    events: AuditEvent[];
    total: number;
  }> {
    const {
      eventType,
      userId,
      entityType,
      entityId,
      startDate,
      endDate,
      outcome,
      page = 1,
      limit = 50,
    } = options;

    const where: Record<string, unknown> = {};

    if (eventType) {
      where.eventType = eventType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (outcome) {
      where.outcome = outcome;
    }

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(endDate);
    }

    const [events, total] = await this.auditRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { events, total };
  }

  /**
   * Get user audit trail
   */
  async getUserAuditTrail(
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ events: AuditEvent[]; total: number }> {
    return this.query({
      userId,
      ...options,
    });
  }

  /**
   * Get entity audit trail
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ events: AuditEvent[]; total: number }> {
    return this.query({
      entityType,
      entityId,
      ...options,
    });
  }

  /**
   * Get audit statistics
   */
  async getStats(days: number = 30): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    byOutcome: { success: number; failure: number };
    recentFailures: number;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await this.auditRepository.find({
      where: {
        createdAt: MoreThanOrEqual(since),
      },
    });

    const byType: Record<string, number> = {};
    let success = 0;
    let failure = 0;

    for (const event of events) {
      byType[event.eventType] = (byType[event.eventType] ?? 0) + 1;
      if (event.outcome === 'success') {
        success++;
      } else {
        failure++;
      }
    }

    // Count recent failures (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailures = events.filter(
      (e) => e.outcome === 'failure' && e.createdAt >= last24h,
    ).length;

    return {
      totalEvents: events.length,
      byType,
      byOutcome: { success, failure },
      recentFailures,
    };
  }

  /**
   * Export audit events for compliance
   */
  async exportEvents(
    options: AuditQueryOptions & { format?: 'json' | 'csv' },
  ): Promise<{ data: AuditEvent[]; count: number }> {
    // Override limit for export
    const { events, total } = await this.query({
      ...options,
      limit: 10000, // Max export limit
    });

    return {
      data: events,
      count: total,
    };
  }
}
