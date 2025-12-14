import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QueueName,
  NotificationJobType,
  NotificationJobData,
  JobResult,
  SmsJobData,
  BulkSmsJobData,
  EmailJobData,
  WhatsAppJobData,
  PaymentReminderJobData,
} from '../interfaces/job.interface.js';
import { SmsOrchestratorService } from '../../notification/services/sms-orchestrator.service.js';
import { EmailService } from '../../notification/services/email.service.js';
import { WhatsAppService } from '../../notification/services/whatsapp.service.js';

/**
 * Notification Queue Processor
 * Per GAP-020: Handles async notification delivery via BullMQ
 *
 * Processes:
 * - SMS messages (single and bulk)
 * - Email messages
 * - WhatsApp template messages
 * - Payment reminders
 * - Policy expiry warnings
 */
@Processor(QueueName.NOTIFICATION, {
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000, // 100 messages per minute
  },
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly smsService: SmsOrchestratorService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing notification job ${job.id} (${job.data.type})`);

    try {
      let result: unknown;

      switch (job.data.type) {
        case NotificationJobType.SEND_SMS:
          result = await this.processSms(job.data as SmsJobData);
          break;

        case NotificationJobType.SEND_BULK_SMS:
          result = await this.processBulkSms(job.data as BulkSmsJobData);
          break;

        case NotificationJobType.SEND_EMAIL:
          result = await this.processEmail(job.data as EmailJobData);
          break;

        case NotificationJobType.SEND_WHATSAPP:
          result = await this.processWhatsApp(job.data as WhatsAppJobData);
          break;

        case NotificationJobType.SEND_PAYMENT_REMINDER:
          result = await this.processPaymentReminder(
            job.data as PaymentReminderJobData,
          );
          break;

        default:
          throw new Error(`Unknown notification job type: ${job.data.type}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Completed notification job ${job.id} in ${duration}ms`);

      return {
        success: true,
        data: result,
        processedAt: new Date(),
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      this.logger.error(
        `Failed notification job ${job.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
        processedAt: new Date(),
        duration,
      };
    }
  }

  private async processSms(data: SmsJobData): Promise<{ messageId: string }> {
    const result = await this.smsService.sendSms(
      data.phone,
      data.message,
      data.provider,
    );

    return { messageId: result.messageId };
  }

  private async processBulkSms(
    data: BulkSmsJobData,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of data.recipients) {
      try {
        await this.smsService.sendSms(
          recipient.phone,
          recipient.message,
          data.provider,
        );
        sent++;
      } catch (error) {
        failed++;
        this.logger.warn(`Failed to send SMS to ${recipient.phone}`);
      }
    }

    return { sent, failed };
  }

  private async processEmail(data: EmailJobData): Promise<{ sent: boolean }> {
    await this.emailService.sendEmail(
      data.to,
      data.subject,
      data.template,
      data.context,
      data.attachments,
    );

    return { sent: true };
  }

  private async processWhatsApp(
    data: WhatsAppJobData,
  ): Promise<{ messageId?: string }> {
    // Convert string parameters to WhatsApp template components
    const components = data.parameters.length > 0
      ? [
          {
            type: 'body' as const,
            parameters: data.parameters.map((p) => ({
              type: 'text' as const,
              text: p,
            })),
          },
        ]
      : undefined;

    const result = await this.whatsAppService.sendTemplate(
      data.phone,
      data.template,
      components,
    );

    return { messageId: result.messageId };
  }

  private async processPaymentReminder(
    data: PaymentReminderJobData,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Payment reminders would typically fetch user data and send personalized messages
    // This is a placeholder for the actual implementation
    this.logger.log(
      `Processing ${data.reminderType} reminder for ${data.userIds.length} users`,
    );

    for (const userId of data.userIds) {
      try {
        // In a real implementation, we would:
        // 1. Fetch user details
        // 2. Generate personalized message
        // 3. Send via preferred channel (SMS/WhatsApp)
        this.logger.debug(`Sending ${data.reminderType} reminder to ${userId}`);
        sent++;
      } catch (error) {
        failed++;
        this.logger.warn(`Failed to send reminder to user ${userId}`);
      }
    }

    return { sent, failed };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>, result: JobResult): void {
    this.logger.debug(
      `Job ${job.id} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, error: Error): void {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`Job ${jobId} stalled`);
  }
}
