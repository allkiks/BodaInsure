import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { Job } from './entities/job.entity.js';
import { JobHistory } from './entities/job-history.entity.js';

// Services
import { JobService } from './services/job.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { BatchSchedulerService } from './services/batch-scheduler.service.js';

// Controllers
import { SchedulerController } from './controllers/scheduler.controller.js';

/**
 * Scheduler Module
 * Manages cron jobs, batch processing, and scheduled tasks
 *
 * Per module_architecture.md batch processing schedule:
 * - Batch 1: 08:00 EAT (05:00 UTC) for payments 00:00-07:59
 * - Batch 2: 14:00 EAT (11:00 UTC) for payments 08:00-13:59
 * - Batch 3: 20:00 EAT (17:00 UTC) for payments 14:00-19:59
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Job, JobHistory]),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    SchedulerController,
  ],
  providers: [
    JobService,
    SchedulerService,
    BatchSchedulerService,
  ],
  exports: [
    JobService,
    SchedulerService,
    BatchSchedulerService,
  ],
})
export class SchedulerModule {}
