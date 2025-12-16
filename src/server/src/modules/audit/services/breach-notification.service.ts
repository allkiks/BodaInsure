import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In, Not } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BreachIncident,
  BreachSeverity,
  BreachStatus,
  BreachType,
} from '../entities/breach-incident.entity.js';
import { AuditService } from './audit.service.js';
import { AuditEventType } from '../entities/audit-event.entity.js';
import { EmailService } from '../../notification/services/email.service.js';

/**
 * Create breach incident request
 */
export interface CreateBreachIncidentRequest {
  breachType: BreachType;
  severity: BreachSeverity;
  title: string;
  description: string;
  affectedDataTypes?: string[];
  affectedUsersCount?: number;
  affectedUserIds?: string[];
  detectionMethod?: string;
  occurredAt?: Date;
  reportedBy?: string;
}

/**
 * Update breach incident request
 */
export interface UpdateBreachIncidentRequest {
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
 * Breach notification result
 */
export interface BreachNotificationResult {
  success: boolean;
  notificationType: 'commissioner' | 'users' | 'management';
  recipientCount: number;
  error?: string;
}

/**
 * Breach Notification Service
 * CR-DPA-003: Kenya Data Protection Act compliance
 *
 * Implements:
 * - Breach incident recording and tracking
 * - 72-hour Data Commissioner notification
 * - Affected user notification
 * - Management alerts
 * - Breach resolution workflow
 */
@Injectable()
export class BreachNotificationService {
  private readonly logger = new Logger(BreachNotificationService.name);
  private readonly commissionerEmail: string;
  private readonly managementEmails: string[];
  private readonly companyName: string;
  private readonly dpoName: string;
  private readonly dpoEmail: string;

  constructor(
    @InjectRepository(BreachIncident)
    private readonly breachRepository: Repository<BreachIncident>,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    // Data Commissioner of Kenya contact
    this.commissionerEmail = this.configService.get<string>(
      'DATA_COMMISSIONER_EMAIL',
      'complaints@odpc.go.ke',
    );

    // Internal management notification list
    this.managementEmails = this.configService
      .get<string>('BREACH_MANAGEMENT_EMAILS', 'admin@bodainsure.co.ke')
      .split(',')
      .map((e) => e.trim());

    // Company details for notifications
    this.companyName = this.configService.get<string>(
      'COMPANY_NAME',
      'Atronach K Ltd (BodaInsure)',
    );
    this.dpoName = this.configService.get<string>(
      'DPO_NAME',
      'Data Protection Officer',
    );
    this.dpoEmail = this.configService.get<string>(
      'DPO_EMAIL',
      'dpo@bodainsure.co.ke',
    );
  }

  /**
   * Create a new breach incident
   */
  async createIncident(
    request: CreateBreachIncidentRequest,
  ): Promise<BreachIncident> {
    // Generate incident reference
    const incidentRef = await this.generateIncidentRef();

    const incident = this.breachRepository.create({
      incidentRef,
      breachType: request.breachType,
      severity: request.severity,
      status: BreachStatus.DETECTED,
      title: request.title,
      description: request.description,
      affectedDataTypes: request.affectedDataTypes,
      affectedUsersCount: request.affectedUsersCount ?? 0,
      affectedUserIds: request.affectedUserIds,
      detectionMethod: request.detectionMethod,
      detectedAt: new Date(),
      occurredAt: request.occurredAt,
      reportedBy: request.reportedBy,
      timeline: [
        {
          timestamp: new Date(),
          action: 'Incident created',
          actor: request.reportedBy,
          notes: `Breach detected: ${request.title}`,
        },
      ],
    });

    await this.breachRepository.save(incident);

    // Log audit event
    await this.auditService.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      entityType: 'breach_incident',
      entityId: incident.id,
      description: `Breach incident created: ${incidentRef} - ${request.title}`,
      details: {
        incidentRef,
        breachType: request.breachType,
        severity: request.severity,
        affectedUsersCount: request.affectedUsersCount,
      },
      channel: 'security',
    });

    this.logger.warn(
      `BREACH INCIDENT CREATED: ${incidentRef} - ${request.severity} - ${request.title}`,
    );

    // Auto-notify management for HIGH and CRITICAL
    if (
      request.severity === BreachSeverity.HIGH ||
      request.severity === BreachSeverity.CRITICAL
    ) {
      await this.notifyManagement(incident);
    }

    return incident;
  }

  /**
   * Update breach incident
   */
  async updateIncident(
    incidentId: string,
    request: UpdateBreachIncidentRequest,
    actorId?: string,
  ): Promise<BreachIncident> {
    const incident = await this.breachRepository.findOneOrFail({
      where: { id: incidentId },
    });

    const previousStatus = incident.status;

    // Update fields
    if (request.status) {
      incident.status = request.status;

      // Update timestamps based on status
      if (request.status === BreachStatus.CONTAINED && !incident.containedAt) {
        incident.containedAt = new Date();
      }
      if (request.status === BreachStatus.RESOLVED && !incident.resolvedAt) {
        incident.resolvedAt = new Date();
      }
    }

    if (request.severity) incident.severity = request.severity;
    if (request.assignedTo) incident.assignedTo = request.assignedTo;
    if (request.rootCause) incident.rootCause = request.rootCause;
    if (request.immediateActions)
      incident.immediateActions = request.immediateActions;
    if (request.remediationSteps)
      incident.remediationSteps = request.remediationSteps;
    if (request.preventiveMeasures)
      incident.preventiveMeasures = request.preventiveMeasures;
    if (request.affectedUsersCount !== undefined)
      incident.affectedUsersCount = request.affectedUsersCount;
    if (request.affectedUserIds)
      incident.affectedUserIds = request.affectedUserIds;

    // Add timeline entry
    const timelineEntry = {
      timestamp: new Date(),
      action: `Status changed from ${previousStatus} to ${incident.status}`,
      actor: actorId,
      notes: request.rootCause
        ? `Root cause identified: ${request.rootCause.substring(0, 100)}`
        : undefined,
    };

    incident.timeline = incident.timeline || [];
    incident.timeline.push(timelineEntry);

    await this.breachRepository.save(incident);

    this.logger.log(
      `Breach incident ${incident.incidentRef} updated: ${previousStatus} -> ${incident.status}`,
    );

    return incident;
  }

  /**
   * Notify the Data Commissioner (Kenya ODPC)
   * Required within 72 hours per DPA 2019
   */
  async notifyCommissioner(
    incidentId: string,
  ): Promise<BreachNotificationResult> {
    const incident = await this.breachRepository.findOneOrFail({
      where: { id: incidentId },
    });

    if (incident.commissionerNotified) {
      return {
        success: true,
        notificationType: 'commissioner',
        recipientCount: 0,
        error: 'Already notified',
      };
    }

    try {
      const result = await this.emailService.send({
        to: this.commissionerEmail,
        subject: `DATA BREACH NOTIFICATION - ${this.companyName} - Ref: ${incident.incidentRef}`,
        html: this.renderCommissionerNotificationEmail(incident),
        text: this.renderCommissionerNotificationText(incident),
      });

      if (result.success) {
        incident.commissionerNotified = true;
        incident.commissionerNotifiedAt = new Date();
        incident.timeline = incident.timeline || [];
        incident.timeline.push({
          timestamp: new Date(),
          action: 'Data Commissioner notified',
          notes: `Email sent to ${this.commissionerEmail}`,
        });

        // Update status to NOTIFIED if not already resolved
        if (
          incident.status !== BreachStatus.RESOLVED &&
          incident.status !== BreachStatus.CLOSED
        ) {
          incident.status = BreachStatus.NOTIFIED;
        }

        await this.breachRepository.save(incident);

        this.logger.log(
          `Data Commissioner notified for incident ${incident.incidentRef}`,
        );

        return {
          success: true,
          notificationType: 'commissioner',
          recipientCount: 1,
        };
      }

      return {
        success: false,
        notificationType: 'commissioner',
        recipientCount: 0,
        error: result.error,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to notify Data Commissioner: ${errorMessage}`,
      );
      return {
        success: false,
        notificationType: 'commissioner',
        recipientCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Notify affected users
   */
  async notifyAffectedUsers(
    incidentId: string,
    userEmails: Array<{ userId: string; email: string; name: string }>,
  ): Promise<BreachNotificationResult> {
    const incident = await this.breachRepository.findOneOrFail({
      where: { id: incidentId },
    });

    let successCount = 0;
    const errors: string[] = [];

    for (const user of userEmails) {
      try {
        const result = await this.emailService.send({
          to: user.email,
          subject: `Important Security Notice - ${this.companyName}`,
          html: this.renderUserNotificationEmail(incident, user.name),
          text: this.renderUserNotificationText(incident, user.name),
        });

        if (result.success) {
          successCount++;
        } else {
          errors.push(`${user.email}: ${result.error}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(`${user.email}: ${errorMessage}`);
      }
    }

    // Update incident
    incident.usersNotified = true;
    incident.usersNotifiedAt = new Date();
    incident.timeline = incident.timeline || [];
    incident.timeline.push({
      timestamp: new Date(),
      action: 'Affected users notified',
      notes: `${successCount}/${userEmails.length} users notified successfully`,
    });

    await this.breachRepository.save(incident);

    this.logger.log(
      `Notified ${successCount}/${userEmails.length} users for incident ${incident.incidentRef}`,
    );

    return {
      success: successCount > 0,
      notificationType: 'users',
      recipientCount: successCount,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Notify internal management
   */
  async notifyManagement(
    incident: BreachIncident,
  ): Promise<BreachNotificationResult> {
    if (incident.managementNotified) {
      return {
        success: true,
        notificationType: 'management',
        recipientCount: 0,
        error: 'Already notified',
      };
    }

    try {
      const result = await this.emailService.send({
        to: this.managementEmails,
        subject: `[${incident.severity}] SECURITY INCIDENT - ${incident.incidentRef}: ${incident.title}`,
        html: this.renderManagementNotificationEmail(incident),
        text: this.renderManagementNotificationText(incident),
      });

      if (result.success) {
        incident.managementNotified = true;
        incident.managementNotifiedAt = new Date();
        incident.timeline = incident.timeline || [];
        incident.timeline.push({
          timestamp: new Date(),
          action: 'Management notified',
          notes: `Alert sent to ${this.managementEmails.length} recipients`,
        });

        await this.breachRepository.save(incident);

        this.logger.log(
          `Management notified for incident ${incident.incidentRef}`,
        );

        return {
          success: true,
          notificationType: 'management',
          recipientCount: this.managementEmails.length,
        };
      }

      return {
        success: false,
        notificationType: 'management',
        recipientCount: 0,
        error: result.error,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to notify management: ${errorMessage}`);
      return {
        success: false,
        notificationType: 'management',
        recipientCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Get incident by ID
   */
  async getIncident(incidentId: string): Promise<BreachIncident | null> {
    return this.breachRepository.findOne({
      where: { id: incidentId },
    });
  }

  /**
   * Get incident by reference
   */
  async getIncidentByRef(incidentRef: string): Promise<BreachIncident | null> {
    return this.breachRepository.findOne({
      where: { incidentRef },
    });
  }

  /**
   * List incidents with filters
   */
  async listIncidents(options: {
    status?: BreachStatus[];
    severity?: BreachSeverity[];
    page?: number;
    limit?: number;
  }): Promise<{ incidents: BreachIncident[]; total: number }> {
    const { status, severity, page = 1, limit = 20 } = options;

    const where: Record<string, unknown> = {};

    if (status && status.length > 0) {
      where.status = In(status);
    }
    if (severity && severity.length > 0) {
      where.severity = In(severity);
    }

    const [incidents, total] = await this.breachRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { incidents, total };
  }

  /**
   * Get incidents approaching 72-hour deadline
   */
  async getApproachingDeadlineIncidents(): Promise<BreachIncident[]> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    return this.breachRepository.find({
      where: {
        commissionerNotified: false,
        detectedAt: LessThanOrEqual(fortyEightHoursAgo),
        status: Not(In([BreachStatus.RESOLVED, BreachStatus.CLOSED])),
      },
      order: { detectedAt: 'ASC' },
    });
  }

  /**
   * Get overdue incidents (past 72-hour deadline)
   */
  async getOverdueIncidents(): Promise<BreachIncident[]> {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    return this.breachRepository.find({
      where: {
        commissionerNotified: false,
        detectedAt: LessThanOrEqual(seventyTwoHoursAgo),
        status: Not(In([BreachStatus.RESOLVED, BreachStatus.CLOSED])),
      },
      order: { detectedAt: 'ASC' },
    });
  }

  /**
   * Scheduled check for approaching deadlines
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkNotificationDeadlines(): Promise<void> {
    this.logger.debug('Checking breach notification deadlines...');

    const approachingDeadline = await this.getApproachingDeadlineIncidents();
    const overdue = await this.getOverdueIncidents();

    for (const incident of approachingDeadline) {
      const hoursRemaining = incident.hoursUntilDeadline();
      this.logger.warn(
        `URGENT: Incident ${incident.incidentRef} has ${hoursRemaining.toFixed(1)} hours until 72-hour notification deadline`,
      );

      // Send reminder to management
      await this.emailService.send({
        to: this.managementEmails,
        subject: `[URGENT] ${hoursRemaining.toFixed(0)}h until Data Commissioner notification deadline - ${incident.incidentRef}`,
        text: `Incident ${incident.incidentRef} must be reported to the Data Commissioner within ${hoursRemaining.toFixed(1)} hours.\n\nIncident: ${incident.title}\nSeverity: ${incident.severity}\n\nPlease take immediate action.`,
      });
    }

    for (const incident of overdue) {
      this.logger.error(
        `OVERDUE: Incident ${incident.incidentRef} is past the 72-hour notification deadline!`,
      );

      // Send critical alert
      await this.emailService.send({
        to: this.managementEmails,
        subject: `[CRITICAL] OVERDUE - Data Commissioner notification required - ${incident.incidentRef}`,
        text: `Incident ${incident.incidentRef} is PAST the 72-hour notification deadline!\n\nIncident: ${incident.title}\nSeverity: ${incident.severity}\nDetected: ${incident.detectedAt.toISOString()}\n\nIMMEDIATE ACTION REQUIRED: Notify the Data Commissioner immediately to comply with DPA 2019.`,
      });
    }
  }

  /**
   * Generate incident reference number
   */
  private async generateIncidentRef(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.breachRepository.count({
      where: {},
    });
    return `BRH-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Render Data Commissioner notification email (HTML)
   */
  private renderCommissionerNotificationEmail(
    incident: BreachIncident,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background: #dc2626; color: white; padding: 20px; }
    .content { padding: 20px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #374151; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DATA BREACH NOTIFICATION</h1>
    <p>Per Section 43, Kenya Data Protection Act 2019</p>
  </div>
  <div class="content">
    <div class="section">
      <p>Dear Data Commissioner,</p>
      <p>This notification is submitted pursuant to Section 43 of the Data Protection Act 2019, requiring data controllers to notify the Office of the Data Protection Commissioner of personal data breaches within 72 hours.</p>
    </div>

    <div class="section">
      <h2>1. Data Controller Details</h2>
      <table>
        <tr><th>Organization</th><td>${this.companyName}</td></tr>
        <tr><th>DPO Name</th><td>${this.dpoName}</td></tr>
        <tr><th>DPO Email</th><td>${this.dpoEmail}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>2. Incident Details</h2>
      <table>
        <tr><th>Reference Number</th><td>${incident.incidentRef}</td></tr>
        <tr><th>Date Detected</th><td>${incident.detectedAt.toISOString()}</td></tr>
        <tr><th>Date Occurred (Estimated)</th><td>${incident.occurredAt?.toISOString() ?? 'Under investigation'}</td></tr>
        <tr><th>Breach Type</th><td>${incident.breachType}</td></tr>
        <tr><th>Severity</th><td>${incident.severity}</td></tr>
        <tr><th>Current Status</th><td>${incident.status}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>3. Description of Breach</h2>
      <p>${incident.description}</p>
    </div>

    <div class="section">
      <h2>4. Categories of Personal Data Affected</h2>
      <p>${incident.affectedDataTypes?.join(', ') ?? 'Under investigation'}</p>
    </div>

    <div class="section">
      <h2>5. Number of Data Subjects Affected</h2>
      <p>Approximately ${incident.affectedUsersCount} individuals</p>
    </div>

    <div class="section">
      <h2>6. Measures Taken</h2>
      <p><strong>Immediate Actions:</strong> ${incident.immediateActions ?? 'Under investigation'}</p>
      <p><strong>Remediation Steps:</strong> ${incident.remediationSteps ?? 'Being determined'}</p>
    </div>

    <div class="section">
      <h2>7. Contact for Further Information</h2>
      <p>For any queries regarding this notification, please contact our Data Protection Officer at ${this.dpoEmail}.</p>
    </div>

    <p>We remain committed to resolving this incident and will provide updates as our investigation progresses.</p>
    <p>Respectfully submitted,</p>
    <p><strong>${this.dpoName}</strong><br>Data Protection Officer<br>${this.companyName}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Render Data Commissioner notification (plain text)
   */
  private renderCommissionerNotificationText(incident: BreachIncident): string {
    return `
DATA BREACH NOTIFICATION
Per Section 43, Kenya Data Protection Act 2019

Dear Data Commissioner,

This notification is submitted pursuant to Section 43 of the Data Protection Act 2019.

1. DATA CONTROLLER DETAILS
Organization: ${this.companyName}
DPO: ${this.dpoName}
Email: ${this.dpoEmail}

2. INCIDENT DETAILS
Reference: ${incident.incidentRef}
Detected: ${incident.detectedAt.toISOString()}
Type: ${incident.breachType}
Severity: ${incident.severity}
Status: ${incident.status}

3. DESCRIPTION
${incident.description}

4. DATA CATEGORIES AFFECTED
${incident.affectedDataTypes?.join(', ') ?? 'Under investigation'}

5. AFFECTED DATA SUBJECTS
Approximately ${incident.affectedUsersCount} individuals

6. MEASURES TAKEN
${incident.immediateActions ?? 'Under investigation'}

Contact: ${this.dpoEmail}

Respectfully submitted,
${this.dpoName}
Data Protection Officer
${this.companyName}
    `.trim();
  }

  /**
   * Render user notification email (HTML)
   */
  private renderUserNotificationEmail(
    incident: BreachIncident,
    userName: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background: #2563eb; color: white; padding: 20px; }
    .content { padding: 20px; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .steps { background: #f3f4f6; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Important Security Notice</h1>
  </div>
  <div class="content">
    <p>Dear ${userName},</p>

    <div class="alert">
      <strong>We are writing to inform you of a security incident that may have affected your personal information.</strong>
    </div>

    <h2>What Happened</h2>
    <p>${incident.description}</p>

    <h2>What Information Was Involved</h2>
    <p>The following types of information may have been affected: ${incident.affectedDataTypes?.join(', ') ?? 'personal data'}.</p>

    <h2>What We Are Doing</h2>
    <p>${incident.immediateActions ?? 'We are actively investigating this incident and taking steps to prevent similar incidents in the future.'}</p>

    <div class="steps">
      <h2>What You Can Do</h2>
      <ul>
        <li>Monitor your accounts for any suspicious activity</li>
        <li>Be cautious of unsolicited communications asking for personal information</li>
        <li>Contact us immediately if you notice anything unusual</li>
      </ul>
    </div>

    <h2>Contact Us</h2>
    <p>If you have questions or concerns, please contact our Data Protection Officer at ${this.dpoEmail}.</p>

    <p>We sincerely apologize for any concern this may cause and remain committed to protecting your information.</p>

    <p>Sincerely,<br>
    ${this.companyName}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Render user notification (plain text)
   */
  private renderUserNotificationText(
    incident: BreachIncident,
    userName: string,
  ): string {
    return `
IMPORTANT SECURITY NOTICE
${this.companyName}

Dear ${userName},

We are writing to inform you of a security incident that may have affected your personal information.

WHAT HAPPENED
${incident.description}

WHAT INFORMATION WAS INVOLVED
${incident.affectedDataTypes?.join(', ') ?? 'Personal data'}

WHAT WE ARE DOING
${incident.immediateActions ?? 'We are actively investigating this incident.'}

WHAT YOU CAN DO
- Monitor your accounts for suspicious activity
- Be cautious of unsolicited communications
- Contact us if you notice anything unusual

CONTACT US
Email: ${this.dpoEmail}

We apologize for any concern this may cause.

Sincerely,
${this.companyName}
    `.trim();
  }

  /**
   * Render management notification email (HTML)
   */
  private renderManagementNotificationEmail(incident: BreachIncident): string {
    const severityColor =
      incident.severity === BreachSeverity.CRITICAL
        ? '#dc2626'
        : incident.severity === BreachSeverity.HIGH
          ? '#ea580c'
          : incident.severity === BreachSeverity.MEDIUM
            ? '#ca8a04'
            : '#16a34a';

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .header { background: ${severityColor}; color: white; padding: 20px; }
    .content { padding: 20px; }
    .metric { display: inline-block; margin-right: 20px; padding: 10px; background: #f3f4f6; }
    .deadline { background: #fef2f2; border: 2px solid #dc2626; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>[${incident.severity}] SECURITY INCIDENT</h1>
    <p>Reference: ${incident.incidentRef}</p>
  </div>
  <div class="content">
    <h2>${incident.title}</h2>

    <div class="deadline">
      <strong>72-Hour Notification Deadline:</strong>
      ${incident.commissionerNotified ? '<span style="color: green;">COMPLETED</span>' : `<span style="color: red;">${incident.hoursUntilDeadline().toFixed(1)} hours remaining</span>`}
    </div>

    <div>
      <div class="metric"><strong>Type:</strong> ${incident.breachType}</div>
      <div class="metric"><strong>Status:</strong> ${incident.status}</div>
      <div class="metric"><strong>Affected Users:</strong> ${incident.affectedUsersCount}</div>
    </div>

    <h3>Description</h3>
    <p>${incident.description}</p>

    <h3>Affected Data Types</h3>
    <p>${incident.affectedDataTypes?.join(', ') ?? 'Not yet determined'}</p>

    <h3>Detection Method</h3>
    <p>${incident.detectionMethod ?? 'Not specified'}</p>

    <h3>Timeline</h3>
    <ul>
      ${(incident.timeline ?? []).map((t) => `<li><strong>${new Date(t.timestamp).toLocaleString()}:</strong> ${t.action}</li>`).join('\n')}
    </ul>

    <p><strong>Immediate action required.</strong> Please review and respond to this incident.</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Render management notification (plain text)
   */
  private renderManagementNotificationText(incident: BreachIncident): string {
    return `
[${incident.severity}] SECURITY INCIDENT - ${incident.incidentRef}

${incident.title}

72-HOUR DEADLINE: ${incident.commissionerNotified ? 'COMPLETED' : `${incident.hoursUntilDeadline().toFixed(1)} hours remaining`}

Type: ${incident.breachType}
Status: ${incident.status}
Affected Users: ${incident.affectedUsersCount}

DESCRIPTION
${incident.description}

AFFECTED DATA TYPES
${incident.affectedDataTypes?.join(', ') ?? 'Not yet determined'}

DETECTION
${incident.detectionMethod ?? 'Not specified'}

IMMEDIATE ACTION REQUIRED.
    `.trim();
  }

  /**
   * Detect potential breach from audit events
   * Called by audit service when suspicious patterns detected
   */
  async detectPotentialBreach(
    eventType: string,
    details: {
      userId?: string;
      ipAddress?: string;
      failureCount?: number;
      description?: string;
    },
  ): Promise<BreachIncident | null> {
    // Auto-detection thresholds
    const FAILED_LOGIN_THRESHOLD = 10;
    const SUSPICIOUS_ACCESS_THRESHOLD = 5;

    let shouldCreateIncident = false;
    let breachType = BreachType.OTHER;
    let severity = BreachSeverity.LOW;
    let title = 'Suspicious activity detected';
    let description = details.description ?? 'Automated detection triggered';

    // Multiple failed logins from same IP
    if (
      eventType === 'OTP_FAILED' &&
      (details.failureCount ?? 0) >= FAILED_LOGIN_THRESHOLD
    ) {
      shouldCreateIncident = true;
      breachType = BreachType.CREDENTIAL_COMPROMISE;
      severity = BreachSeverity.MEDIUM;
      title = 'Multiple failed authentication attempts detected';
      description = `${details.failureCount} failed OTP attempts from IP ${details.ipAddress}`;
    }

    // Unusual data access pattern
    if (
      eventType === 'DATA_EXPORT' &&
      (details.failureCount ?? 0) >= SUSPICIOUS_ACCESS_THRESHOLD
    ) {
      shouldCreateIncident = true;
      breachType = BreachType.DATA_EXFILTRATION;
      severity = BreachSeverity.HIGH;
      title = 'Unusual data export activity detected';
      description = `Multiple data exports detected for user ${details.userId}`;
    }

    if (shouldCreateIncident) {
      return this.createIncident({
        breachType,
        severity,
        title,
        description,
        detectionMethod: 'Automated monitoring',
        affectedUserIds: details.userId ? [details.userId] : undefined,
      });
    }

    return null;
  }
}
