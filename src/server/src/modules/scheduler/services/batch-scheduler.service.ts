import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

/**
 * Batch schedule identifiers
 * Per module_architecture.md
 */
export enum BatchScheduleType {
  BATCH_1 = 'BATCH_1', // 08:00 EAT
  BATCH_2 = 'BATCH_2', // 14:00 EAT
  BATCH_3 = 'BATCH_3', // 20:00 EAT
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  batchType: BatchScheduleType;
  startedAt: Date;
  completedAt: Date;
  policiesProcessed: number;
  policiesSucceeded: number;
  policiesFailed: number;
  duration: number;
  errors?: string[];
}

/**
 * Batch Scheduler Service
 * Configures and runs scheduled batch jobs
 *
 * Per module_architecture.md:
 * - Batch 1: 08:00 EAT (05:00 UTC) for payments 00:00-07:59 EAT
 * - Batch 2: 14:00 EAT (11:00 UTC) for payments 08:00-13:59 EAT
 * - Batch 3: 20:00 EAT (17:00 UTC) for payments 14:00-19:59 EAT
 *
 * EAT (East Africa Time) is UTC+3
 */
@Injectable()
export class BatchSchedulerService {
  private readonly logger = new Logger(BatchSchedulerService.name);
  private readonly isEnabled: boolean;

  // Callbacks for batch processing (to be set by PolicyModule)
  private policyBatchHandler?: (schedule: BatchScheduleType) => Promise<BatchExecutionResult>;
  private paymentExpiryHandler?: () => Promise<number>;
  private gracePeriodCheckHandler?: () => Promise<number>;
  private reminderHandler?: () => Promise<number>;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>('SCHEDULER_ENABLED', true);
    if (!this.isEnabled) {
      this.logger.warn('Batch scheduler is DISABLED. Set SCHEDULER_ENABLED=true to enable.');
    }
  }

  /**
   * Register the policy batch processing handler
   * Called by PolicyModule during initialization
   */
  registerPolicyBatchHandler(
    handler: (schedule: BatchScheduleType) => Promise<BatchExecutionResult>,
  ): void {
    this.policyBatchHandler = handler;
    this.logger.log('Policy batch handler registered');
  }

  /**
   * Register the payment expiry handler
   */
  registerPaymentExpiryHandler(handler: () => Promise<number>): void {
    this.paymentExpiryHandler = handler;
    this.logger.log('Payment expiry handler registered');
  }

  /**
   * Register the grace period check handler
   */
  registerGracePeriodCheckHandler(handler: () => Promise<number>): void {
    this.gracePeriodCheckHandler = handler;
    this.logger.log('Grace period check handler registered');
  }

  /**
   * Register the reminder handler
   */
  registerReminderHandler(handler: () => Promise<number>): void {
    this.reminderHandler = handler;
    this.logger.log('Reminder handler registered');
  }

  /**
   * Batch 1: Policy batch processing at 08:00 EAT (05:00 UTC)
   * Per module_architecture.md
   */
  @Cron('0 5 * * *', { name: 'policy-batch-1', timeZone: 'UTC' })
  async handleBatch1(): Promise<void> {
    if (!this.isEnabled) return;

    this.logger.log('Starting Batch 1 (08:00 EAT) policy processing');
    await this.runPolicyBatch(BatchScheduleType.BATCH_1);
  }

  /**
   * Batch 2: Policy batch processing at 14:00 EAT (11:00 UTC)
   * Per module_architecture.md
   */
  @Cron('0 11 * * *', { name: 'policy-batch-2', timeZone: 'UTC' })
  async handleBatch2(): Promise<void> {
    if (!this.isEnabled) return;

    this.logger.log('Starting Batch 2 (14:00 EAT) policy processing');
    await this.runPolicyBatch(BatchScheduleType.BATCH_2);
  }

  /**
   * Batch 3: Policy batch processing at 20:00 EAT (17:00 UTC)
   * Per module_architecture.md
   */
  @Cron('0 17 * * *', { name: 'policy-batch-3', timeZone: 'UTC' })
  async handleBatch3(): Promise<void> {
    if (!this.isEnabled) return;

    this.logger.log('Starting Batch 3 (20:00 EAT) policy processing');
    await this.runPolicyBatch(BatchScheduleType.BATCH_3);
  }

  /**
   * Payment reminder job - runs every day at 09:00 EAT (06:00 UTC)
   * Per FEAT-PAY-005: Payment Reminders
   */
  @Cron('0 6 * * *', { name: 'payment-reminders', timeZone: 'UTC' })
  async handlePaymentReminders(): Promise<void> {
    if (!this.isEnabled) return;

    this.logger.log('Starting payment reminder job');
    try {
      if (this.reminderHandler) {
        const count = await this.reminderHandler();
        this.logger.log(`Payment reminders sent: ${count}`);
      } else {
        this.logger.warn('No reminder handler registered');
      }
    } catch (error) {
      this.logger.error(`Payment reminder job failed: ${error}`);
    }
  }

  /**
   * Grace period check - runs every hour
   * Per GAP-010: Grace period logic
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'grace-period-check' })
  async handleGracePeriodCheck(): Promise<void> {
    if (!this.isEnabled) return;

    this.logger.debug('Running grace period check');
    try {
      if (this.gracePeriodCheckHandler) {
        const count = await this.gracePeriodCheckHandler();
        if (count > 0) {
          this.logger.log(`Grace period check: ${count} wallets updated to lapsed`);
        }
      }
    } catch (error) {
      this.logger.error(`Grace period check failed: ${error}`);
    }
  }

  /**
   * Payment request expiry - runs every 5 minutes
   * Expires stale M-Pesa STK push requests
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'payment-expiry' })
  async handlePaymentExpiry(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      if (this.paymentExpiryHandler) {
        const count = await this.paymentExpiryHandler();
        if (count > 0) {
          this.logger.log(`Payment requests expired: ${count}`);
        }
      }
    } catch (error) {
      this.logger.error(`Payment expiry job failed: ${error}`);
    }
  }

  /**
   * Policy expiry notification - runs daily at 07:00 EAT (04:00 UTC)
   * Notify users whose policies expire in 7, 3, 1 days
   */
  @Cron('0 4 * * *', { name: 'policy-expiry-notification', timeZone: 'UTC' })
  async handlePolicyExpiryNotification(): Promise<void> {
    if (!this.isEnabled) return;

    this.logger.log('Starting policy expiry notification job');
    // TODO: Implement policy expiry notification logic
    // This would call the notification service to send reminders
  }

  /**
   * Execute policy batch processing
   */
  private async runPolicyBatch(schedule: BatchScheduleType): Promise<void> {
    try {
      if (!this.policyBatchHandler) {
        this.logger.warn('No policy batch handler registered');
        return;
      }

      const result = await this.policyBatchHandler(schedule);

      this.logger.log(
        `Batch ${schedule} completed: ` +
        `processed=${result.policiesProcessed} ` +
        `succeeded=${result.policiesSucceeded} ` +
        `failed=${result.policiesFailed} ` +
        `duration=${result.duration}ms`,
      );

      if (result.errors && result.errors.length > 0) {
        this.logger.warn(`Batch ${schedule} had ${result.errors.length} errors`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Batch ${schedule} failed: ${errorMessage}`);
    }
  }

  /**
   * Manually trigger a batch (for admin/testing)
   */
  async triggerBatch(schedule: BatchScheduleType): Promise<BatchExecutionResult | null> {
    this.logger.log(`Manual batch trigger: ${schedule}`);

    if (!this.policyBatchHandler) {
      this.logger.warn('No policy batch handler registered');
      return null;
    }

    return this.policyBatchHandler(schedule);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    handlers: {
      policyBatch: boolean;
      paymentExpiry: boolean;
      gracePeriodCheck: boolean;
      reminder: boolean;
    };
    nextBatchTimes: {
      batch1: string;
      batch2: string;
      batch3: string;
    };
  } {
    // Calculate next batch times in EAT
    const now = new Date();
    const todayBatch1 = new Date(now);
    todayBatch1.setUTCHours(5, 0, 0, 0);

    const todayBatch2 = new Date(now);
    todayBatch2.setUTCHours(11, 0, 0, 0);

    const todayBatch3 = new Date(now);
    todayBatch3.setUTCHours(17, 0, 0, 0);

    // If batch time has passed today, show tomorrow's time
    const nextBatch1 = now > todayBatch1
      ? new Date(todayBatch1.getTime() + 24 * 60 * 60 * 1000)
      : todayBatch1;

    const nextBatch2 = now > todayBatch2
      ? new Date(todayBatch2.getTime() + 24 * 60 * 60 * 1000)
      : todayBatch2;

    const nextBatch3 = now > todayBatch3
      ? new Date(todayBatch3.getTime() + 24 * 60 * 60 * 1000)
      : todayBatch3;

    return {
      enabled: this.isEnabled,
      handlers: {
        policyBatch: !!this.policyBatchHandler,
        paymentExpiry: !!this.paymentExpiryHandler,
        gracePeriodCheck: !!this.gracePeriodCheckHandler,
        reminder: !!this.reminderHandler,
      },
      nextBatchTimes: {
        batch1: `${nextBatch1.toISOString()} (08:00 EAT)`,
        batch2: `${nextBatch2.toISOString()} (14:00 EAT)`,
        batch3: `${nextBatch3.toISOString()} (20:00 EAT)`,
      },
    };
  }
}
