import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentService } from '../services/payment.service.js';

/**
 * Queue name for delayed payment processing
 */
export const DELAYED_PAYMENT_QUEUE = 'delayed-payments';

/**
 * Job data for delayed payment processing
 */
export interface DelayedPaymentJob {
  paymentRequestId: string;
  userId: string;
  attemptCount: number;
  maxAttempts: number;
  initialDelaySeconds: number;
}

/**
 * Delayed Payment Processor
 *
 * Per M-Pesa Payment Flow Improvements - Phase 4
 *
 * Processes payments that exceeded the frontend polling timeout.
 * Uses exponential backoff to query M-Pesa and resolve payment status.
 */
@Injectable()
@Processor(DELAYED_PAYMENT_QUEUE)
export class DelayedPaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(DelayedPaymentProcessor.name);

  constructor(private readonly paymentService: PaymentService) {
    super();
  }

  /**
   * Process a delayed payment job
   *
   * Queries M-Pesa for the payment status and:
   * - If completed: marks as resolved, notifies user
   * - If failed: marks as resolved, notifies user
   * - If still pending: retries with backoff until max attempts
   */
  async process(job: Job<DelayedPaymentJob>): Promise<{ resolved: boolean; status: string }> {
    const { paymentRequestId, userId, attemptCount, maxAttempts } = job.data;

    this.logger.log({
      event: 'delayed_payment_processing',
      paymentRequestId: paymentRequestId.slice(0, 8) + '...',
      attemptCount,
      maxAttempts,
      jobId: job.id,
    });

    try {
      // Query M-Pesa for current status
      const result = await this.paymentService.refreshPaymentStatus(
        paymentRequestId,
        userId
      );

      if (result.status === 'COMPLETED') {
        this.logger.log({
          event: 'delayed_payment_resolved',
          paymentRequestId: paymentRequestId.slice(0, 8) + '...',
          status: 'COMPLETED',
          mpesaReceipt: result.mpesaReceiptNumber,
        });

        // Notify user of successful payment
        await this.notifyUserPaymentComplete(userId, paymentRequestId, result.mpesaReceiptNumber);

        return { resolved: true, status: 'COMPLETED' };
      }

      if (result.status === 'FAILED' || result.status === 'CANCELLED' || result.status === 'TIMEOUT') {
        this.logger.log({
          event: 'delayed_payment_resolved',
          paymentRequestId: paymentRequestId.slice(0, 8) + '...',
          status: result.status,
          message: result.message,
        });

        // Notify user of failed payment
        await this.notifyUserPaymentFailed(userId, paymentRequestId, result.message);

        return { resolved: true, status: result.status };
      }

      // Still pending - check if we should retry
      if (attemptCount >= maxAttempts) {
        this.logger.warn({
          event: 'delayed_payment_unresolved',
          paymentRequestId: paymentRequestId.slice(0, 8) + '...',
          attemptCount,
          maxAttempts,
        });

        // Notify user that manual intervention may be needed
        await this.notifyUserPaymentUnresolved(userId, paymentRequestId);

        return { resolved: false, status: 'UNRESOLVED' };
      }

      // Throw error to trigger retry with backoff
      throw new Error(`Payment still pending after attempt ${attemptCount}`);

    } catch (error) {
      this.logger.error({
        event: 'delayed_payment_error',
        paymentRequestId: paymentRequestId.slice(0, 8) + '...',
        attemptCount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error; // Will trigger BullMQ retry
    }
  }

  /**
   * Handle job completion
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<DelayedPaymentJob>): void {
    this.logger.debug({
      event: 'delayed_payment_job_completed',
      jobId: job.id,
      paymentRequestId: job.data.paymentRequestId.slice(0, 8) + '...',
    });
  }

  /**
   * Handle job failure
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<DelayedPaymentJob> | undefined, error: Error): void {
    this.logger.error({
      event: 'delayed_payment_job_failed',
      jobId: job?.id,
      paymentRequestId: job?.data.paymentRequestId.slice(0, 8) + '...',
      error: error.message,
    });
  }

  /**
   * Notify user of successful payment completion
   *
   * TODO: Integrate with NotificationService for SMS/Push notifications
   */
  private async notifyUserPaymentComplete(
    userId: string,
    paymentRequestId: string,
    mpesaReceipt?: string
  ): Promise<void> {
    this.logger.log({
      event: 'user_notification_payment_complete',
      userId: userId.slice(0, 8) + '...',
      paymentRequestId: paymentRequestId.slice(0, 8) + '...',
      mpesaReceipt,
    });

    // TODO: Send SMS notification
    // await this.notificationService.sendSms(userId, 'PAYMENT_COMPLETE', { mpesaReceipt });

    // TODO: Send push notification if user has app installed
    // await this.notificationService.sendPush(userId, 'Payment Successful', `Receipt: ${mpesaReceipt}`);
  }

  /**
   * Notify user of failed payment
   *
   * TODO: Integrate with NotificationService for SMS/Push notifications
   */
  private async notifyUserPaymentFailed(
    userId: string,
    paymentRequestId: string,
    reason: string
  ): Promise<void> {
    this.logger.log({
      event: 'user_notification_payment_failed',
      userId: userId.slice(0, 8) + '...',
      paymentRequestId: paymentRequestId.slice(0, 8) + '...',
      reason,
    });

    // TODO: Send SMS notification
    // await this.notificationService.sendSms(userId, 'PAYMENT_FAILED', { reason });
  }

  /**
   * Notify user that payment status could not be determined
   *
   * TODO: Integrate with NotificationService for SMS/Push notifications
   */
  private async notifyUserPaymentUnresolved(
    userId: string,
    paymentRequestId: string
  ): Promise<void> {
    this.logger.warn({
      event: 'user_notification_payment_unresolved',
      userId: userId.slice(0, 8) + '...',
      paymentRequestId: paymentRequestId.slice(0, 8) + '...',
    });

    // TODO: Send SMS notification advising to contact support
    // await this.notificationService.sendSms(userId, 'PAYMENT_NEEDS_REVIEW', {});

    // TODO: Create support ticket
    // await this.supportService.createTicket(userId, paymentRequestId, 'PAYMENT_STATUS_UNCERTAIN');
  }
}
