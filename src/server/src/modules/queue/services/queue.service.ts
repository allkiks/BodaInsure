import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import {
  QueueName,
  NotificationJobType,
  PolicyJobType,
  ReportJobType,
  DEFAULT_JOB_OPTIONS,
  SmsJobData,
  BulkSmsJobData,
  EmailJobData,
  WhatsAppJobData,
  PaymentReminderJobData,
  PolicyCertificateJobData,
  PolicyBatchJobData,
  PolicyExpirationJobData,
  ReportGenerationJobData,
  ReportExportJobData,
} from '../interfaces/job.interface.js';

/**
 * Queue Service
 * Per GAP-020: Centralized service for adding jobs to BullMQ queues
 *
 * Provides type-safe methods for:
 * - Notification jobs (SMS, Email, WhatsApp)
 * - Policy jobs (certificate generation, batch processing)
 * - Report jobs (generation, export)
 */
@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueName.NOTIFICATION)
    private readonly notificationQueue: Queue,
    @InjectQueue(QueueName.POLICY)
    private readonly policyQueue: Queue,
    @InjectQueue(QueueName.REPORT)
    private readonly reportQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Queue service initialized');

    // Log queue health
    const [notificationCount, policyCount, reportCount] = await Promise.all([
      this.notificationQueue.getJobCounts(),
      this.policyQueue.getJobCounts(),
      this.reportQueue.getJobCounts(),
    ]);

    this.logger.log(`Notification queue: ${JSON.stringify(notificationCount)}`);
    this.logger.log(`Policy queue: ${JSON.stringify(policyCount)}`);
    this.logger.log(`Report queue: ${JSON.stringify(reportCount)}`);
  }

  // ============================================
  // Notification Queue Methods
  // ============================================

  /**
   * Queue an SMS message for delivery
   */
  async queueSms(
    phone: string,
    message: string,
    options?: {
      userId?: string;
      organizationId?: string;
      provider?: string;
      priority?: number;
      delay?: number;
    },
  ): Promise<string> {
    const jobData: SmsJobData = {
      type: NotificationJobType.SEND_SMS,
      phone,
      message,
      provider: options?.provider,
      userId: options?.userId,
      organizationId: options?.organizationId,
      createdAt: new Date(),
    };

    const job = await this.notificationQueue.add(
      NotificationJobType.SEND_SMS,
      jobData,
      this.buildJobOptions({
        priority: options?.priority,
        delay: options?.delay,
      }),
    );

    this.logger.debug(`Queued SMS job ${job.id} to ${phone}`);
    return job.id!;
  }

  /**
   * Queue bulk SMS messages for delivery
   */
  async queueBulkSms(
    recipients: Array<{ phone: string; message: string }>,
    options?: {
      organizationId?: string;
      provider?: string;
      priority?: number;
    },
  ): Promise<string> {
    const jobData: BulkSmsJobData = {
      type: NotificationJobType.SEND_BULK_SMS,
      recipients,
      provider: options?.provider,
      organizationId: options?.organizationId,
      createdAt: new Date(),
    };

    const job = await this.notificationQueue.add(
      NotificationJobType.SEND_BULK_SMS,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued bulk SMS job ${job.id} for ${recipients.length} recipients`,
    );
    return job.id!;
  }

  /**
   * Queue an email for delivery
   */
  async queueEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    options?: {
      userId?: string;
      organizationId?: string;
      attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
      }>;
      priority?: number;
      delay?: number;
    },
  ): Promise<string> {
    const jobData: EmailJobData = {
      type: NotificationJobType.SEND_EMAIL,
      to,
      subject,
      template,
      context,
      attachments: options?.attachments,
      userId: options?.userId,
      organizationId: options?.organizationId,
      createdAt: new Date(),
    };

    const job = await this.notificationQueue.add(
      NotificationJobType.SEND_EMAIL,
      jobData,
      this.buildJobOptions({
        priority: options?.priority,
        delay: options?.delay,
      }),
    );

    this.logger.debug(`Queued email job ${job.id} to ${to}`);
    return job.id!;
  }

  /**
   * Queue a WhatsApp message for delivery
   */
  async queueWhatsApp(
    phone: string,
    template: string,
    parameters: string[],
    options?: {
      userId?: string;
      organizationId?: string;
      priority?: number;
      delay?: number;
    },
  ): Promise<string> {
    const jobData: WhatsAppJobData = {
      type: NotificationJobType.SEND_WHATSAPP,
      phone,
      template,
      parameters,
      userId: options?.userId,
      organizationId: options?.organizationId,
      createdAt: new Date(),
    };

    const job = await this.notificationQueue.add(
      NotificationJobType.SEND_WHATSAPP,
      jobData,
      this.buildJobOptions({
        priority: options?.priority,
        delay: options?.delay,
      }),
    );

    this.logger.debug(`Queued WhatsApp job ${job.id} to ${phone}`);
    return job.id!;
  }

  /**
   * Queue payment reminders for multiple users
   */
  async queuePaymentReminders(
    userIds: string[],
    reminderType: 'daily' | 'weekly' | 'final',
    options?: {
      organizationId?: string;
      priority?: number;
    },
  ): Promise<string> {
    const jobData: PaymentReminderJobData = {
      type: NotificationJobType.SEND_PAYMENT_REMINDER,
      userIds,
      reminderType,
      organizationId: options?.organizationId,
      createdAt: new Date(),
    };

    const job = await this.notificationQueue.add(
      NotificationJobType.SEND_PAYMENT_REMINDER,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued ${reminderType} payment reminder job ${job.id} for ${userIds.length} users`,
    );
    return job.id!;
  }

  // ============================================
  // Policy Queue Methods
  // ============================================

  /**
   * Queue policy certificate generation
   */
  async queueCertificateGeneration(
    policyId: string,
    deliveryMethod: 'sms' | 'whatsapp' | 'email',
    deliveryAddress: string,
    options?: {
      userId?: string;
      priority?: number;
    },
  ): Promise<string> {
    const jobData: PolicyCertificateJobData = {
      type: PolicyJobType.GENERATE_CERTIFICATE,
      policyId,
      deliveryMethod,
      deliveryAddress,
      userId: options?.userId,
      createdAt: new Date(),
    };

    const job = await this.policyQueue.add(
      PolicyJobType.GENERATE_CERTIFICATE,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued certificate generation job ${job.id} for policy ${policyId}`,
    );
    return job.id!;
  }

  /**
   * Queue batch policy processing
   */
  async queueBatchProcessing(
    batchId: string,
    policyType: '1_month' | '11_month',
    options?: {
      organizationId?: string;
      priority?: number;
    },
  ): Promise<string> {
    const jobData: PolicyBatchJobData = {
      type: PolicyJobType.PROCESS_BATCH,
      batchId,
      policyType,
      organizationId: options?.organizationId,
      createdAt: new Date(),
    };

    const job = await this.policyQueue.add(
      PolicyJobType.PROCESS_BATCH,
      jobData,
      this.buildJobOptions({ priority: options?.priority ?? 1 }), // High priority
    );

    this.logger.debug(
      `Queued batch processing job ${job.id} for batch ${batchId}`,
    );
    return job.id!;
  }

  /**
   * Queue policy expiration
   */
  async queuePolicyExpiration(
    policyIds: string[],
    options?: { priority?: number },
  ): Promise<string> {
    const jobData: PolicyExpirationJobData = {
      type: PolicyJobType.EXPIRE_POLICY,
      policyIds,
      createdAt: new Date(),
    };

    const job = await this.policyQueue.add(
      PolicyJobType.EXPIRE_POLICY,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued policy expiration job ${job.id} for ${policyIds.length} policies`,
    );
    return job.id!;
  }

  /**
   * Queue policy lapsing (grace period exceeded)
   */
  async queuePolicyLapse(
    policyIds: string[],
    options?: { priority?: number },
  ): Promise<string> {
    const jobData: PolicyExpirationJobData = {
      type: PolicyJobType.LAPSE_POLICY,
      policyIds,
      createdAt: new Date(),
    };

    const job = await this.policyQueue.add(
      PolicyJobType.LAPSE_POLICY,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued policy lapse job ${job.id} for ${policyIds.length} policies`,
    );
    return job.id!;
  }

  // ============================================
  // Report Queue Methods
  // ============================================

  /**
   * Queue report generation
   */
  async queueReportGeneration(
    reportDefinitionId: string,
    startDate: Date,
    endDate: Date,
    options?: {
      userId?: string;
      organizationId?: string;
      parameters?: Record<string, unknown>;
      deliverTo?: string[];
      priority?: number;
    },
  ): Promise<string> {
    const jobData: ReportGenerationJobData = {
      type: ReportJobType.GENERATE_REPORT,
      reportDefinitionId,
      startDate,
      endDate,
      userId: options?.userId,
      organizationId: options?.organizationId,
      parameters: options?.parameters,
      deliverTo: options?.deliverTo,
      createdAt: new Date(),
    };

    const job = await this.reportQueue.add(
      ReportJobType.GENERATE_REPORT,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued report generation job ${job.id} for definition ${reportDefinitionId}`,
    );
    return job.id!;
  }

  /**
   * Queue report export
   */
  async queueReportExport(
    reportId: string,
    format: 'pdf' | 'excel' | 'csv',
    options?: {
      userId?: string;
      deliverTo?: string[];
      priority?: number;
    },
  ): Promise<string> {
    const jobData: ReportExportJobData = {
      type: ReportJobType.EXPORT_REPORT,
      reportId,
      format,
      userId: options?.userId,
      deliverTo: options?.deliverTo,
      createdAt: new Date(),
    };

    const job = await this.reportQueue.add(
      ReportJobType.EXPORT_REPORT,
      jobData,
      this.buildJobOptions({ priority: options?.priority }),
    );

    this.logger.debug(
      `Queued report export job ${job.id} for report ${reportId}`,
    );
    return job.id!;
  }

  // ============================================
  // Queue Management Methods
  // ============================================

  /**
   * Get queue status for all queues
   */
  async getQueueStatus(): Promise<{
    notification: Record<string, number>;
    policy: Record<string, number>;
    report: Record<string, number>;
  }> {
    const [notification, policy, report] = await Promise.all([
      this.notificationQueue.getJobCounts(),
      this.policyQueue.getJobCounts(),
      this.reportQueue.getJobCounts(),
    ]);

    return { notification, policy, report };
  }

  /**
   * Pause all queues
   */
  async pauseAllQueues(): Promise<void> {
    await Promise.all([
      this.notificationQueue.pause(),
      this.policyQueue.pause(),
      this.reportQueue.pause(),
    ]);
    this.logger.warn('All queues paused');
  }

  /**
   * Resume all queues
   */
  async resumeAllQueues(): Promise<void> {
    await Promise.all([
      this.notificationQueue.resume(),
      this.policyQueue.resume(),
      this.reportQueue.resume(),
    ]);
    this.logger.log('All queues resumed');
  }

  /**
   * Clean completed/failed jobs from queues
   */
  async cleanQueues(
    gracePeriod: number = 24 * 60 * 60 * 1000,
  ): Promise<{ cleaned: number }> {
    const results = await Promise.all([
      this.notificationQueue.clean(gracePeriod, 1000, 'completed'),
      this.notificationQueue.clean(gracePeriod * 7, 1000, 'failed'),
      this.policyQueue.clean(gracePeriod, 1000, 'completed'),
      this.policyQueue.clean(gracePeriod * 7, 1000, 'failed'),
      this.reportQueue.clean(gracePeriod, 1000, 'completed'),
      this.reportQueue.clean(gracePeriod * 7, 1000, 'failed'),
    ]);

    const cleaned = results.flat().length;
    this.logger.log(`Cleaned ${cleaned} jobs from queues`);

    return { cleaned };
  }

  /**
   * Build job options with defaults
   */
  private buildJobOptions(
    overrides?: Partial<JobsOptions>,
  ): JobsOptions {
    return {
      ...DEFAULT_JOB_OPTIONS,
      ...overrides,
    };
  }
}
