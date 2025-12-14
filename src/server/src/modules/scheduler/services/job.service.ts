import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan } from 'typeorm';
import { Job, JobType, JobStatus } from '../entities/job.entity.js';
import { JobHistory } from '../entities/job-history.entity.js';

/**
 * Create job request
 */
export interface CreateJobRequest {
  name: string;
  type: JobType;
  cronExpression?: string;
  isRecurring?: boolean;
  config?: Record<string, unknown>;
  scheduledAt?: Date;
  maxRetries?: number;
  createdBy?: string;
}

/**
 * Job execution result
 */
export interface JobExecutionResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details?: Record<string, unknown>;
}

/**
 * Job Service
 * Manages scheduled jobs and their execution
 */
@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(JobHistory)
    private readonly historyRepository: Repository<JobHistory>,
  ) {}

  /**
   * Create a new job
   */
  async create(request: CreateJobRequest): Promise<Job> {
    const job = this.jobRepository.create({
      ...request,
      scheduledAt: request.scheduledAt ?? new Date(),
      isRecurring: request.isRecurring ?? !!request.cronExpression,
      status: JobStatus.SCHEDULED,
    });

    // Calculate next run for recurring jobs
    if (job.isRecurring && job.cronExpression) {
      job.nextRunAt = this.calculateNextRun(job.cronExpression);
    }

    await this.jobRepository.save(job);

    this.logger.log(`Created job: ${job.name} (${job.type})`);

    return job;
  }

  /**
   * Get job by ID
   */
  async getById(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });

    if (!job) {
      throw new NotFoundException(`Job not found: ${id}`);
    }

    return job;
  }

  /**
   * List jobs
   */
  async list(options?: {
    type?: JobType;
    status?: JobStatus;
    isRecurring?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    const { type, status, isRecurring, page = 1, limit = 20 } = options ?? {};

    const query = this.jobRepository.createQueryBuilder('j');

    if (type) {
      query.andWhere('j.type = :type', { type });
    }

    if (status) {
      query.andWhere('j.status = :status', { status });
    }

    if (isRecurring !== undefined) {
      query.andWhere('j.is_recurring = :isRecurring', { isRecurring });
    }

    const [jobs, total] = await query
      .orderBy('j.scheduled_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { jobs, total };
  }

  /**
   * Get pending jobs ready for execution
   */
  async getPendingJobs(): Promise<Job[]> {
    return this.jobRepository.find({
      where: {
        status: JobStatus.SCHEDULED,
        isEnabled: true,
        scheduledAt: LessThanOrEqual(new Date()),
      },
      order: { scheduledAt: 'ASC' },
      take: 100,
    });
  }

  /**
   * Get recurring jobs due for next run
   */
  async getDueRecurringJobs(): Promise<Job[]> {
    return this.jobRepository.find({
      where: {
        isRecurring: true,
        isEnabled: true,
        status: JobStatus.COMPLETED,
        nextRunAt: LessThanOrEqual(new Date()),
      },
      take: 100,
    });
  }

  /**
   * Start job execution
   */
  async startExecution(jobId: string, triggeredBy: string = 'system'): Promise<JobHistory> {
    const job = await this.getById(jobId);

    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();
    await this.jobRepository.save(job);

    // Create history record
    const history = this.historyRepository.create({
      jobId: job.id,
      jobName: job.name,
      status: JobStatus.RUNNING,
      startedAt: new Date(),
      triggeredBy,
    });

    await this.historyRepository.save(history);

    this.logger.log(`Started job: ${job.name} (${job.id})`);

    return history;
  }

  /**
   * Complete job execution
   */
  async completeExecution(
    jobId: string,
    historyId: string,
    result: JobExecutionResult,
  ): Promise<void> {
    const job = await this.getById(jobId);
    const endTime = new Date();
    const durationMs = job.startedAt
      ? endTime.getTime() - job.startedAt.getTime()
      : 0;

    // Update job
    job.status = JobStatus.COMPLETED;
    job.completedAt = endTime;
    job.durationMs = durationMs;
    job.result = result;
    job.errorMessage = undefined;
    job.errorStack = undefined;

    // Update next run for recurring jobs
    if (job.isRecurring && job.cronExpression) {
      job.nextRunAt = this.calculateNextRun(job.cronExpression);
      job.status = JobStatus.SCHEDULED;
      job.scheduledAt = job.nextRunAt;
    }

    await this.jobRepository.save(job);

    // Update history
    const history = await this.historyRepository.findOne({ where: { id: historyId } });
    if (history) {
      history.status = JobStatus.COMPLETED;
      history.endedAt = endTime;
      history.durationMs = durationMs;
      history.result = result;
      await this.historyRepository.save(history);
    }

    this.logger.log(
      `Completed job: ${job.name} - Processed: ${result.processed}, ` +
      `Succeeded: ${result.succeeded}, Failed: ${result.failed}`,
    );
  }

  /**
   * Fail job execution
   */
  async failExecution(
    jobId: string,
    historyId: string,
    error: Error,
  ): Promise<void> {
    const job = await this.getById(jobId);
    const endTime = new Date();
    const durationMs = job.startedAt
      ? endTime.getTime() - job.startedAt.getTime()
      : 0;

    job.status = JobStatus.FAILED;
    job.completedAt = endTime;
    job.durationMs = durationMs;
    job.errorMessage = error.message;
    job.errorStack = error.stack;
    job.retryCount = (job.retryCount || 0) + 1;
    job.lastRetryAt = endTime;

    // Check if should retry
    if (job.retryCount < job.maxRetries) {
      job.status = JobStatus.SCHEDULED;
      job.scheduledAt = new Date(Date.now() + this.getRetryDelay(job.retryCount));
    }

    await this.jobRepository.save(job);

    // Update history
    const history = await this.historyRepository.findOne({ where: { id: historyId } });
    if (history) {
      history.status = JobStatus.FAILED;
      history.endedAt = endTime;
      history.durationMs = durationMs;
      history.errorMessage = error.message;
      await this.historyRepository.save(history);
    }

    this.logger.error(`Failed job: ${job.name} - ${error.message}`);
  }

  /**
   * Cancel job
   */
  async cancel(jobId: string): Promise<Job> {
    const job = await this.getById(jobId);

    if (job.status === JobStatus.RUNNING) {
      throw new Error('Cannot cancel a running job');
    }

    job.status = JobStatus.CANCELLED;
    await this.jobRepository.save(job);

    this.logger.log(`Cancelled job: ${job.name}`);

    return job;
  }

  /**
   * Pause job
   */
  async pause(jobId: string): Promise<Job> {
    const job = await this.getById(jobId);

    job.isEnabled = false;
    job.status = JobStatus.PAUSED;
    await this.jobRepository.save(job);

    this.logger.log(`Paused job: ${job.name}`);

    return job;
  }

  /**
   * Resume job
   */
  async resume(jobId: string): Promise<Job> {
    const job = await this.getById(jobId);

    job.isEnabled = true;
    job.status = JobStatus.SCHEDULED;

    if (job.isRecurring && job.cronExpression) {
      job.scheduledAt = this.calculateNextRun(job.cronExpression);
      job.nextRunAt = job.scheduledAt;
    }

    await this.jobRepository.save(job);

    this.logger.log(`Resumed job: ${job.name}`);

    return job;
  }

  /**
   * Get job history
   */
  async getHistory(
    jobId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ history: JobHistory[]; total: number }> {
    const { page = 1, limit = 20 } = options ?? {};

    const [history, total] = await this.historyRepository.findAndCount({
      where: { jobId },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { history, total };
  }

  /**
   * Get recent job history
   */
  async getRecentHistory(hours: number = 24): Promise<JobHistory[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.historyRepository.find({
      where: {
        startedAt: MoreThan(since),
      },
      order: { startedAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<{
    totalJobs: number;
    activeJobs: number;
    recurringJobs: number;
    recentExecutions: number;
    failedLast24h: number;
    averageDurationMs: number;
  }> {
    const [jobs, recent] = await Promise.all([
      this.jobRepository.find(),
      this.getRecentHistory(24),
    ]);

    const activeJobs = jobs.filter(
      (j) => j.status === JobStatus.SCHEDULED || j.status === JobStatus.RUNNING,
    ).length;
    const recurringJobs = jobs.filter((j) => j.isRecurring).length;
    const failedRecent = recent.filter((h) => h.status === JobStatus.FAILED).length;
    const completedRecent = recent.filter((h) => h.status === JobStatus.COMPLETED);
    const avgDuration =
      completedRecent.length > 0
        ? completedRecent.reduce((sum, h) => sum + (h.durationMs ?? 0), 0) /
          completedRecent.length
        : 0;

    return {
      totalJobs: jobs.length,
      activeJobs,
      recurringJobs,
      recentExecutions: recent.length,
      failedLast24h: failedRecent,
      averageDurationMs: Math.round(avgDuration),
    };
  }

  /**
   * Calculate next run time from cron expression
   * Simplified implementation - in production use a cron parser library
   */
  private calculateNextRun(cronExpression: string): Date {
    const now = new Date();
    const next = new Date(now);

    // Simple parsing for common patterns
    // Format: minute hour dayOfMonth month dayOfWeek
    const parts = cronExpression.split(' ');
    const minutePart = parts[0] ?? '*';
    const hourPart = parts[1] ?? '*';

    if (parts.length >= 2) {
      const minute = minutePart === '*' ? now.getMinutes() : parseInt(minutePart, 10);
      const hour = hourPart === '*' ? now.getHours() : parseInt(hourPart, 10);

      next.setMinutes(minute);
      next.setSeconds(0);
      next.setMilliseconds(0);

      if (hourPart !== '*') {
        next.setHours(hour);
      }

      // If time has passed today, move to next day
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else {
      // Default: next hour
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
      next.setSeconds(0);
    }

    return next;
  }

  /**
   * Get retry delay based on retry count (exponential backoff)
   */
  private getRetryDelay(retryCount: number): number {
    const baseDelay = 60000; // 1 minute
    return Math.min(baseDelay * Math.pow(2, retryCount), 3600000); // Max 1 hour
  }

  /**
   * Seed default recurring jobs
   */
  async seedDefaultJobs(): Promise<number> {
    const defaults: CreateJobRequest[] = [
      {
        name: 'Policy Batch Processing (6AM)',
        type: JobType.POLICY_BATCH,
        cronExpression: '0 6 * * *',
        isRecurring: true,
        config: { batchTime: '06:00' },
      },
      {
        name: 'Policy Batch Processing (12PM)',
        type: JobType.POLICY_BATCH,
        cronExpression: '0 12 * * *',
        isRecurring: true,
        config: { batchTime: '12:00' },
      },
      {
        name: 'Policy Batch Processing (6PM)',
        type: JobType.POLICY_BATCH,
        cronExpression: '0 18 * * *',
        isRecurring: true,
        config: { batchTime: '18:00' },
      },
      {
        name: 'Daily Payment Reminders',
        type: JobType.PAYMENT_REMINDER,
        cronExpression: '0 8 * * *',
        isRecurring: true,
        config: { reminderType: 'daily' },
      },
      {
        name: 'Policy Expiry Reminders',
        type: JobType.POLICY_EXPIRY_REMINDER,
        cronExpression: '0 9 * * *',
        isRecurring: true,
        config: { daysBeforeExpiry: [7, 3, 1] },
      },
      {
        name: 'Policy Lapse Check',
        type: JobType.LAPSE_CHECK,
        cronExpression: '0 0 * * *',
        isRecurring: true,
      },
      {
        name: 'Notification Retry',
        type: JobType.NOTIFICATION_RETRY,
        cronExpression: '*/30 * * * *',
        isRecurring: true,
        config: { maxAge: 24 },
      },
      {
        name: 'Report Cleanup',
        type: JobType.REPORT_CLEANUP,
        cronExpression: '0 2 * * *',
        isRecurring: true,
      },
    ];

    let created = 0;

    for (const def of defaults) {
      const existing = await this.jobRepository.findOne({
        where: { name: def.name },
      });

      if (!existing) {
        await this.create(def);
        created++;
      }
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} default jobs`);
    }

    return created;
  }
}
