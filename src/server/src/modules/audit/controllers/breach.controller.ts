import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import {
  BreachNotificationService,
  CreateBreachIncidentRequest,
  UpdateBreachIncidentRequest,
} from '../services/breach-notification.service.js';
import {
  BreachSeverity,
  BreachStatus,
  BreachType,
} from '../entities/breach-incident.entity.js';

/**
 * Create breach incident DTO
 */
class CreateBreachIncidentDto implements CreateBreachIncidentRequest {
  breachType!: BreachType;
  severity!: BreachSeverity;
  title!: string;
  description!: string;
  affectedDataTypes?: string[];
  affectedUsersCount?: number;
  affectedUserIds?: string[];
  detectionMethod?: string;
  occurredAt?: Date;
  reportedBy?: string;
}

/**
 * Update breach incident DTO
 */
class UpdateBreachIncidentDto implements UpdateBreachIncidentRequest {
  status?: BreachStatus;
  severity?: BreachSeverity;
  assignedTo?: string;
  rootCause?: string;
  immediateActions?: string;
  remediationSteps?: string;
  preventiveMeasures?: string;
  affectedUsersCount?: number;
  affectedUserIds?: string[];
}

/**
 * Notify users DTO
 */
class NotifyUsersDto {
  users!: Array<{
    userId: string;
    email: string;
    name: string;
  }>;
}

/**
 * Breach Controller
 * CR-DPA-003: Breach notification management endpoints
 */
@ApiTags('Breach Incidents')
@Controller('breach-incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BreachController {
  constructor(
    private readonly breachNotificationService: BreachNotificationService,
  ) {}

  @Post()
  @Roles('admin', 'dpo', 'security')
  @ApiOperation({ summary: 'Create a new breach incident' })
  @ApiResponse({ status: 201, description: 'Incident created' })
  async createIncident(@Body() dto: CreateBreachIncidentDto) {
    const incident = await this.breachNotificationService.createIncident(dto);
    return {
      success: true,
      incident: {
        id: incident.id,
        incidentRef: incident.incidentRef,
        status: incident.status,
        severity: incident.severity,
        title: incident.title,
        createdAt: incident.createdAt,
        hoursUntilDeadline: incident.hoursUntilDeadline(),
      },
    };
  }

  @Get()
  @Roles('admin', 'dpo', 'security')
  @ApiOperation({ summary: 'List breach incidents' })
  @ApiQuery({ name: 'status', required: false, enum: BreachStatus, isArray: true })
  @ApiQuery({ name: 'severity', required: false, enum: BreachSeverity, isArray: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listIncidents(
    @Query('status') status?: BreachStatus | BreachStatus[],
    @Query('severity') severity?: BreachSeverity | BreachSeverity[],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const statusArray = status
      ? Array.isArray(status)
        ? status
        : [status]
      : undefined;
    const severityArray = severity
      ? Array.isArray(severity)
        ? severity
        : [severity]
      : undefined;

    const result = await this.breachNotificationService.listIncidents({
      status: statusArray,
      severity: severityArray,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      success: true,
      incidents: result.incidents.map((i) => ({
        id: i.id,
        incidentRef: i.incidentRef,
        breachType: i.breachType,
        severity: i.severity,
        status: i.status,
        title: i.title,
        affectedUsersCount: i.affectedUsersCount,
        commissionerNotified: i.commissionerNotified,
        hoursUntilDeadline: i.hoursUntilDeadline(),
        isOverdue: i.isNotificationOverdue(),
        createdAt: i.createdAt,
      })),
      total: result.total,
    };
  }

  @Get('overdue')
  @Roles('admin', 'dpo', 'security')
  @ApiOperation({ summary: 'Get incidents past 72-hour notification deadline' })
  async getOverdueIncidents() {
    const incidents = await this.breachNotificationService.getOverdueIncidents();
    return {
      success: true,
      count: incidents.length,
      incidents: incidents.map((i) => ({
        id: i.id,
        incidentRef: i.incidentRef,
        severity: i.severity,
        title: i.title,
        detectedAt: i.detectedAt,
        hoursOverdue: Math.abs(i.hoursUntilDeadline()),
      })),
    };
  }

  @Get('approaching-deadline')
  @Roles('admin', 'dpo', 'security')
  @ApiOperation({ summary: 'Get incidents approaching 72-hour deadline' })
  async getApproachingDeadline() {
    const incidents =
      await this.breachNotificationService.getApproachingDeadlineIncidents();
    return {
      success: true,
      count: incidents.length,
      incidents: incidents.map((i) => ({
        id: i.id,
        incidentRef: i.incidentRef,
        severity: i.severity,
        title: i.title,
        detectedAt: i.detectedAt,
        hoursRemaining: i.hoursUntilDeadline(),
      })),
    };
  }

  @Get(':id')
  @Roles('admin', 'dpo', 'security')
  @ApiOperation({ summary: 'Get breach incident details' })
  @ApiResponse({ status: 200, description: 'Incident details' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async getIncident(@Param('id', ParseUUIDPipe) id: string) {
    const incident = await this.breachNotificationService.getIncident(id);
    if (!incident) {
      return { success: false, error: 'Incident not found' };
    }
    return {
      success: true,
      incident: {
        ...incident,
        hoursUntilDeadline: incident.hoursUntilDeadline(),
        isOverdue: incident.isNotificationOverdue(),
        isApproachingDeadline: incident.isNotificationDeadlineApproaching(),
      },
    };
  }

  @Put(':id')
  @Roles('admin', 'dpo', 'security')
  @ApiOperation({ summary: 'Update breach incident' })
  async updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBreachIncidentDto,
  ) {
    const incident = await this.breachNotificationService.updateIncident(
      id,
      dto,
    );
    return {
      success: true,
      incident: {
        id: incident.id,
        incidentRef: incident.incidentRef,
        status: incident.status,
        severity: incident.severity,
        updatedAt: incident.updatedAt,
      },
    };
  }

  @Post(':id/notify-commissioner')
  @Roles('admin', 'dpo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send notification to Data Commissioner (ODPC Kenya)',
  })
  @ApiResponse({ status: 200, description: 'Notification sent' })
  async notifyCommissioner(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.breachNotificationService.notifyCommissioner(id);
    return {
      success: result.success,
      notificationType: result.notificationType,
      error: result.error,
    };
  }

  @Post(':id/notify-users')
  @Roles('admin', 'dpo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Notify affected users' })
  @ApiResponse({ status: 200, description: 'Users notified' })
  async notifyUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotifyUsersDto,
  ) {
    const result = await this.breachNotificationService.notifyAffectedUsers(
      id,
      dto.users,
    );
    return {
      success: result.success,
      notificationType: result.notificationType,
      recipientCount: result.recipientCount,
      error: result.error,
    };
  }

  @Post(':id/notify-management')
  @Roles('admin', 'dpo', 'security')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send alert to management team' })
  async notifyManagement(@Param('id', ParseUUIDPipe) id: string) {
    const incident = await this.breachNotificationService.getIncident(id);
    if (!incident) {
      return { success: false, error: 'Incident not found' };
    }
    const result =
      await this.breachNotificationService.notifyManagement(incident);
    return {
      success: result.success,
      notificationType: result.notificationType,
      recipientCount: result.recipientCount,
      error: result.error,
    };
  }
}
