import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SmsDeliveryReport,
  SmsDeliveryStatus,
} from '../entities/sms-delivery-report.entity.js';
import { Notification, NotificationStatus } from '../entities/notification.entity.js';
import { maskPhone } from '../../../common/utils/phone.util.js';

/**
 * Africa's Talking Delivery Callback DTO
 * Per AT API documentation
 */
export interface ATDeliveryCallbackDto {
  /** Message ID (ATXid_xxx) */
  id: string;
  /** Delivery status */
  status: string;
  /** Recipient phone number */
  phoneNumber: string;
  /** Network code */
  networkCode?: string;
  /** Failure reason */
  failureReason?: string;
  /** Retry count */
  retryCount?: string;
}

/**
 * Advantasms Delivery Callback DTO
 */
export interface AdvantasmsDeliveryCallbackDto {
  /** Message ID */
  messageID: string;
  /** Delivery status */
  status: string;
  /** Phone number */
  mobile: string;
  /** Delivery time */
  deliveryTime?: string;
  /** Failure reason */
  failureReason?: string;
}

/**
 * Delivery report statistics
 */
export interface DeliveryStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: number;
}

/**
 * SMS Delivery Report Service
 * Handles processing and storage of SMS delivery status callbacks
 *
 * Per Africa's Talking best practices:
 * - Process delivery reports to track message success/failure
 * - Store delivery status for auditing and compliance
 * - Update notification status based on delivery confirmation
 */
@Injectable()
export class SmsDeliveryReportService {
  private readonly logger = new Logger(SmsDeliveryReportService.name);

  constructor(
    @InjectRepository(SmsDeliveryReport)
    private readonly deliveryReportRepository: Repository<SmsDeliveryReport>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Process Africa's Talking delivery callback
   */
  async processATCallback(dto: ATDeliveryCallbackDto): Promise<SmsDeliveryReport> {
    this.logger.log(
      `Processing AT delivery callback: messageId=${dto.id}, status=${dto.status}, phone=${maskPhone(dto.phoneNumber)}`,
    );

    const status = this.mapATStatus(dto.status);

    // Create delivery report
    const report = this.deliveryReportRepository.create({
      messageId: dto.id,
      provider: 'africastalking',
      status,
      phoneNumber: dto.phoneNumber,
      networkCode: dto.networkCode,
      failureReason: dto.failureReason,
      retryCount: dto.retryCount ? parseInt(dto.retryCount, 10) : 0,
      deliveredAt: status === SmsDeliveryStatus.SUCCESS ? new Date() : undefined,
      rawPayload: dto as unknown as Record<string, unknown>,
    });

    const savedReport = await this.deliveryReportRepository.save(report);

    // Update related notification if exists
    await this.updateNotificationStatus(dto.id, status, dto.failureReason);

    this.logger.log(
      `AT delivery report saved: id=${savedReport.id}, messageId=${dto.id}, status=${status}`,
    );

    return savedReport;
  }

  /**
   * Process Advantasms delivery callback
   */
  async processAdvantasmsCallback(dto: AdvantasmsDeliveryCallbackDto): Promise<SmsDeliveryReport> {
    this.logger.log(
      `Processing Advantasms delivery callback: messageId=${dto.messageID}, status=${dto.status}`,
    );

    const status = this.mapAdvantasmsStatus(dto.status);

    const report = this.deliveryReportRepository.create({
      messageId: dto.messageID,
      provider: 'advantasms',
      status,
      phoneNumber: dto.mobile,
      failureReason: dto.failureReason,
      deliveredAt: dto.deliveryTime ? new Date(dto.deliveryTime) : undefined,
      rawPayload: dto as unknown as Record<string, unknown>,
    });

    const savedReport = await this.deliveryReportRepository.save(report);

    // Update related notification if exists
    await this.updateNotificationStatus(dto.messageID, status, dto.failureReason);

    return savedReport;
  }

  /**
   * Get delivery report by message ID
   */
  async getByMessageId(messageId: string): Promise<SmsDeliveryReport | null> {
    return this.deliveryReportRepository.findOne({
      where: { messageId },
      order: { receivedAt: 'DESC' },
    });
  }

  /**
   * Get all delivery reports for a message (may have multiple status updates)
   */
  async getAllByMessageId(messageId: string): Promise<SmsDeliveryReport[]> {
    return this.deliveryReportRepository.find({
      where: { messageId },
      order: { receivedAt: 'ASC' },
    });
  }

  /**
   * Get delivery statistics for a time period
   */
  async getStats(
    provider?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DeliveryStats> {
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
    const successful = reports.filter((r) => r.isSuccessful()).length;
    const failed = reports.filter((r) => r.isFailed()).length;
    const pending = reports.filter((r) => r.isPending()).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      pending,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get delivery reports by status
   */
  async getByStatus(
    status: SmsDeliveryStatus,
    limit: number = 100,
  ): Promise<SmsDeliveryReport[]> {
    return this.deliveryReportRepository.find({
      where: { status },
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get failed deliveries for retry analysis
   */
  async getFailedDeliveries(
    provider?: string,
    limit: number = 100,
  ): Promise<SmsDeliveryReport[]> {
    const qb = this.deliveryReportRepository
      .createQueryBuilder('report')
      .where('report.status IN (:...statuses)', {
        statuses: [
          SmsDeliveryStatus.FAILED,
          SmsDeliveryStatus.REJECTED,
          SmsDeliveryStatus.EXPIRED,
        ],
      })
      .orderBy('report.received_at', 'DESC')
      .take(limit);

    if (provider) {
      qb.andWhere('report.provider = :provider', { provider });
    }

    return qb.getMany();
  }

  /**
   * Map Africa's Talking status string to enum
   */
  private mapATStatus(status: string): SmsDeliveryStatus {
    const statusMap: Record<string, SmsDeliveryStatus> = {
      Sent: SmsDeliveryStatus.SENT,
      Submitted: SmsDeliveryStatus.SUBMITTED,
      Buffered: SmsDeliveryStatus.BUFFERED,
      Rejected: SmsDeliveryStatus.REJECTED,
      Success: SmsDeliveryStatus.SUCCESS,
      Failed: SmsDeliveryStatus.FAILED,
    };

    return statusMap[status] ?? SmsDeliveryStatus.FAILED;
  }

  /**
   * Map Advantasms status string to enum
   */
  private mapAdvantasmsStatus(status: string): SmsDeliveryStatus {
    const normalizedStatus = status.toUpperCase();
    const statusMap: Record<string, SmsDeliveryStatus> = {
      DELIVRD: SmsDeliveryStatus.SUCCESS,
      SENT: SmsDeliveryStatus.SENT,
      FAILED: SmsDeliveryStatus.FAILED,
      REJECTED: SmsDeliveryStatus.REJECTED,
      EXPIRED: SmsDeliveryStatus.EXPIRED,
    };

    return statusMap[normalizedStatus] ?? SmsDeliveryStatus.FAILED;
  }

  /**
   * Update notification status based on delivery report
   */
  private async updateNotificationStatus(
    externalId: string,
    deliveryStatus: SmsDeliveryStatus,
    failureReason?: string,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { externalId },
    });

    if (!notification) {
      this.logger.debug(`No notification found for externalId=${externalId}`);
      return;
    }

    // Map delivery status to notification status
    let notificationStatus: NotificationStatus;
    switch (deliveryStatus) {
      case SmsDeliveryStatus.SUCCESS:
        notificationStatus = NotificationStatus.DELIVERED;
        notification.deliveredAt = new Date();
        break;
      case SmsDeliveryStatus.SENT:
      case SmsDeliveryStatus.SUBMITTED:
      case SmsDeliveryStatus.BUFFERED:
        notificationStatus = NotificationStatus.SENT;
        break;
      case SmsDeliveryStatus.FAILED:
      case SmsDeliveryStatus.REJECTED:
      case SmsDeliveryStatus.EXPIRED:
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
