import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationChannel, NotificationType } from './notification.entity.js';

/**
 * Notification Preference Entity
 * Stores user preferences for receiving notifications
 */
@Entity('notification_preferences')
@Index(['userId'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User these preferences belong to */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Preferred channel for OTP messages */
  @Column({
    name: 'otp_channel',
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.SMS,
  })
  otpChannel!: NotificationChannel;

  /** Preferred channel for policy notifications */
  @Column({
    name: 'policy_channel',
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.WHATSAPP,
  })
  policyChannel!: NotificationChannel;

  /** Preferred channel for payment notifications */
  @Column({
    name: 'payment_channel',
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.WHATSAPP,
  })
  paymentChannel!: NotificationChannel;

  /** Preferred channel for reminders */
  @Column({
    name: 'reminder_channel',
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.SMS,
  })
  reminderChannel!: NotificationChannel;

  /** Enable/disable payment reminders */
  @Column({ name: 'payment_reminders_enabled', type: 'boolean', default: true })
  paymentRemindersEnabled!: boolean;

  /** Enable/disable policy expiry reminders */
  @Column({ name: 'expiry_reminders_enabled', type: 'boolean', default: true })
  expiryRemindersEnabled!: boolean;

  /** Enable/disable promotional messages */
  @Column({ name: 'promotions_enabled', type: 'boolean', default: false })
  promotionsEnabled!: boolean;

  /** Preferred reminder time (hour in EAT, 0-23) */
  @Column({ name: 'reminder_hour', type: 'integer', default: 8 })
  reminderHour!: number;

  /** Days before expiry to start reminders */
  @Column({ name: 'expiry_reminder_days', type: 'integer', default: 7 })
  expiryReminderDays!: number;

  /** Quiet hours start (hour in EAT, 0-23) */
  @Column({ name: 'quiet_hours_start', type: 'integer', default: 21 })
  quietHoursStart!: number;

  /** Quiet hours end (hour in EAT, 0-23) */
  @Column({ name: 'quiet_hours_end', type: 'integer', default: 7 })
  quietHoursEnd!: number;

  /** Language preference */
  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale!: string;

  /** WhatsApp number (if different from registered phone) */
  @Column({ name: 'whatsapp_number', type: 'varchar', length: 20, nullable: true })
  whatsappNumber?: string;

  /** Email address (optional) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  /** SMS unsubscribe flag */
  @Column({ name: 'sms_unsubscribed', type: 'boolean', default: false })
  smsUnsubscribed!: boolean;

  /** WhatsApp unsubscribe flag */
  @Column({ name: 'whatsapp_unsubscribed', type: 'boolean', default: false })
  whatsappUnsubscribed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Get preferred channel for a notification type
   */
  getChannelForType(type: NotificationType): NotificationChannel {
    switch (type) {
      case NotificationType.OTP:
        return this.otpChannel;

      case NotificationType.POLICY_ISSUED:
      case NotificationType.POLICY_EXPIRING:
      case NotificationType.POLICY_EXPIRED:
      case NotificationType.POLICY_DOCUMENT:
        return this.policyChannel;

      case NotificationType.PAYMENT_RECEIVED:
      case NotificationType.PAYMENT_FAILED:
        return this.paymentChannel;

      case NotificationType.PAYMENT_REMINDER:
        return this.reminderChannel;

      default:
        return NotificationChannel.SMS;
    }
  }

  /**
   * Check if notifications are enabled for a type
   */
  isEnabledForType(type: NotificationType): boolean {
    switch (type) {
      case NotificationType.PAYMENT_REMINDER:
        return this.paymentRemindersEnabled;

      case NotificationType.POLICY_EXPIRING:
        return this.expiryRemindersEnabled;

      // Always send critical notifications
      case NotificationType.OTP:
      case NotificationType.PAYMENT_RECEIVED:
      case NotificationType.POLICY_ISSUED:
        return true;

      default:
        return true;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  isQuietHours(): boolean {
    // Get current hour in EAT (UTC+3)
    const now = new Date();
    const eatHour = (now.getUTCHours() + 3) % 24;

    if (this.quietHoursStart <= this.quietHoursEnd) {
      // Quiet hours don't span midnight
      return eatHour >= this.quietHoursStart && eatHour < this.quietHoursEnd;
    } else {
      // Quiet hours span midnight (e.g., 21:00 to 07:00)
      return eatHour >= this.quietHoursStart || eatHour < this.quietHoursEnd;
    }
  }

  /**
   * Check if channel is unsubscribed
   */
  isUnsubscribed(channel: NotificationChannel): boolean {
    switch (channel) {
      case NotificationChannel.SMS:
        return this.smsUnsubscribed;
      case NotificationChannel.WHATSAPP:
        return this.whatsappUnsubscribed;
      default:
        return false;
    }
  }
}
