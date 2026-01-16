import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AuditService } from '../../audit/services/audit.service.js';
import { AuditEventType } from '../../audit/entities/audit-event.entity.js';

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email send request
 */
export interface EmailSendRequest {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
  /** User ID for audit logging */
  userId?: string;
  /** Skip validation (for internal use) */
  skipValidation?: boolean;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount?: number;
}

/**
 * Email template data
 */
export interface EmailTemplateData {
  [key: string]: string | number | boolean | Date | undefined;
}

/**
 * Validate email address format
 * Per GAP-E05: Email validation
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Mask email for logging (show first 3 chars + domain)
 */
export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0].substring(0, 3) + '***';
  return `${local}@${parts[1]}`;
}

/**
 * Predefined SMTP provider configurations
 */
interface SmtpProviderConfig {
  host: string;
  port: number;
  secure: 'true' | 'false' | 'STARTTLS';
  requiresAuth: boolean;
}

const SMTP_PROVIDERS: Record<string, SmtpProviderConfig> = {
  mailhog: {
    host: 'mailhog',
    port: 1025,
    secure: 'false',
    requiresAuth: false,
  },
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: 'STARTTLS',
    requiresAuth: true,
  },
  outlook: {
    host: 'smtp.office365.com',
    port: 587,
    secure: 'STARTTLS',
    requiresAuth: true,
  },
  custom: {
    host: 'localhost',
    port: 25,
    secure: 'false',
    requiresAuth: false,
  },
};

/**
 * Email Service
 * Per GAP-017: Email service implementation for notifications
 *
 * Supports:
 * - SMTP transport (production)
 * - MailHog (development)
 * - Template-based emails
 * - Attachments for policy documents
 *
 * Enhanced with:
 * - GAP-E02: Audit logging integration
 * - GAP-E03: Retry logic with exponential backoff
 * - GAP-E05: Email address validation
 * - SMTP_PROVIDER selector for easy provider switching
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly enabled: boolean;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly smtpHost: string;
  private readonly smtpProvider: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
  ) {
    this.enabled = this.configService.get<boolean>('EMAIL_ENABLED', false);
    this.defaultFrom = this.configService.get<string>(
      'EMAIL_FROM',
      'BodaInsure <noreply@bodainsure.co.ke>',
    );
    this.defaultReplyTo = this.configService.get<string>(
      'EMAIL_REPLY_TO',
      'support@bodainsure.co.ke',
    );

    // Retry configuration (GAP-E03)
    this.maxRetries = this.configService.get<number>('EMAIL_MAX_RETRIES', 3);
    this.retryDelayMs = this.configService.get<number>('EMAIL_RETRY_DELAY_MS', 1000);

    // Get SMTP provider (mailhog, gmail, outlook, or custom)
    this.smtpProvider = this.configService.get<string>('SMTP_PROVIDER', 'custom').toLowerCase();
    const providerConfig = SMTP_PROVIDERS[this.smtpProvider] || SMTP_PROVIDERS.custom;

    // Configure SMTP transport - use provider defaults, allow overrides
    this.smtpHost = this.configService.get<string>('SMTP_HOST') || providerConfig.host;
    const smtpPort = this.configService.get<number>('SMTP_PORT') || providerConfig.port;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpSecure = this.configService.get<string>('SMTP_SECURE') || providerConfig.secure;

    // Handle STARTTLS vs true/false
    const isSecure = smtpSecure === 'true' || smtpSecure === 'STARTTLS';

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: smtpPort,
      secure: smtpSecure === 'true', // Only true if explicitly "true", not STARTTLS
      auth: smtpUser && smtpPass
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
      // For development with MailHog or STARTTLS
      ignoreTLS: !isSecure,
      tls: smtpSecure === 'STARTTLS' ? { rejectUnauthorized: false } : undefined,
    });

    if (!this.enabled) {
      this.logger.warn('Email service is DISABLED. Set EMAIL_ENABLED=true to enable.');
    } else {
      this.logger.log(`Email service configured with provider: ${this.smtpProvider} (${this.smtpHost}:${smtpPort})`);
    }
  }

  /**
   * Send an email with validation, retry logic, and audit logging
   *
   * Per GAP-E02: Audit logging integration
   * Per GAP-E03: Retry logic with exponential backoff
   * Per GAP-E05: Email address validation
   */
  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const {
      to,
      subject,
      text,
      html,
      from = this.defaultFrom,
      replyTo = this.defaultReplyTo,
      cc,
      bcc,
      attachments,
      userId,
      skipValidation,
    } = request;

    // Normalize recipients to array
    const recipients = Array.isArray(to) ? to : [to];
    const maskedRecipients = recipients.map(maskEmail).join(', ');

    // GAP-E05: Validate email addresses
    if (!skipValidation) {
      const invalidEmails = recipients.filter((email) => !isValidEmail(email));
      if (invalidEmails.length > 0) {
        const errorMessage = `Invalid email address(es): ${invalidEmails.map(maskEmail).join(', ')}`;
        this.logger.warn(errorMessage);

        // Log audit event for validation failure
        await this.logAuditEvent(
          AuditEventType.EMAIL_FAILED,
          userId,
          maskedRecipients,
          subject,
          errorMessage,
        );

        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    // Handle disabled mode
    if (!this.enabled) {
      this.logger.debug(
        `Email disabled. Would send: to=${maskedRecipients} subject="${subject}"`,
      );
      return {
        success: true,
        messageId: `dev-email-${Date.now()}`,
      };
    }

    // GAP-E03: Retry logic with exponential backoff
    let lastError: string | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.transporter.sendMail({
          from,
          to: recipients.join(', '),
          cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
          bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
          replyTo,
          subject,
          text,
          html,
          attachments,
        });

        this.logger.log(
          `Email sent: to=${maskedRecipients} subject="${subject}" messageId=${result.messageId}${retryCount > 0 ? ` (after ${retryCount} retries)` : ''}`,
        );

        // GAP-E02: Log audit event for success
        await this.logAuditEvent(
          AuditEventType.EMAIL_SENT,
          userId,
          maskedRecipients,
          subject,
          undefined,
          result.messageId,
        );

        return {
          success: true,
          messageId: result.messageId,
          retryCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retryCount = attempt;

        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt >= this.maxRetries) {
          break;
        }

        // Exponential backoff delay
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Email send attempt ${attempt + 1} failed: ${lastError}. Retrying in ${delay}ms...`,
        );
        await this.sleep(delay);
      }
    }

    // All retries exhausted or non-retryable error
    this.logger.error(
      `Email send failed after ${retryCount + 1} attempts: ${lastError}`,
    );

    // GAP-E02: Log audit event for failure
    await this.logAuditEvent(
      AuditEventType.EMAIL_FAILED,
      userId,
      maskedRecipients,
      subject,
      lastError,
    );

    return {
      success: false,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: string): boolean {
    const nonRetryablePatterns = [
      'invalid email',
      'invalid address',
      'recipient rejected',
      'user unknown',
      'mailbox not found',
      'authentication failed',
      'relay denied',
    ];

    const lowerError = error.toLowerCase();
    return !nonRetryablePatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log audit event (GAP-E02)
   */
  private async logAuditEvent(
    eventType: AuditEventType,
    userId: string | undefined,
    recipient: string,
    subject: string,
    error?: string,
    messageId?: string,
  ): Promise<void> {
    if (!this.auditService) {
      // Audit service not available, log to console instead
      this.logger.debug(
        JSON.stringify({
          audit: true,
          eventType,
          provider: this.smtpHost,
          recipient,
          subject,
          messageId,
          error,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    try {
      await this.auditService.log({
        eventType,
        userId,
        entityType: 'email',
        description: error
          ? `Email failed to ${recipient}: ${error}`
          : `Email sent to ${recipient}`,
        details: {
          recipient,
          subject,
          messageId,
          provider: this.smtpHost,
          error,
        },
        outcome: error ? 'failure' : 'success',
        errorMessage: error,
        channel: 'notification',
      });
    } catch (auditError) {
      // Don't let audit logging failure break email sending
      this.logger.warn(
        `Failed to log audit event: ${auditError instanceof Error ? auditError.message : String(auditError)}`,
      );
    }
  }

  // ============================================================
  // BodaInsure-specific email methods
  // ============================================================

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(
    to: string,
    name: string,
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('welcome', { name });
    const text = `Welcome to BodaInsure, ${name}!\n\nThank you for registering. You can now start paying for your TPO insurance.\n\nBodaInsure Team`;

    return this.send({
      to,
      subject: 'Welcome to BodaInsure!',
      text,
      html,
    });
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(
    to: string,
    data: {
      name: string;
      amount: number;
      transactionId: string;
      paymentDate: Date;
      walletBalance: number;
      daysRemaining: number;
    },
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('payment_confirmation', data);
    const text = `
Payment Received - BodaInsure

Hi ${data.name},

We received your payment of KES ${data.amount.toFixed(0)}.

Transaction ID: ${data.transactionId}
Date: ${data.paymentDate.toLocaleDateString('en-KE')}
Wallet Balance: KES ${data.walletBalance.toFixed(0)}
Days Remaining: ${data.daysRemaining}

Thank you for your payment!

BodaInsure Team
    `.trim();

    return this.send({
      to,
      subject: `Payment Received - KES ${data.amount.toFixed(0)}`,
      text,
      html,
    });
  }

  /**
   * Send policy certificate email with PDF attachment
   */
  async sendPolicyCertificate(
    to: string,
    data: {
      name: string;
      policyNumber: string;
      vehicleReg: string;
      validFrom: Date;
      validTo: Date;
    },
    pdfBuffer: Buffer,
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('policy_certificate', data);
    const text = `
Your BodaInsure Policy Certificate

Hi ${data.name},

Your insurance policy has been issued!

Policy Number: ${data.policyNumber}
Vehicle: ${data.vehicleReg}
Valid From: ${data.validFrom.toLocaleDateString('en-KE')}
Valid To: ${data.validTo.toLocaleDateString('en-KE')}

Please find your policy certificate attached to this email.
Keep this document safe - you may need it for traffic police verification.

BodaInsure Team
    `.trim();

    return this.send({
      to,
      subject: `Your BodaInsure Policy Certificate - ${data.policyNumber}`,
      text,
      html,
      attachments: [
        {
          filename: `BodaInsure_Policy_${data.policyNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminder(
    to: string,
    data: {
      name: string;
      daysOverdue: number;
      amountDue: number;
      graceDaysRemaining: number;
    },
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('payment_reminder', data);
    const text = `
Payment Reminder - BodaInsure

Hi ${data.name},

Your daily payment is ${data.daysOverdue} day(s) overdue.

Amount Due: KES ${data.amountDue.toFixed(0)}
Grace Period Remaining: ${data.graceDaysRemaining} days

Please make your payment to maintain your insurance coverage.

Pay now via M-Pesa PayBill: 247247
Account: BodaInsure

BodaInsure Team
    `.trim();

    return this.send({
      to,
      subject: 'Payment Reminder - BodaInsure',
      text,
      html,
    });
  }

  /**
   * Send policy expiry warning
   */
  async sendPolicyExpiryWarning(
    to: string,
    data: {
      name: string;
      policyNumber: string;
      expiryDate: Date;
      daysUntilExpiry: number;
    },
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('policy_expiry_warning', data);
    const text = `
Policy Expiry Warning - BodaInsure

Hi ${data.name},

Your policy ${data.policyNumber} will expire in ${data.daysUntilExpiry} days.

Expiry Date: ${data.expiryDate.toLocaleDateString('en-KE')}

Continue your daily payments to maintain coverage, or make a deposit payment to start a new policy cycle.

BodaInsure Team
    `.trim();

    return this.send({
      to,
      subject: `Policy Expiring Soon - ${data.policyNumber}`,
      text,
      html,
    });
  }

  /**
   * Send data export email with attachment
   */
  async sendDataExport(
    to: string,
    name: string,
    exportData: Buffer,
    format: 'json' | 'csv' = 'json',
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('data_export', { name, format });
    const text = `
Your BodaInsure Data Export

Hi ${name},

As requested, please find your data export attached to this email.

This export contains all personal data we hold about you as per the Kenya Data Protection Act 2019.

If you did not request this export, please contact us immediately at support@bodainsure.co.ke.

BodaInsure Team
    `.trim();

    return this.send({
      to,
      subject: 'Your BodaInsure Data Export',
      text,
      html,
      attachments: [
        {
          filename: `bodainsure_data_export.${format}`,
          content: exportData,
          contentType: format === 'json' ? 'application/json' : 'text/csv',
        },
      ],
    });
  }

  /**
   * Send organization report email
   */
  async sendOrganizationReport(
    to: string | string[],
    data: {
      organizationName: string;
      reportType: string;
      reportDate: Date;
    },
    reportBuffer: Buffer,
    filename: string,
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate('organization_report', data);
    const text = `
${data.reportType} Report - ${data.organizationName}

Date: ${data.reportDate.toLocaleDateString('en-KE')}

Please find the attached report for your organization.

BodaInsure Team
    `.trim();

    return this.send({
      to,
      subject: `${data.reportType} Report - ${data.organizationName}`,
      text,
      html,
      attachments: [
        {
          filename,
          content: reportBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Render an email template
   * Simple template rendering - replace with proper templating engine in production
   */
  private renderTemplate(
    templateName: string,
    data: EmailTemplateData,
  ): string {
    // Base styles
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; }
        .highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
      </style>
    `;

    // Simple template rendering
    const templates: Record<string, (d: EmailTemplateData) => string> = {
      welcome: (d) => `
        ${styles}
        <div class="container">
          <div class="header"><h1>Welcome to BodaInsure!</h1></div>
          <div class="content">
            <p>Hi ${d.name},</p>
            <p>Thank you for registering with BodaInsure! You're now part of Kenya's first micro-payment insurance platform for bodaboda riders.</p>
            <p>To get started:</p>
            <ol>
              <li>Complete your KYC verification</li>
              <li>Make your initial deposit of KES 1,048</li>
              <li>Receive your 1-month TPO insurance policy</li>
              <li>Pay KES 87 daily to build up to your 11-month policy</li>
            </ol>
            <p>Stay safe on the roads!</p>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
            <p>Questions? Email us at support@bodainsure.co.ke</p>
          </div>
        </div>
      `,
      payment_confirmation: (d) => `
        ${styles}
        <div class="container">
          <div class="header"><h1>Payment Received</h1></div>
          <div class="content">
            <p>Hi ${d.name},</p>
            <p>We've received your payment. Thank you!</p>
            <div class="highlight">
              <strong>Amount:</strong> KES ${Number(d.amount).toFixed(0)}<br>
              <strong>Transaction ID:</strong> ${d.transactionId}<br>
              <strong>Wallet Balance:</strong> KES ${Number(d.walletBalance).toFixed(0)}<br>
              <strong>Days Remaining:</strong> ${d.daysRemaining}
            </div>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
          </div>
        </div>
      `,
      policy_certificate: (d) => `
        ${styles}
        <div class="container">
          <div class="header"><h1>Your Policy Certificate</h1></div>
          <div class="content">
            <p>Hi ${d.name},</p>
            <p>Great news! Your insurance policy has been issued.</p>
            <div class="highlight">
              <strong>Policy Number:</strong> ${d.policyNumber}<br>
              <strong>Vehicle:</strong> ${d.vehicleReg}<br>
              <strong>Valid From:</strong> ${d.validFrom}<br>
              <strong>Valid To:</strong> ${d.validTo}
            </div>
            <p>Your policy certificate is attached to this email. Please keep it safe!</p>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
          </div>
        </div>
      `,
      payment_reminder: (d) => `
        ${styles}
        <div class="container">
          <div class="header" style="background: #dc2626;"><h1>Payment Reminder</h1></div>
          <div class="content">
            <p>Hi ${d.name},</p>
            <p>Your daily payment is <strong>${d.daysOverdue} day(s)</strong> overdue.</p>
            <div class="highlight">
              <strong>Amount Due:</strong> KES ${Number(d.amountDue).toFixed(0)}<br>
              <strong>Grace Period Remaining:</strong> ${d.graceDaysRemaining} days
            </div>
            <p>Please make your payment to maintain your insurance coverage.</p>
            <p><strong>PayBill:</strong> 247247<br><strong>Account:</strong> BodaInsure</p>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
          </div>
        </div>
      `,
      policy_expiry_warning: (d) => `
        ${styles}
        <div class="container">
          <div class="header" style="background: #f59e0b;"><h1>Policy Expiring Soon</h1></div>
          <div class="content">
            <p>Hi ${d.name},</p>
            <p>Your policy <strong>${d.policyNumber}</strong> will expire in <strong>${d.daysUntilExpiry} days</strong>.</p>
            <div class="highlight">
              <strong>Expiry Date:</strong> ${d.expiryDate}
            </div>
            <p>Continue your daily payments to maintain coverage.</p>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
          </div>
        </div>
      `,
      data_export: (d) => `
        ${styles}
        <div class="container">
          <div class="header"><h1>Your Data Export</h1></div>
          <div class="content">
            <p>Hi ${d.name},</p>
            <p>As requested, your data export is attached to this email in ${String(d.format).toUpperCase()} format.</p>
            <p>This export contains all personal data we hold about you as per the Kenya Data Protection Act 2019.</p>
            <p>If you did not request this export, please contact us immediately.</p>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
          </div>
        </div>
      `,
      organization_report: (d) => `
        ${styles}
        <div class="container">
          <div class="header"><h1>${d.reportType} Report</h1></div>
          <div class="content">
            <p><strong>Organization:</strong> ${d.organizationName}</p>
            <p><strong>Report Date:</strong> ${d.reportDate}</p>
            <p>Please find the attached report for your organization.</p>
          </div>
          <div class="footer">
            <p>BodaInsure - Insurance Made Simple</p>
          </div>
        </div>
      `,
    };

    const templateFn = templates[templateName];
    if (!templateFn) {
      this.logger.warn(`Email template not found: ${templateName}`);
      return '';
    }

    return templateFn(data);
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP connection failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Check if email is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    enabled: boolean;
    connected: boolean;
  }> {
    const connected = await this.verifyConnection();
    return {
      enabled: this.enabled,
      connected,
    };
  }

  /**
   * Send a template-based email (used by queue processor)
   * Per GAP-020: Generic method for queue-based email delivery
   */
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>,
  ): Promise<EmailSendResult> {
    const html = this.renderTemplate(template, context as EmailTemplateData);
    const text = this.generatePlainText(template, context);

    return this.send({
      to,
      subject,
      text,
      html,
      attachments,
    });
  }

  /**
   * Generate plain text version from template context
   */
  private generatePlainText(
    _template: string,
    context: Record<string, unknown>,
  ): string {
    // Generate basic plain text from context
    const lines: string[] = [];

    if (context['name']) {
      lines.push(`Hi ${context['name']},`);
      lines.push('');
    }

    // Add key-value pairs from context
    for (const [key, value] of Object.entries(context)) {
      if (key !== 'name' && value !== undefined && value !== null) {
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());
        lines.push(`${formattedKey}: ${value}`);
      }
    }

    lines.push('');
    lines.push('BodaInsure Team');

    return lines.join('\n');
  }
}
