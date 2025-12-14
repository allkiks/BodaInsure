import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, Between } from 'typeorm';
import { SmsService } from './sms.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import {
  Notification,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../entities/notification.entity.js';
import {
  NotificationTemplate,
  TemplateStatus,
} from '../entities/notification-template.entity.js';
import { NotificationPreference } from '../entities/notification-preference.entity.js';

/**
 * Send notification request
 */
export interface SendNotificationRequest {
  userId: string;
  phone: string;
  type: NotificationType;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  variables?: Record<string, string | number>;
  referenceId?: string;
  referenceType?: string;
  scheduledFor?: Date;
  documentUrl?: string;
}

/**
 * Send notification result
 */
export interface SendNotificationResult {
  success: boolean;
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  externalId?: string;
  error?: string;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  byChannel: Record<NotificationChannel, number>;
  byType: Record<NotificationType, number>;
}

/**
 * Notification Service
 * Orchestrates sending notifications through appropriate channels
 *
 * Per module_architecture.md notification requirements
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    private readonly smsService: SmsService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  /**
   * Send a notification
   */
  async send(request: SendNotificationRequest): Promise<SendNotificationResult> {
    const {
      userId,
      phone,
      type,
      channel,
      priority = NotificationPriority.NORMAL,
      variables = {},
      referenceId,
      referenceType,
      scheduledFor,
      documentUrl,
    } = request;

    // Get user preferences
    const preferences = await this.getOrCreatePreferences(userId);

    // Determine channel
    const targetChannel = channel ?? preferences.getChannelForType(type);

    // Check if enabled for this type
    if (!preferences.isEnabledForType(type)) {
      this.logger.debug(`Notifications disabled for type ${type} for user ${userId.slice(0, 8)}...`);
      return this.createSkippedResult(userId, targetChannel, 'Disabled by user preference');
    }

    // Check if unsubscribed from channel
    if (preferences.isUnsubscribed(targetChannel)) {
      this.logger.debug(`User unsubscribed from ${targetChannel}`);
      return this.createSkippedResult(userId, targetChannel, 'Unsubscribed from channel');
    }

    // Get template
    const template = await this.getTemplate(targetChannel, type);
    if (!template) {
      this.logger.error(`No template found for ${targetChannel}/${type}`);
      return this.createSkippedResult(userId, targetChannel, 'No template found');
    }

    // Validate template variables
    const missingVars = template.validateVariables(variables);
    if (missingVars.length > 0) {
      this.logger.error(`Missing template variables: ${missingVars.join(', ')}`);
      return this.createSkippedResult(userId, targetChannel, `Missing variables: ${missingVars.join(', ')}`);
    }

    // Render message content
    const content = template.render(variables as Record<string, string | number>);
    const subject = template.renderSubject(variables as Record<string, string | number>);

    // Create notification record
    const notification = this.notificationRepository.create({
      userId,
      channel: targetChannel,
      notificationType: type,
      status: scheduledFor ? NotificationStatus.PENDING : NotificationStatus.QUEUED,
      priority,
      recipient: phone,
      subject,
      content,
      templateId: template.id,
      templateVariables: variables,
      referenceId,
      referenceType,
      scheduledFor,
    });

    await this.notificationRepository.save(notification);

    // If scheduled for future, return pending status
    if (scheduledFor && scheduledFor > new Date()) {
      return {
        success: true,
        notificationId: notification.id,
        channel: targetChannel,
        status: NotificationStatus.PENDING,
      };
    }

    // Check quiet hours for non-urgent notifications
    if (priority !== NotificationPriority.URGENT && preferences.isQuietHours()) {
      // Schedule for next morning
      const nextMorning = this.getNextMorning(preferences.quietHoursEnd);
      notification.scheduledFor = nextMorning;
      notification.status = NotificationStatus.PENDING;
      await this.notificationRepository.save(notification);

      return {
        success: true,
        notificationId: notification.id,
        channel: targetChannel,
        status: NotificationStatus.PENDING,
      };
    }

    // Send immediately
    return this.sendNotification(notification, documentUrl);
  }

  /**
   * Actually send the notification through the appropriate channel
   */
  private async sendNotification(
    notification: Notification,
    documentUrl?: string,
  ): Promise<SendNotificationResult> {
    let result: { success: boolean; messageId?: string; status: string; error?: string };

    try {
      switch (notification.channel) {
        case NotificationChannel.SMS:
          result = await this.smsService.send({
            to: notification.recipient,
            message: notification.content,
          });
          break;

        case NotificationChannel.WHATSAPP:
          if (documentUrl) {
            // Send document
            result = await this.whatsAppService.sendDocument(
              notification.recipient,
              documentUrl,
              `BodaInsure_${notification.notificationType}.pdf`,
              notification.content,
            );
          } else {
            // Send text message
            result = await this.whatsAppService.sendText(
              notification.recipient,
              notification.content,
            );
          }
          break;

        default:
          result = {
            success: false,
            status: 'UnsupportedChannel',
            error: `Channel ${notification.channel} not supported`,
          };
      }

      // Update notification based on result
      if (result.success) {
        notification.markSent(result.messageId ?? '', notification.channel);
      } else {
        notification.markFailed(result.error ?? 'Unknown error');
      }

      await this.notificationRepository.save(notification);

      return {
        success: result.success,
        notificationId: notification.id,
        channel: notification.channel,
        status: notification.status,
        externalId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notification.markFailed(errorMessage);
      await this.notificationRepository.save(notification);

      return {
        success: false,
        notificationId: notification.id,
        channel: notification.channel,
        status: NotificationStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  /**
   * Send OTP notification
   */
  async sendOtp(userId: string, phone: string, otp: string): Promise<SendNotificationResult> {
    return this.send({
      userId,
      phone,
      type: NotificationType.OTP,
      priority: NotificationPriority.URGENT,
      variables: { otp },
    });
  }

  /**
   * Send payment received notification
   */
  async sendPaymentReceived(
    userId: string,
    phone: string,
    amount: number,
    reference: string,
    balance: number,
  ): Promise<SendNotificationResult> {
    return this.send({
      userId,
      phone,
      type: NotificationType.PAYMENT_RECEIVED,
      variables: {
        amount: amount.toLocaleString(),
        reference,
        balance: balance.toLocaleString(),
      },
    });
  }

  /**
   * Send policy issued notification
   */
  async sendPolicyIssued(
    userId: string,
    phone: string,
    policyNumber: string,
    vehicleRegistration: string,
    coverageStart: Date,
    coverageEnd: Date,
    documentUrl?: string,
  ): Promise<SendNotificationResult> {
    const formatDate = (d: Date) => d.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return this.send({
      userId,
      phone,
      type: NotificationType.POLICY_ISSUED,
      channel: NotificationChannel.WHATSAPP, // Always use WhatsApp for policy docs
      priority: NotificationPriority.HIGH,
      variables: {
        policyNumber,
        vehicleRegistration,
        coverageStart: formatDate(coverageStart),
        coverageEnd: formatDate(coverageEnd),
      },
      referenceType: 'policy',
      documentUrl,
    });
  }

  /**
   * Send policy expiring reminder
   */
  async sendPolicyExpiring(
    userId: string,
    phone: string,
    policyNumber: string,
    daysRemaining: number,
    expiryDate: Date,
  ): Promise<SendNotificationResult> {
    const formatDate = (d: Date) => d.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return this.send({
      userId,
      phone,
      type: NotificationType.POLICY_EXPIRING,
      variables: {
        policyNumber,
        daysRemaining,
        expiryDate: formatDate(expiryDate),
      },
    });
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(
    userId: string,
    phone: string,
    name: string,
    amount: number,
    daysRemaining: number,
  ): Promise<SendNotificationResult> {
    return this.send({
      userId,
      phone,
      type: NotificationType.PAYMENT_REMINDER,
      variables: {
        name,
        amount,
        daysRemaining,
      },
    });
  }

  /**
   * Process pending scheduled notifications
   */
  async processScheduledNotifications(): Promise<number> {
    const now = new Date();

    const pendingNotifications = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.PENDING,
        scheduledFor: LessThan(now),
      },
      take: 100, // Process in batches
      order: { priority: 'DESC', scheduledFor: 'ASC' },
    });

    let processed = 0;

    for (const notification of pendingNotifications) {
      notification.status = NotificationStatus.QUEUED;
      await this.notificationRepository.save(notification);

      const result = await this.sendNotification(notification);
      if (result.success) {
        processed++;
      }
    }

    if (processed > 0) {
      this.logger.log(`Processed ${processed} scheduled notifications`);
    }

    return processed;
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<number> {
    const failedNotifications = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.FAILED,
      },
      take: 50,
    });

    let retried = 0;

    for (const notification of failedNotifications) {
      if (!notification.canRetry()) {
        continue;
      }

      notification.status = NotificationStatus.QUEUED;
      await this.notificationRepository.save(notification);

      const result = await this.sendNotification(notification);
      if (result.success) {
        retried++;
      }
    }

    if (retried > 0) {
      this.logger.log(`Retried ${retried} failed notifications`);
    }

    return retried;
  }

  /**
   * Get user notification history
   */
  async getUserNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      types?: NotificationType[];
    },
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { limit = 20, offset = 0, types } = options ?? {};

    const where: Record<string, unknown> = { userId };
    if (types && types.length > 0) {
      where['notificationType'] = In(types);
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { notifications, total };
  }

  /**
   * Get notification statistics
   */
  async getStats(userId?: string, startDate?: Date, endDate?: Date): Promise<NotificationStats> {
    const where: Record<string, unknown> = {};
    if (userId) {
      where['userId'] = userId;
    }
    if (startDate && endDate) {
      where['createdAt'] = Between(startDate, endDate);
    }

    const notifications = await this.notificationRepository.find({ where });

    const stats: NotificationStats = {
      total: notifications.length,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      byChannel: {} as Record<NotificationChannel, number>,
      byType: {} as Record<NotificationType, number>,
    };

    for (const n of notifications) {
      // Count by status
      switch (n.status) {
        case NotificationStatus.SENT:
          stats.sent++;
          break;
        case NotificationStatus.DELIVERED:
          stats.delivered++;
          break;
        case NotificationStatus.FAILED:
          stats.failed++;
          break;
        case NotificationStatus.PENDING:
        case NotificationStatus.QUEUED:
          stats.pending++;
          break;
      }

      // Count by channel
      stats.byChannel[n.channel] = (stats.byChannel[n.channel] ?? 0) + 1;

      // Count by type
      stats.byType[n.notificationType] = (stats.byType[n.notificationType] ?? 0) + 1;
    }

    return stats;
  }

  /**
   * Get or create user preferences
   */
  async getOrCreatePreferences(userId: string): Promise<NotificationPreference> {
    let preferences = await this.preferenceRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = this.preferenceRepository.create({
        userId,
      });
      await this.preferenceRepository.save(preferences);
    }

    return preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    const preferences = await this.getOrCreatePreferences(userId);

    Object.assign(preferences, updates);
    await this.preferenceRepository.save(preferences);

    return preferences;
  }

  /**
   * Get template by channel and type
   */
  private async getTemplate(
    channel: NotificationChannel,
    type: NotificationType,
  ): Promise<NotificationTemplate | null> {
    return this.templateRepository.findOne({
      where: {
        channel,
        notificationType: type,
        status: TemplateStatus.ACTIVE,
      },
    });
  }

  /**
   * Create a skipped result
   */
  private createSkippedResult(
    _userId: string,
    channel: NotificationChannel,
    reason: string,
  ): SendNotificationResult {
    return {
      success: false,
      notificationId: '',
      channel,
      status: NotificationStatus.EXPIRED,
      error: reason,
    };
  }

  /**
   * Get next morning after quiet hours
   */
  private getNextMorning(endHour: number): Date {
    const now = new Date();
    const next = new Date(now);

    // Convert EAT hour to UTC (EAT is UTC+3)
    const utcEndHour = (endHour - 3 + 24) % 24;

    next.setUTCHours(utcEndHour, 0, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }
}
