import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email template data
 */
export interface EmailTemplateData {
  [key: string]: string | number | boolean | Date | undefined;
}

/**
 * Email Service
 * Per GAP-017: Email service implementation for notifications
 *
 * Supports:
 * - SMTP transport (production)
 * - MailHog (development)
 * - Template-based emails
 * - Attachments for policy documents
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly enabled: boolean;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('EMAIL_ENABLED', false);
    this.defaultFrom = this.configService.get<string>(
      'EMAIL_FROM',
      'BodaInsure <noreply@bodainsure.co.ke>',
    );
    this.defaultReplyTo = this.configService.get<string>(
      'EMAIL_REPLY_TO',
      'support@bodainsure.co.ke',
    );

    // Configure SMTP transport
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'localhost');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 1025);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser && smtpPass
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
      // For development with MailHog
      ignoreTLS: !smtpSecure,
    });

    if (!this.enabled) {
      this.logger.warn('Email service is DISABLED. Set EMAIL_ENABLED=true to enable.');
    }
  }

  /**
   * Send an email
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
    } = request;

    if (!this.enabled) {
      this.logger.debug(`Email disabled. Would send: to=${Array.isArray(to) ? to.join(',') : to} subject="${subject}"`);
      return {
        success: true,
        messageId: `dev-email-${Date.now()}`,
      };
    }

    try {
      const result = await this.transporter.sendMail({
        from,
        to: Array.isArray(to) ? to.join(', ') : to,
        cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
        replyTo,
        subject,
        text,
        html,
        attachments,
      });

      this.logger.log(
        `Email sent: to=${Array.isArray(to) ? to[0] : to} subject="${subject}" messageId=${result.messageId}`,
      );

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email send failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
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
    template: string,
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
