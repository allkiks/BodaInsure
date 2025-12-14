import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobService, JobExecutionResult } from './job.service.js';
import { JobType } from '../entities/job.entity.js';

/**
 * Job handler function type
 */
export type JobHandler = (config?: Record<string, unknown>) => Promise<JobExecutionResult>;

/**
 * Scheduler Service
 * Runs scheduled jobs and manages job execution
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly handlers: Map<JobType, JobHandler> = new Map();
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private readonly jobService: JobService) {}

  async onModuleInit() {
    // Register default handlers
    this.registerDefaultHandlers();

    // Start scheduler if enabled
    if (process.env.SCHEDULER_ENABLED !== 'false') {
      this.start();
    }
  }

  /**
   * Register a job handler
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.logger.log(`Registered handler for job type: ${type}`);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;

    // Check for jobs every minute
    const intervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
    this.checkInterval = setInterval(() => {
      this.checkAndRunJobs().catch((error) => {
        this.logger.error(`Error checking jobs: ${error.message}`);
      });
    }, intervalMs);

    this.logger.log(`Scheduler started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    this.logger.log('Scheduler stopped');
  }

  /**
   * Check and run pending jobs
   */
  async checkAndRunJobs(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get pending one-time jobs
      const pendingJobs = await this.jobService.getPendingJobs();

      // Get recurring jobs due for next run
      const recurringJobs = await this.jobService.getDueRecurringJobs();

      const allJobs = [...pendingJobs, ...recurringJobs];

      for (const job of allJobs) {
        // Run each job in parallel (limited concurrency in production)
        this.runJob(job.id).catch((error) => {
          this.logger.error(`Error running job ${job.name}: ${error.message}`);
        });
      }
    } catch (error) {
      this.logger.error(`Error in checkAndRunJobs: ${error}`);
    }
  }

  /**
   * Run a specific job
   */
  async runJob(jobId: string, triggeredBy: string = 'system'): Promise<JobExecutionResult> {
    const job = await this.jobService.getById(jobId);
    const handler = this.handlers.get(job.type);

    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }

    const history = await this.jobService.startExecution(jobId, triggeredBy);

    try {
      const result = await handler(job.config);
      await this.jobService.completeExecution(jobId, history.id, result);
      return result;
    } catch (error) {
      await this.jobService.failExecution(
        jobId,
        history.id,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Trigger a job immediately
   */
  async triggerNow(jobId: string, userId: string): Promise<JobExecutionResult> {
    return this.runJob(jobId, userId);
  }

  /**
   * Register default job handlers
   */
  private registerDefaultHandlers(): void {
    // Policy batch processing
    this.registerHandler(JobType.POLICY_BATCH, async (_config) => {
      // This would call the PolicyBatchService
      this.logger.log('Running policy batch processing');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Policy batch handler placeholder' },
      };
    });

    // Payment reminders
    this.registerHandler(JobType.PAYMENT_REMINDER, async (_config) => {
      // This would call the ReminderService
      this.logger.log('Running payment reminders');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Payment reminder handler placeholder' },
      };
    });

    // Policy expiry reminders
    this.registerHandler(JobType.POLICY_EXPIRY_REMINDER, async (_config) => {
      // This would call the ReminderService
      this.logger.log('Running policy expiry reminders');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Policy expiry reminder handler placeholder' },
      };
    });

    // Lapse check
    this.registerHandler(JobType.LAPSE_CHECK, async () => {
      // This would call the PolicyService
      this.logger.log('Running lapse check');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Lapse check handler placeholder' },
      };
    });

    // Report cleanup
    this.registerHandler(JobType.REPORT_CLEANUP, async () => {
      // This would call the ReportService
      this.logger.log('Running report cleanup');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Report cleanup handler placeholder' },
      };
    });

    // Notification retry
    this.registerHandler(JobType.NOTIFICATION_RETRY, async () => {
      // This would call the NotificationService
      this.logger.log('Running notification retry');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Notification retry handler placeholder' },
      };
    });

    // Data sync
    this.registerHandler(JobType.DATA_SYNC, async (_config) => {
      this.logger.log('Running data sync');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Data sync handler placeholder' },
      };
    });

    // Wallet reconciliation
    this.registerHandler(JobType.WALLET_RECONCILIATION, async () => {
      this.logger.log('Running wallet reconciliation');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Wallet reconciliation handler placeholder' },
      };
    });

    // Report generation
    this.registerHandler(JobType.REPORT_GENERATION, async (_config) => {
      this.logger.log('Running report generation');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Report generation handler placeholder' },
      };
    });

    // Custom handler (no-op by default)
    this.registerHandler(JobType.CUSTOM, async (config) => {
      this.logger.log(`Running custom job with config: ${JSON.stringify(config)}`);
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: { message: 'Custom job executed' },
      };
    });
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    registeredHandlers: JobType[];
  } {
    return {
      isRunning: this.isRunning,
      registeredHandlers: Array.from(this.handlers.keys()),
    };
  }
}
