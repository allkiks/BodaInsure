import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JobService } from '../services/job.service.js';
import { SchedulerService } from '../services/scheduler.service.js';
import { JobType, JobStatus } from '../entities/job.entity.js';

/**
 * Create job DTO
 */
class CreateJobDto {
  name!: string;
  type!: JobType;
  cronExpression?: string;
  isRecurring?: boolean;
  config?: Record<string, unknown>;
  scheduledAt?: Date;
  maxRetries?: number;
}

/**
 * Scheduler Controller
 * Manages scheduled jobs
 */
@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly jobService: JobService,
    private readonly schedulerService: SchedulerService,
  ) {}

  /**
   * Get scheduler status
   */
  @Get('status')
  getStatus() {
    return this.schedulerService.getStatus();
  }

  /**
   * Get job statistics
   */
  @Get('stats')
  async getStats() {
    return this.jobService.getStats();
  }

  /**
   * List jobs
   */
  @Get('jobs')
  async listJobs(
    @Query('type') type?: JobType,
    @Query('status') status?: JobStatus,
    @Query('isRecurring') isRecurring?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { jobs, total } = await this.jobService.list({
      type,
      status,
      isRecurring: isRecurring === 'true' ? true : isRecurring === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        type: j.type,
        status: j.status,
        isRecurring: j.isRecurring,
        cronExpression: j.cronExpression,
        scheduledAt: j.scheduledAt,
        nextRunAt: j.nextRunAt,
        lastRunAt: j.completedAt,
        isEnabled: j.isEnabled,
      })),
      total,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
  }

  /**
   * Get job by ID
   */
  @Get('jobs/:id')
  async getJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.jobService.getById(id);
    return {
      id: job.id,
      name: job.name,
      type: job.type,
      status: job.status,
      isRecurring: job.isRecurring,
      cronExpression: job.cronExpression,
      config: job.config,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      nextRunAt: job.nextRunAt,
      durationMs: job.durationMs,
      result: job.result,
      errorMessage: job.errorMessage,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      isEnabled: job.isEnabled,
      createdAt: job.createdAt,
    };
  }

  /**
   * Create a new job
   */
  @Post('jobs')
  async createJob(
    @Body() dto: CreateJobDto,
    @Body('userId') userId?: string,
  ) {
    const job = await this.jobService.create({
      ...dto,
      createdBy: userId,
    });

    return {
      id: job.id,
      name: job.name,
      type: job.type,
      status: job.status,
      scheduledAt: job.scheduledAt,
    };
  }

  /**
   * Trigger job immediately
   */
  @Post('jobs/:id/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('userId') userId: string = 'system',
  ) {
    try {
      const result = await this.schedulerService.triggerNow(id, userId);
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pause job
   */
  @Put('jobs/:id/pause')
  async pauseJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.jobService.pause(id);
    return {
      id: job.id,
      status: job.status,
      isEnabled: job.isEnabled,
    };
  }

  /**
   * Resume job
   */
  @Put('jobs/:id/resume')
  async resumeJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.jobService.resume(id);
    return {
      id: job.id,
      status: job.status,
      isEnabled: job.isEnabled,
      scheduledAt: job.scheduledAt,
    };
  }

  /**
   * Cancel job
   */
  @Put('jobs/:id/cancel')
  async cancelJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.jobService.cancel(id);
    return {
      id: job.id,
      status: job.status,
    };
  }

  /**
   * Get job history
   */
  @Get('jobs/:id/history')
  async getJobHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { history, total } = await this.jobService.getHistory(id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      history: history.map((h) => ({
        id: h.id,
        status: h.status,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
        durationMs: h.durationMs,
        result: h.result,
        errorMessage: h.errorMessage,
        triggeredBy: h.triggeredBy,
      })),
      total,
    };
  }

  /**
   * Get recent execution history
   */
  @Get('history')
  async getRecentHistory(@Query('hours') hours?: string) {
    const history = await this.jobService.getRecentHistory(
      hours ? parseInt(hours, 10) : 24,
    );

    return history.map((h) => ({
      id: h.id,
      jobId: h.jobId,
      jobName: h.jobName,
      status: h.status,
      startedAt: h.startedAt,
      endedAt: h.endedAt,
      durationMs: h.durationMs,
      triggeredBy: h.triggeredBy,
    }));
  }

  /**
   * Seed default jobs
   */
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seedJobs() {
    const created = await this.jobService.seedDefaultJobs();
    return {
      message: created > 0 ? `Seeded ${created} jobs` : 'Default jobs already exist',
      created,
    };
  }

  /**
   * Start scheduler
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  startScheduler() {
    this.schedulerService.start();
    return { status: 'started' };
  }

  /**
   * Stop scheduler
   */
  @Post('stop')
  @HttpCode(HttpStatus.OK)
  stopScheduler() {
    this.schedulerService.stop();
    return { status: 'stopped' };
  }
}
