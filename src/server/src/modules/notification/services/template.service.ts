import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  NotificationTemplate,
  TemplateStatus,
  DEFAULT_TEMPLATES,
} from '../entities/notification-template.entity.js';
import { NotificationChannel, NotificationType } from '../entities/notification.entity.js';
import { AuditService } from '../../audit/services/audit.service.js';
import { AuditEventType } from '../../audit/entities/audit-event.entity.js';

/**
 * Create template request DTO
 */
export interface CreateTemplateDto {
  code: string;
  name: string;
  description?: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  status?: TemplateStatus;
  subject?: string;
  body: string;
  htmlBody?: string;
  previewText?: string;
  requiredVariables?: string[];
  locale?: string;
  whatsappTemplateName?: string;
  whatsappNamespace?: string;
  createdBy?: string;
}

/**
 * Update template request DTO
 */
export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  status?: TemplateStatus;
  subject?: string;
  body?: string;
  htmlBody?: string;
  previewText?: string;
  requiredVariables?: string[];
  locale?: string;
  whatsappTemplateName?: string;
  whatsappNamespace?: string;
  updatedBy?: string;
}

/**
 * Template query options
 */
export interface TemplateQueryOptions {
  channel?: NotificationChannel;
  notificationType?: NotificationType;
  status?: TemplateStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Template Service
 * Full CRUD operations for notification templates
 *
 * Per GAP-E04: Database-driven templates for SMS and Email
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new template
   */
  async create(dto: CreateTemplateDto): Promise<NotificationTemplate> {
    // Check for duplicate code
    const existing = await this.templateRepository.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Template with code '${dto.code}' already exists`);
    }

    const template = this.templateRepository.create({
      ...dto,
      status: dto.status ?? TemplateStatus.ACTIVE,
      requiredVariables: dto.requiredVariables ?? [],
      locale: dto.locale ?? 'en',
      version: 1,
    });

    const saved = await this.templateRepository.save(template);

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.TEMPLATE_CREATED,
      actorId: dto.createdBy,
      entityType: 'notification_template',
      entityId: saved.id,
      description: `Created template: ${saved.code} (${saved.channel})`,
      details: {
        code: saved.code,
        channel: saved.channel,
        notificationType: saved.notificationType,
      },
    });

    this.logger.log(`Created template: ${saved.code} (${saved.id})`);
    return saved;
  }

  /**
   * Update an existing template
   */
  async update(id: string, dto: UpdateTemplateDto): Promise<NotificationTemplate> {
    const template = await this.findById(id);

    // Track changes for audit
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (dto.name !== undefined && dto.name !== template.name) {
      changes['name'] = { from: template.name, to: dto.name };
      template.name = dto.name;
    }
    if (dto.description !== undefined && dto.description !== template.description) {
      changes['description'] = { from: template.description, to: dto.description };
      template.description = dto.description;
    }
    if (dto.status !== undefined && dto.status !== template.status) {
      changes['status'] = { from: template.status, to: dto.status };
      template.status = dto.status;
    }
    if (dto.subject !== undefined && dto.subject !== template.subject) {
      changes['subject'] = { from: template.subject, to: dto.subject };
      template.subject = dto.subject;
    }
    if (dto.body !== undefined && dto.body !== template.body) {
      changes['body'] = { from: '(previous)', to: '(updated)' };
      template.body = dto.body;
    }
    if (dto.htmlBody !== undefined && dto.htmlBody !== template.htmlBody) {
      changes['htmlBody'] = { from: '(previous)', to: '(updated)' };
      template.htmlBody = dto.htmlBody;
    }
    if (dto.previewText !== undefined && dto.previewText !== template.previewText) {
      changes['previewText'] = { from: template.previewText, to: dto.previewText };
      template.previewText = dto.previewText;
    }
    if (dto.requiredVariables !== undefined) {
      changes['requiredVariables'] = { from: template.requiredVariables, to: dto.requiredVariables };
      template.requiredVariables = dto.requiredVariables;
    }
    if (dto.locale !== undefined && dto.locale !== template.locale) {
      changes['locale'] = { from: template.locale, to: dto.locale };
      template.locale = dto.locale;
    }
    if (dto.whatsappTemplateName !== undefined) {
      template.whatsappTemplateName = dto.whatsappTemplateName;
    }
    if (dto.whatsappNamespace !== undefined) {
      template.whatsappNamespace = dto.whatsappNamespace;
    }

    template.updatedBy = dto.updatedBy;
    template.version += 1;

    const saved = await this.templateRepository.save(template);

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.TEMPLATE_UPDATED,
      actorId: dto.updatedBy,
      entityType: 'notification_template',
      entityId: saved.id,
      description: `Updated template: ${saved.code}`,
      details: {
        code: saved.code,
        version: saved.version,
        changes,
      },
    });

    this.logger.log(`Updated template: ${saved.code} (v${saved.version})`);
    return saved;
  }

  /**
   * Delete a template (soft delete by setting status to ARCHIVED)
   */
  async delete(id: string, deletedBy?: string): Promise<void> {
    const template = await this.findById(id);

    template.status = TemplateStatus.ARCHIVED;
    template.updatedBy = deletedBy;
    await this.templateRepository.save(template);

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.TEMPLATE_DELETED,
      actorId: deletedBy,
      entityType: 'notification_template',
      entityId: template.id,
      description: `Archived template: ${template.code}`,
      details: {
        code: template.code,
        channel: template.channel,
      },
    });

    this.logger.log(`Archived template: ${template.code}`);
  }

  /**
   * Find template by ID
   */
  async findById(id: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }

    return template;
  }

  /**
   * Find template by code
   */
  async findByCode(code: string): Promise<NotificationTemplate | null> {
    return this.templateRepository.findOne({
      where: { code },
    });
  }

  /**
   * Find active template by code
   */
  async findActiveByCode(code: string): Promise<NotificationTemplate | null> {
    return this.templateRepository.findOne({
      where: { code, status: TemplateStatus.ACTIVE },
    });
  }

  /**
   * Find templates by channel and type
   */
  async findByChannelAndType(
    channel: NotificationChannel,
    notificationType: NotificationType,
  ): Promise<NotificationTemplate[]> {
    return this.templateRepository.find({
      where: {
        channel,
        notificationType,
        status: In([TemplateStatus.ACTIVE, TemplateStatus.DRAFT]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * List all templates with filtering
   */
  async list(options: TemplateQueryOptions = {}): Promise<{
    templates: NotificationTemplate[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { channel, notificationType, status, search, page = 1, limit = 20 } = options;

    const qb = this.templateRepository.createQueryBuilder('template');

    // Exclude archived by default unless specifically requested
    if (status) {
      qb.andWhere('template.status = :status', { status });
    } else {
      qb.andWhere('template.status != :archived', { archived: TemplateStatus.ARCHIVED });
    }

    if (channel) {
      qb.andWhere('template.channel = :channel', { channel });
    }

    if (notificationType) {
      qb.andWhere('template.notification_type = :notificationType', { notificationType });
    }

    if (search) {
      qb.andWhere(
        '(template.code ILIKE :search OR template.name ILIKE :search OR template.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('template.channel', 'ASC')
      .addOrderBy('template.notification_type', 'ASC')
      .addOrderBy('template.code', 'ASC');

    const [templates, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      templates,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get templates grouped by channel
   */
  async getGroupedByChannel(): Promise<Record<NotificationChannel, NotificationTemplate[]>> {
    const templates = await this.templateRepository.find({
      where: { status: In([TemplateStatus.ACTIVE, TemplateStatus.DRAFT]) },
      order: { notificationType: 'ASC', code: 'ASC' },
    });

    const grouped: Record<NotificationChannel, NotificationTemplate[]> = {
      [NotificationChannel.SMS]: [],
      [NotificationChannel.EMAIL]: [],
      [NotificationChannel.WHATSAPP]: [],
      [NotificationChannel.PUSH]: [],
    };

    for (const template of templates) {
      grouped[template.channel].push(template);
    }

    return grouped;
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newCode: string, createdBy?: string): Promise<NotificationTemplate> {
    const original = await this.findById(id);

    // Check new code doesn't exist
    const existing = await this.findByCode(newCode);
    if (existing) {
      throw new ConflictException(`Template with code '${newCode}' already exists`);
    }

    return this.create({
      code: newCode,
      name: `${original.name} (Copy)`,
      description: original.description,
      channel: original.channel,
      notificationType: original.notificationType,
      status: TemplateStatus.DRAFT,
      subject: original.subject,
      body: original.body,
      htmlBody: original.htmlBody,
      previewText: original.previewText,
      requiredVariables: [...original.requiredVariables],
      locale: original.locale,
      whatsappTemplateName: original.whatsappTemplateName,
      whatsappNamespace: original.whatsappNamespace,
      createdBy,
    });
  }

  /**
   * Preview template with sample data
   */
  preview(
    template: NotificationTemplate,
    variables: Record<string, string | number>,
  ): { subject?: string; body: string; htmlBody?: string } {
    return {
      subject: template.renderSubject(variables),
      body: template.render(variables),
      htmlBody: template.renderHtmlBody(variables),
    };
  }

  /**
   * Seed default templates
   */
  async seedDefaults(): Promise<number> {
    let created = 0;

    for (const defaultTemplate of DEFAULT_TEMPLATES) {
      const existing = await this.findByCode(defaultTemplate.code);
      if (!existing) {
        await this.templateRepository.save(
          this.templateRepository.create({
            ...defaultTemplate,
            status: TemplateStatus.ACTIVE,
            locale: 'en',
            version: 1,
          }),
        );
        created++;
        this.logger.log(`Seeded template: ${defaultTemplate.code}`);
      }
    }

    // Seed email templates
    const emailTemplates = this.getDefaultEmailTemplates();
    for (const emailTemplate of emailTemplates) {
      const existing = await this.findByCode(emailTemplate.code);
      if (!existing) {
        await this.templateRepository.save(
          this.templateRepository.create({
            ...emailTemplate,
            status: TemplateStatus.ACTIVE,
            locale: 'en',
            version: 1,
          }),
        );
        created++;
        this.logger.log(`Seeded email template: ${emailTemplate.code}`);
      }
    }

    this.logger.log(`Seeded ${created} default templates`);
    return created;
  }

  /**
   * Get default email templates
   */
  private getDefaultEmailTemplates(): Array<Partial<NotificationTemplate>> {
    return [
      {
        code: 'WELCOME_EMAIL',
        name: 'Welcome Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.WELCOME,
        subject: 'Welcome to BodaInsure!',
        body: `Welcome to BodaInsure, {{name}}!

Thank you for registering with BodaInsure. You're now part of Kenya's first micro-payment insurance platform for bodaboda riders.

To get started:
1. Complete your KYC verification
2. Make your initial deposit of KES 1,048
3. Receive your 1-month TPO insurance policy
4. Pay KES 87 daily to build up to your 11-month policy

Stay safe on the roads!

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('welcome', {
          title: 'Welcome to BodaInsure!',
          greeting: 'Hi {{name}},',
          content: `<p>Thank you for registering with BodaInsure! You're now part of Kenya's first micro-payment insurance platform for bodaboda riders.</p>
            <h3>To get started:</h3>
            <ol>
              <li>Complete your KYC verification</li>
              <li>Make your initial deposit of KES 1,048</li>
              <li>Receive your 1-month TPO insurance policy</li>
              <li>Pay KES 87 daily to build up to your 11-month policy</li>
            </ol>
            <p>Stay safe on the roads!</p>`,
          ctaText: 'Complete KYC',
          ctaUrl: '{{appUrl}}/kyc',
        }),
        previewText: 'Welcome to BodaInsure! Get started with your insurance today.',
        requiredVariables: ['name', 'appUrl'],
      },
      {
        code: 'PAYMENT_CONFIRMATION_EMAIL',
        name: 'Payment Confirmation Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.PAYMENT_RECEIVED,
        subject: 'Payment Received - KES {{amount}}',
        body: `Payment Received - BodaInsure

Hi {{name}},

We received your payment of KES {{amount}}.

Transaction ID: {{transactionId}}
Date: {{paymentDate}}
Wallet Balance: KES {{walletBalance}}
Days Remaining: {{daysRemaining}}

Thank you for your payment!

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('payment', {
          title: 'Payment Received',
          greeting: 'Hi {{name}},',
          content: `<p>We've received your payment. Thank you!</p>
            <div class="highlight-box">
              <p><strong>Amount:</strong> KES {{amount}}</p>
              <p><strong>Transaction ID:</strong> {{transactionId}}</p>
              <p><strong>Wallet Balance:</strong> KES {{walletBalance}}</p>
              <p><strong>Days Remaining:</strong> {{daysRemaining}}</p>
            </div>`,
        }),
        previewText: 'Your payment of KES {{amount}} has been received.',
        requiredVariables: ['name', 'amount', 'transactionId', 'paymentDate', 'walletBalance', 'daysRemaining'],
      },
      {
        code: 'POLICY_CERTIFICATE_EMAIL',
        name: 'Policy Certificate Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.POLICY_ISSUED,
        subject: 'Your BodaInsure Policy Certificate - {{policyNumber}}',
        body: `Your BodaInsure Policy Certificate

Hi {{name}},

Your insurance policy has been issued!

Policy Number: {{policyNumber}}
Vehicle: {{vehicleReg}}
Valid From: {{validFrom}}
Valid To: {{validTo}}

Please find your policy certificate attached to this email.
Keep this document safe - you may need it for traffic police verification.

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('policy', {
          title: 'Your Policy Certificate',
          greeting: 'Hi {{name}},',
          content: `<p>Great news! Your insurance policy has been issued.</p>
            <div class="highlight-box">
              <p><strong>Policy Number:</strong> {{policyNumber}}</p>
              <p><strong>Vehicle:</strong> {{vehicleReg}}</p>
              <p><strong>Valid From:</strong> {{validFrom}}</p>
              <p><strong>Valid To:</strong> {{validTo}}</p>
            </div>
            <p>Your policy certificate is attached to this email. Please keep it safe!</p>`,
        }),
        previewText: 'Your insurance policy {{policyNumber}} is now active!',
        requiredVariables: ['name', 'policyNumber', 'vehicleReg', 'validFrom', 'validTo'],
      },
      {
        code: 'PAYMENT_REMINDER_EMAIL',
        name: 'Payment Reminder Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.PAYMENT_REMINDER,
        subject: 'Payment Reminder - BodaInsure',
        body: `Payment Reminder - BodaInsure

Hi {{name}},

Your daily payment is {{daysOverdue}} day(s) overdue.

Amount Due: KES {{amountDue}}
Grace Period Remaining: {{graceDaysRemaining}} days

Please make your payment to maintain your insurance coverage.

Pay now via M-Pesa PayBill: 247247
Account: BodaInsure

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('reminder', {
          title: 'Payment Reminder',
          greeting: 'Hi {{name}},',
          content: `<p>Your daily payment is <strong>{{daysOverdue}} day(s)</strong> overdue.</p>
            <div class="highlight-box warning">
              <p><strong>Amount Due:</strong> KES {{amountDue}}</p>
              <p><strong>Grace Period Remaining:</strong> {{graceDaysRemaining}} days</p>
            </div>
            <p>Please make your payment to maintain your insurance coverage.</p>
            <p><strong>PayBill:</strong> 247247<br><strong>Account:</strong> BodaInsure</p>`,
          headerColor: '#dc2626',
        }),
        previewText: 'Your daily payment is overdue. Please pay to maintain coverage.',
        requiredVariables: ['name', 'daysOverdue', 'amountDue', 'graceDaysRemaining'],
      },
      {
        code: 'POLICY_EXPIRY_WARNING_EMAIL',
        name: 'Policy Expiry Warning Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.POLICY_EXPIRING,
        subject: 'Policy Expiring Soon - {{policyNumber}}',
        body: `Policy Expiry Warning - BodaInsure

Hi {{name}},

Your policy {{policyNumber}} will expire in {{daysUntilExpiry}} days.

Expiry Date: {{expiryDate}}

Continue your daily payments to maintain coverage, or make a deposit payment to start a new policy cycle.

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('expiry', {
          title: 'Policy Expiring Soon',
          greeting: 'Hi {{name}},',
          content: `<p>Your policy <strong>{{policyNumber}}</strong> will expire in <strong>{{daysUntilExpiry}} days</strong>.</p>
            <div class="highlight-box warning">
              <p><strong>Expiry Date:</strong> {{expiryDate}}</p>
            </div>
            <p>Continue your daily payments to maintain coverage.</p>`,
          headerColor: '#f59e0b',
        }),
        previewText: 'Your policy {{policyNumber}} expires in {{daysUntilExpiry}} days.',
        requiredVariables: ['name', 'policyNumber', 'daysUntilExpiry', 'expiryDate'],
      },
    ];
  }

  /**
   * Generate consistent HTML email template
   */
  private generateEmailHtml(
    _type: string,
    options: {
      title: string;
      greeting: string;
      content: string;
      ctaText?: string;
      ctaUrl?: string;
      headerColor?: string;
    },
  ): string {
    const headerColor = options.headerColor ?? '#2563eb';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: ${headerColor};
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .content p {
      margin: 0 0 16px;
    }
    .content h3 {
      margin: 24px 0 12px;
      color: #374151;
    }
    .content ol, .content ul {
      margin: 0 0 16px;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
    }
    .highlight-box {
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .highlight-box.warning {
      background: #fef3c7;
      border-left-color: #f59e0b;
    }
    .highlight-box p {
      margin: 8px 0;
    }
    .highlight-box p:last-child {
      margin-bottom: 0;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 28px;
      background: ${headerColor};
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .footer {
      padding: 24px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${options.title}</h1>
    </div>
    <div class="content">
      <p>${options.greeting}</p>
      ${options.content}
      ${options.ctaText && options.ctaUrl ? `<p style="text-align: center;"><a href="${options.ctaUrl}" class="cta-button">${options.ctaText}</a></p>` : ''}
    </div>
    <div class="footer">
      <p><strong>BodaInsure</strong> - Insurance Made Simple</p>
      <p>Questions? Email us at <a href="mailto:support@bodainsure.co.ke">support@bodainsure.co.ke</a></p>
      <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
        You received this email because you have an account with BodaInsure.
      </p>
    </div>
  </div>
</body>
</html>`;
  }
}
