import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Queue definitions
import { QueueName } from './interfaces/job.interface.js';

// Processors
import { NotificationProcessor } from './processors/notification.processor.js';
import { PolicyProcessor } from './processors/policy.processor.js';
import { ReportProcessor } from './processors/report.processor.js';
import { DelayedPaymentProcessor, DELAYED_PAYMENT_QUEUE } from '../payment/processors/delayed-payment.processor.js';

// Services
import { QueueService } from './services/queue.service.js';

// External modules
import { NotificationModule } from '../notification/notification.module.js';
import { PolicyModule } from '../policy/policy.module.js';
import { ReportingModule } from '../reporting/reporting.module.js';
import { PaymentModule } from '../payment/payment.module.js';

/**
 * Queue Module
 * Per GAP-020: BullMQ job queuing for async task processing
 *
 * Queues:
 * - notification: SMS, Email, WhatsApp delivery
 * - policy: Certificate generation, batch processing
 * - report: Report generation and export
 *
 * Features:
 * - Redis-backed persistent job storage
 * - Automatic retries with exponential backoff
 * - Rate limiting for external API calls
 * - Job prioritization
 * - Dead letter queue for failed jobs
 */
@Module({
  imports: [
    ConfigModule,

    // BullMQ Root Configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
          db: configService.get<number>('redis.db', 0),
          maxRetriesPerRequest: null, // Required for BullMQ
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 60 * 60, // 24 hours
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 60 * 60, // 7 days
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Register individual queues
    BullModule.registerQueue(
      {
        name: QueueName.NOTIFICATION,
        defaultJobOptions: {
          attempts: 5, // More retries for notifications
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      },
      {
        name: QueueName.POLICY,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // Longer delay for policy operations
          },
        },
      },
      {
        name: QueueName.REPORT,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
        },
      },
      // Delayed payment queue - Per M-Pesa Payment Flow Improvements Phase 4
      {
        name: DELAYED_PAYMENT_QUEUE,
        defaultJobOptions: {
          attempts: 5, // More retries for payment resolution
          backoff: {
            type: 'exponential',
            delay: 30000, // Start with 30s, then 60s, 120s, 240s, 480s
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for debugging
        },
      },
    ),

    // External module dependencies
    forwardRef(() => NotificationModule),
    forwardRef(() => PolicyModule),
    forwardRef(() => ReportingModule),
    forwardRef(() => PaymentModule), // For delayed payment processing
  ],
  providers: [
    // Queue processors
    NotificationProcessor,
    PolicyProcessor,
    ReportProcessor,
    DelayedPaymentProcessor, // Delayed payment processor

    // Queue service
    QueueService,
  ],
  exports: [
    BullModule,
    QueueService,
  ],
})
export class QueueModule {}
