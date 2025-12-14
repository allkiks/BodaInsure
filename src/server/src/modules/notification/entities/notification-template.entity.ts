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
 * Template status
 */
export enum TemplateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Notification Template Entity
 * Stores reusable message templates for different notification types
 *
 * Templates support variable substitution using {{variable}} syntax
 */
@Entity('notification_templates')
@Index(['channel', 'notificationType', 'status'])
@Index(['code'], { unique: true })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique template code for easy reference */
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  /** Human-readable template name */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Template description */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Channel this template is for */
  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel!: NotificationChannel;

  /** Notification type this template is for */
  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: NotificationType,
  })
  notificationType!: NotificationType;

  /** Template status */
  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.ACTIVE,
  })
  status!: TemplateStatus;

  /** Subject line (for WhatsApp/email) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  subject?: string;

  /** Message body template with {{variables}} */
  @Column({ type: 'text' })
  body!: string;

  /** Required variables for this template */
  @Column({ name: 'required_variables', type: 'jsonb', default: '[]' })
  requiredVariables!: string[];

  /** Language/locale */
  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale!: string;

  /** WhatsApp template name (for pre-approved templates) */
  @Column({ name: 'whatsapp_template_name', type: 'varchar', length: 100, nullable: true })
  whatsappTemplateName?: string;

  /** WhatsApp template namespace */
  @Column({ name: 'whatsapp_namespace', type: 'varchar', length: 100, nullable: true })
  whatsappNamespace?: string;

  /** Version number for tracking changes */
  @Column({ type: 'integer', default: 1 })
  version!: number;

  /** Created by user ID */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  /** Last updated by user ID */
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Render the template with provided variables
   */
  render(variables: Record<string, string | number>): string {
    let rendered = this.body;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  /**
   * Render subject with variables
   */
  renderSubject(variables: Record<string, string | number>): string | undefined {
    if (!this.subject) return undefined;

    let rendered = this.subject;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  /**
   * Validate that all required variables are provided
   */
  validateVariables(variables: Record<string, unknown>): string[] {
    const missing: string[] = [];

    for (const required of this.requiredVariables) {
      if (!(required in variables) || variables[required] === undefined) {
        missing.push(required);
      }
    }

    return missing;
  }

  /**
   * Check if template is active
   */
  isActive(): boolean {
    return this.status === TemplateStatus.ACTIVE;
  }
}

/**
 * Default templates for the system
 * These are seeded on first deployment
 */
export const DEFAULT_TEMPLATES = [
  // OTP Templates
  {
    code: 'OTP_SMS',
    name: 'OTP SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.OTP,
    body: 'Your BodaInsure verification code is {{otp}}. Valid for 5 minutes. Do not share this code.',
    requiredVariables: ['otp'],
  },
  {
    code: 'OTP_WHATSAPP',
    name: 'OTP WhatsApp',
    channel: NotificationChannel.WHATSAPP,
    notificationType: NotificationType.OTP,
    body: 'Your BodaInsure verification code is *{{otp}}*. Valid for 5 minutes.\n\nDo not share this code with anyone.',
    requiredVariables: ['otp'],
  },

  // Welcome
  {
    code: 'WELCOME_SMS',
    name: 'Welcome SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.WELCOME,
    body: 'Welcome to BodaInsure, {{name}}! You can now access affordable bodaboda insurance. Visit bodainsure.co.ke or dial *384# for more info.',
    requiredVariables: ['name'],
  },

  // Payment Reminders
  {
    code: 'PAYMENT_REMINDER_SMS',
    name: 'Daily Payment Reminder SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.PAYMENT_REMINDER,
    body: 'Hi {{name}}, your daily BodaInsure payment of KES {{amount}} is due. Pay now to maintain coverage. Dial *384# or M-Pesa to 123456.',
    requiredVariables: ['name', 'amount'],
  },
  {
    code: 'PAYMENT_REMINDER_WHATSAPP',
    name: 'Daily Payment Reminder WhatsApp',
    channel: NotificationChannel.WHATSAPP,
    notificationType: NotificationType.PAYMENT_REMINDER,
    subject: 'Payment Reminder',
    body: 'Hi {{name}} 👋\n\nYour daily BodaInsure payment of *KES {{amount}}* is due today.\n\n💳 Pay now to keep your coverage active.\n\nDays remaining: {{daysRemaining}}/30\n\nDial *384# or use M-Pesa.',
    requiredVariables: ['name', 'amount', 'daysRemaining'],
  },

  // Payment Received
  {
    code: 'PAYMENT_RECEIVED_SMS',
    name: 'Payment Received SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.PAYMENT_RECEIVED,
    body: 'Payment of KES {{amount}} received. Ref: {{reference}}. Balance: KES {{balance}}. Thank you for using BodaInsure!',
    requiredVariables: ['amount', 'reference', 'balance'],
  },
  {
    code: 'PAYMENT_RECEIVED_WHATSAPP',
    name: 'Payment Received WhatsApp',
    channel: NotificationChannel.WHATSAPP,
    notificationType: NotificationType.PAYMENT_RECEIVED,
    subject: 'Payment Confirmed',
    body: '✅ *Payment Received*\n\nAmount: KES {{amount}}\nRef: {{reference}}\nBalance: KES {{balance}}\n\nThank you for using BodaInsure!',
    requiredVariables: ['amount', 'reference', 'balance'],
  },

  // Policy Issued
  {
    code: 'POLICY_ISSUED_SMS',
    name: 'Policy Issued SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.POLICY_ISSUED,
    body: 'Your BodaInsure policy {{policyNumber}} is now active! Coverage: {{coverageStart}} to {{coverageEnd}}. Certificate sent via WhatsApp.',
    requiredVariables: ['policyNumber', 'coverageStart', 'coverageEnd'],
  },
  {
    code: 'POLICY_ISSUED_WHATSAPP',
    name: 'Policy Issued WhatsApp',
    channel: NotificationChannel.WHATSAPP,
    notificationType: NotificationType.POLICY_ISSUED,
    subject: 'Policy Issued',
    body: '🎉 *Your Insurance Policy is Active!*\n\nPolicy No: {{policyNumber}}\nVehicle: {{vehicleRegistration}}\nCoverage: {{coverageStart}} to {{coverageEnd}}\n\nYour certificate is attached below. Keep it safe!',
    requiredVariables: ['policyNumber', 'vehicleRegistration', 'coverageStart', 'coverageEnd'],
  },

  // Policy Expiring
  {
    code: 'POLICY_EXPIRING_SMS',
    name: 'Policy Expiring SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.POLICY_EXPIRING,
    body: 'Your BodaInsure policy {{policyNumber}} expires in {{daysRemaining}} days. Renew now to stay covered. Dial *384#.',
    requiredVariables: ['policyNumber', 'daysRemaining'],
  },
  {
    code: 'POLICY_EXPIRING_WHATSAPP',
    name: 'Policy Expiring WhatsApp',
    channel: NotificationChannel.WHATSAPP,
    notificationType: NotificationType.POLICY_EXPIRING,
    subject: 'Policy Expiring Soon',
    body: '⚠️ *Policy Expiring Soon*\n\nYour policy {{policyNumber}} expires in *{{daysRemaining}} days* on {{expiryDate}}.\n\nRenew now to maintain continuous coverage and avoid fines.\n\nDial *384# to renew.',
    requiredVariables: ['policyNumber', 'daysRemaining', 'expiryDate'],
  },

  // Policy Expired
  {
    code: 'POLICY_EXPIRED_SMS',
    name: 'Policy Expired SMS',
    channel: NotificationChannel.SMS,
    notificationType: NotificationType.POLICY_EXPIRED,
    body: 'Your BodaInsure policy {{policyNumber}} has expired. You are no longer covered. Purchase new insurance at *384# to avoid fines.',
    requiredVariables: ['policyNumber'],
  },
];
