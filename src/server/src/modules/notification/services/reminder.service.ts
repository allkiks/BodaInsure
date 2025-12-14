import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { NotificationType } from '../entities/notification.entity.js';
import { NotificationPreference } from '../entities/notification-preference.entity.js';

/**
 * User payment data for reminders
 */
export interface UserPaymentData {
  userId: string;
  phone: string;
  name: string;
  dailyAmount: number;
  daysPaid: number;
  daysRemaining: number;
  lastPaymentDate: Date | null;
}

/**
 * User policy data for expiry reminders
 */
export interface UserPolicyData {
  userId: string;
  phone: string;
  policyNumber: string;
  expiryDate: Date;
  daysRemaining: number;
}

/**
 * Reminder processing result
 */
export interface ReminderProcessingResult {
  type: 'payment' | 'expiry';
  total: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Reminder Service
 * Handles scheduled payment reminders and policy expiry notifications
 *
 * Per module_architecture.md:
 * - Daily payment reminders at user's preferred time
 * - Policy expiry reminders 7 days before expiry
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Process daily payment reminders
   * Called by scheduler at multiple times throughout the day
   *
   * This would integrate with the Payment module to get users who need reminders
   */
  async processPaymentReminders(
    usersNeedingReminders: UserPaymentData[],
  ): Promise<ReminderProcessingResult> {
    const result: ReminderProcessingResult = {
      type: 'payment',
      total: usersNeedingReminders.length,
      sent: 0,
      skipped: 0,
      failed: 0,
    };

    for (const user of usersNeedingReminders) {
      try {
        // Check if user has reminders enabled
        const preferences = await this.notificationService.getOrCreatePreferences(user.userId);

        if (!preferences.paymentRemindersEnabled) {
          result.skipped++;
          continue;
        }

        // Check if it's the user's preferred reminder hour
        if (!this.isUserReminderTime(preferences)) {
          result.skipped++;
          continue;
        }

        // Send the reminder
        const sendResult = await this.notificationService.sendPaymentReminder(
          user.userId,
          user.phone,
          user.name,
          user.dailyAmount,
          user.daysRemaining,
        );

        if (sendResult.success) {
          result.sent++;
        } else {
          result.failed++;
        }
      } catch (error) {
        this.logger.error(`Failed to send payment reminder to ${user.userId}`, error);
        result.failed++;
      }
    }

    this.logger.log(
      `Payment reminders processed: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`,
    );

    return result;
  }

  /**
   * Process policy expiry reminders
   * Called by scheduler daily
   */
  async processPolicyExpiryReminders(
    expiringPolicies: UserPolicyData[],
  ): Promise<ReminderProcessingResult> {
    const result: ReminderProcessingResult = {
      type: 'expiry',
      total: expiringPolicies.length,
      sent: 0,
      skipped: 0,
      failed: 0,
    };

    for (const policy of expiringPolicies) {
      try {
        // Check if user has expiry reminders enabled
        const preferences = await this.notificationService.getOrCreatePreferences(policy.userId);

        if (!preferences.expiryRemindersEnabled) {
          result.skipped++;
          continue;
        }

        // Check if we should send reminder at this interval
        // Send at: 7 days, 3 days, 1 day before expiry
        if (!this.shouldSendExpiryReminder(policy.daysRemaining, preferences)) {
          result.skipped++;
          continue;
        }

        // Send the reminder
        const sendResult = await this.notificationService.sendPolicyExpiring(
          policy.userId,
          policy.phone,
          policy.policyNumber,
          policy.daysRemaining,
          policy.expiryDate,
        );

        if (sendResult.success) {
          result.sent++;
        } else {
          result.failed++;
        }
      } catch (error) {
        this.logger.error(`Failed to send expiry reminder for policy ${policy.policyNumber}`, error);
        result.failed++;
      }
    }

    this.logger.log(
      `Expiry reminders processed: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`,
    );

    return result;
  }

  /**
   * Send immediate payment reminder (for manual triggers or webhooks)
   */
  async sendImmediatePaymentReminder(user: UserPaymentData): Promise<boolean> {
    try {
      const result = await this.notificationService.sendPaymentReminder(
        user.userId,
        user.phone,
        user.name,
        user.dailyAmount,
        user.daysRemaining,
      );

      return result.success;
    } catch (error) {
      this.logger.error(`Failed to send immediate reminder to ${user.userId}`, error);
      return false;
    }
  }

  /**
   * Send missed payment alert
   * Called when a user misses their daily payment
   */
  async sendMissedPaymentAlert(
    userId: string,
    phone: string,
    name: string,
    missedDays: number,
  ): Promise<boolean> {
    try {
      // Use payment reminder with adjusted messaging
      const result = await this.notificationService.send({
        userId,
        phone,
        type: 'PAYMENT_REMINDER' as any,
        priority: 'HIGH' as any,
        variables: {
          name,
          amount: 87, // Daily amount
          daysRemaining: 30 - missedDays,
          missedDays,
        },
      });

      return result.success;
    } catch (error) {
      this.logger.error(`Failed to send missed payment alert to ${userId}`, error);
      return false;
    }
  }

  /**
   * Send grace period warning
   * Called when user enters grace period after policy expiry
   */
  async sendGracePeriodWarning(
    userId: string,
    phone: string,
    policyNumber: string,
    graceDaysRemaining: number,
  ): Promise<boolean> {
    try {
      const result = await this.notificationService.send({
        userId,
        phone,
        type: 'POLICY_EXPIRED' as any,
        priority: 'URGENT' as any,
        variables: {
          policyNumber,
          graceDaysRemaining,
        },
      });

      return result.success;
    } catch (error) {
      this.logger.error(`Failed to send grace period warning to ${userId}`, error);
      return false;
    }
  }

  /**
   * Get users who need payment reminders today
   * This is a placeholder - would integrate with Payment module
   */
  async getUsersNeedingPaymentReminders(): Promise<UserPaymentData[]> {
    // This would query the payment module to find:
    // 1. Users who have paid deposit but not completed 30 days
    // 2. Users who haven't paid today
    // 3. Users whose reminder time matches current time

    // For now, return empty array - will be integrated with Payment module
    this.logger.debug('getUsersNeedingPaymentReminders called - needs Payment module integration');
    return [];
  }

  /**
   * Get policies expiring soon
   * This is a placeholder - would integrate with Policy module
   */
  async getExpiringPolicies(): Promise<UserPolicyData[]> {
    // This would query the policy module to find:
    // 1. Active policies expiring in next 7 days
    // 2. Policies where user has expiry reminders enabled

    // For now, return empty array - will be integrated with Policy module
    this.logger.debug('getExpiringPolicies called - needs Policy module integration');
    return [];
  }

  /**
   * Check if current time matches user's preferred reminder hour
   */
  private isUserReminderTime(preferences: NotificationPreference): boolean {
    // Get current hour in EAT (UTC+3)
    const now = new Date();
    const eatHour = (now.getUTCHours() + 3) % 24;

    // Allow 1-hour window around preferred time
    return Math.abs(eatHour - preferences.reminderHour) <= 1;
  }

  /**
   * Check if we should send expiry reminder at this days-remaining interval
   */
  private shouldSendExpiryReminder(
    daysRemaining: number,
    preferences: NotificationPreference,
  ): boolean {
    // Key reminder days
    const reminderDays = [
      preferences.expiryReminderDays, // User preference (default 7)
      3,
      1,
      0, // Day of expiry
    ];

    return reminderDays.includes(daysRemaining);
  }

  /**
   * Schedule a reminder for a specific time
   */
  async scheduleReminder(
    userId: string,
    phone: string,
    type: 'payment' | 'expiry',
    scheduledFor: Date,
    data: Record<string, unknown>,
  ): Promise<string> {
    // Create a scheduled notification
    const result = await this.notificationService.send({
      userId,
      phone,
      type: type === 'payment' ? 'PAYMENT_REMINDER' as any : 'POLICY_EXPIRING' as any,
      scheduledFor,
      variables: data as Record<string, string | number>,
    });

    return result.notificationId;
  }

  /**
   * Cancel a scheduled reminder
   */
  async cancelScheduledReminder(notificationId: string): Promise<boolean> {
    // This would update the notification status to cancelled
    // Implementation depends on notification repository access
    this.logger.debug(`Would cancel reminder ${notificationId}`);
    return true;
  }

  /**
   * Get reminder statistics for a user
   */
  async getUserReminderStats(userId: string): Promise<{
    paymentReminders: number;
    expiryReminders: number;
    lastReminderDate: Date | null;
  }> {
    const stats = await this.notificationService.getStats(userId);

    return {
      paymentReminders: stats.byType[NotificationType.PAYMENT_REMINDER] ?? 0,
      expiryReminders: stats.byType[NotificationType.POLICY_EXPIRING] ?? 0,
      lastReminderDate: null, // Would need to query for this
    };
  }

  /**
   * Bulk schedule reminders for users
   * Used for initial setup or re-scheduling
   */
  async bulkScheduleReminders(
    users: Array<{ userId: string; phone: string; preferredHour: number }>,
    type: 'payment' | 'expiry',
  ): Promise<{ scheduled: number; failed: number }> {
    let scheduled = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Calculate next reminder time based on user's preferred hour
        const scheduledFor = this.getNextReminderTime(user.preferredHour);

        await this.scheduleReminder(
          user.userId,
          user.phone,
          type,
          scheduledFor,
          {},
        );

        scheduled++;
      } catch (error) {
        this.logger.error(`Failed to schedule reminder for ${user.userId}`, error);
        failed++;
      }
    }

    return { scheduled, failed };
  }

  /**
   * Get next reminder time based on preferred hour
   */
  private getNextReminderTime(preferredHourEAT: number): Date {
    const now = new Date();
    const next = new Date(now);

    // Convert EAT hour to UTC (EAT is UTC+3)
    const utcHour = (preferredHourEAT - 3 + 24) % 24;

    next.setUTCHours(utcHour, 0, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }
}
