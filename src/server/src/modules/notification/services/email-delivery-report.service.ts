import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmailDeliveryReport,
  EmailDeliveryStatus,
  EmailBounceType,
} from '../entities/email-delivery-report.entity.js';
import { Notification, NotificationStatus } from '../entities/notification.entity.js';

/**
 * Email delivery callback DTO (generic)
 */
export interface EmailDeliveryCallbackDto {
  messageId: string;
  status: string;
  recipient: string;
  timestamp?: string;
  bounceType?: string;
  reason?: string;
  smtpCode?: string;
}

/**
 * Email delivery statistics
 */
export interface EmailDeliveryStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

/**
 * Email Delivery Report Service
 * Handles processing and storage of email delivery status callbacks
 *
 * Per GAP-E01: Email delivery tracking for audit compliance
 */
@Injectable()
export class EmailDeliveryReportService {
  private readonly logger = new Logger(EmailDeliveryReportService.name);

  constructor(
    @InjectRepository(EmailDeliveryReport)
    private readonly deliveryReportRepository: Repository<EmailDeliveryReport>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Record email sent event
   */
  async recordSent(
    messageId: string,
    recipient: string,
    subject: string,
    provider: string,
    notificationId?: string,
  ): Promise<EmailDeliveryReport> {
    const report = this.deliveryReportRepository.create({
      messageId,
      provider,
      status: EmailDeliveryStatus.SENT,
      recipient,
      subject,
      notificationId,
      sentAt: new Date(),
    });

    return this.deliveryReportRepository.save(report);
  }

  /**
   * Process delivery callback/webhook
   */
  async processCallback(
    dto: EmailDeliveryCallbackDto,
    provider: string,
  ): Promise<EmailDeliveryReport> {
    this.logger.log(
      `Processing email delivery callback: messageId=${dto.messageId}, status=${dto.status}`,
    );

    const status = this.mapStatus(dto.status);
    const bounceType = dto.bounceType ? this.mapBounceType(dto.bounceType) : undefined;

    // Find existing report or create new one
    let report = await this.deliveryReportRepository.findOne({
      where: { messageId: dto.messageId },
      order: { receivedAt: 'DESC' },
    });

    if (report) {
      // Update existing report
      report.status = status;
      if (bounceType) report.bounceType = bounceType;
      if (dto.reason) report.failureReason = dto.reason;
      if (dto.smtpCode) report.smtpCode = dto.smtpCode;
      report.rawPayload = dto as unknown as Record<string, unknown>;

      // Update timestamps based on status
      this.updateTimestamps(report, status, dto.timestamp);
    } else {
      // Create new report
      report = this.deliveryReportRepository.create({
        messageId: dto.messageId,
        provider,
        status,
        recipient: dto.recipient,
        bounceType,
        failureReason: dto.reason,
        smtpCode: dto.smtpCode,
        rawPayload: dto as unknown as Record<string, unknown>,
      });
      this.updateTimestamps(report, status, dto.timestamp);
    }

    const savedReport = await this.deliveryReportRepository.save(report);

    // Update related notification if exists
    await this.updateNotificationStatus(dto.messageId, status, dto.reason);

    this.logger.log(
      `Email delivery report saved: id=${savedReport.id}, messageId=${dto.messageId}, status=${status}`,
    );

    return savedReport;
  }

  /**
   * Get delivery report by message ID
   */
  async getByMessageId(messageId: string): Promise<EmailDeliveryReport | null> {
    return this.deliveryReportRepository.findOne({
      where: { messageId },
      order: { receivedAt: 'DESC' },
    });
  }

  /**
   * Get all delivery reports for a message
   */
  async getAllByMessageId(messageId: string): Promise<EmailDeliveryReport[]> {
    return this.deliveryReportRepository.find({
      where: { messageId },
      order: { receivedAt: 'ASC' },
    });
  }

  /**
   * Get delivery reports by recipient
   */
  async getByRecipient(
    recipient: string,
    limit: number = 100,
  ): Promise<EmailDeliveryReport[]> {
    return this.deliveryReportRepository.find({
      where: { recipient },
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get delivery statistics for a time period
   */
  async getStats(
    provider?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<EmailDeliveryStats> {
    const qb = this.deliveryReportRepository.createQueryBuilder('report');

    if (provider) {
      qb.andWhere('report.provider = :provider', { provider });
    }
    if (startDate) {
      qb.andWhere('report.received_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('report.received_at <= :endDate', { endDate });
    }

    const reports = await qb.getMany();

    const total = reports.length;
    const sent = reports.filter((r) => r.status === EmailDeliveryStatus.SENT).length;
    const delivered = reports.filter((r) => r.status === EmailDeliveryStatus.DELIVERED).length;
    const opened = reports.filter((r) => r.status === EmailDeliveryStatus.OPENED).length;
    const clicked = reports.filter((r) => r.status === EmailDeliveryStatus.CLICKED).length;
    const bounced = reports.filter((r) => r.status === EmailDeliveryStatus.BOUNCED).length;
    const failed = reports.filter((r) => r.isFailed()).length;

    const deliveryRate = total > 0 ? ((delivered + opened + clicked) / total) * 100 : 0;
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

    return {
      total,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      failed,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
    };
  }

  /**
   * Get bounced/failed emails for cleanup
   */
  async getBouncedEmails(
    hardBouncesOnly: boolean = false,
    limit: number = 100,
  ): Promise<EmailDeliveryReport[]> {
    const qb = this.deliveryReportRepository
      .createQueryBuilder('report')
      .where('report.status = :status', { status: EmailDeliveryStatus.BOUNCED })
      .orderBy('report.received_at', 'DESC')
      .take(limit);

    if (hardBouncesOnly) {
      qb.andWhere('report.bounce_type IN (:...types)', {
        types: [EmailBounceType.HARD, EmailBounceType.PERMANENT],
      });
    }

    return qb.getMany();
  }

  /**
   * Map status string to enum
   */
  private mapStatus(status: string): EmailDeliveryStatus {
    const normalized = status.toLowerCase();
    const statusMap: Record<string, EmailDeliveryStatus> = {
      sent: EmailDeliveryStatus.SENT,
      delivered: EmailDeliveryStatus.DELIVERED,
      opened: EmailDeliveryStatus.OPENED,
      open: EmailDeliveryStatus.OPENED,
      clicked: EmailDeliveryStatus.CLICKED,
      click: EmailDeliveryStatus.CLICKED,
      bounced: EmailDeliveryStatus.BOUNCED,
      bounce: EmailDeliveryStatus.BOUNCED,
      complained: EmailDeliveryStatus.COMPLAINED,
      complaint: EmailDeliveryStatus.COMPLAINED,
      failed: EmailDeliveryStatus.FAILED,
      deferred: EmailDeliveryStatus.DEFERRED,
    };

    return statusMap[normalized] ?? EmailDeliveryStatus.FAILED;
  }

  /**
   * Map bounce type string to enum
   */
  private mapBounceType(bounceType: string): EmailBounceType {
    const normalized = bounceType.toLowerCase();
    const typeMap: Record<string, EmailBounceType> = {
      soft: EmailBounceType.SOFT,
      hard: EmailBounceType.HARD,
      transient: EmailBounceType.TRANSIENT,
      permanent: EmailBounceType.PERMANENT,
    };

    return typeMap[normalized] ?? EmailBounceType.SOFT;
  }

  /**
   * Update timestamps based on status
   */
  private updateTimestamps(
    report: EmailDeliveryReport,
    status: EmailDeliveryStatus,
    timestamp?: string,
  ): void {
    const time = timestamp ? new Date(timestamp) : new Date();

    switch (status) {
      case EmailDeliveryStatus.SENT:
        report.sentAt = time;
        break;
      case EmailDeliveryStatus.DELIVERED:
        report.deliveredAt = time;
        break;
      case EmailDeliveryStatus.OPENED:
        report.openedAt = time;
        break;
      case EmailDeliveryStatus.CLICKED:
        report.clickedAt = time;
        break;
    }
  }

  /**
   * Update notification status based on delivery report
   */
  private async updateNotificationStatus(
    externalId: string,
    deliveryStatus: EmailDeliveryStatus,
    failureReason?: string,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { externalId },
    });

    if (!notification) {
      this.logger.debug(`No notification found for externalId=${externalId}`);
      return;
    }

    let notificationStatus: NotificationStatus;
    switch (deliveryStatus) {
      case EmailDeliveryStatus.DELIVERED:
      case EmailDeliveryStatus.OPENED:
      case EmailDeliveryStatus.CLICKED:
        notificationStatus = NotificationStatus.DELIVERED;
        notification.deliveredAt = new Date();
        break;
      case EmailDeliveryStatus.SENT:
      case EmailDeliveryStatus.DEFERRED:
        notificationStatus = NotificationStatus.SENT;
        break;
      case EmailDeliveryStatus.BOUNCED:
      case EmailDeliveryStatus.COMPLAINED:
      case EmailDeliveryStatus.FAILED:
        notificationStatus = NotificationStatus.FAILED;
        notification.errorMessage = failureReason;
        break;
      default:
        return;
    }

    notification.status = notificationStatus;
    await this.notificationRepository.save(notification);

    this.logger.log(
      `Updated notification ${notification.id} status to ${notificationStatus}`,
    );
  }
}
