import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Notification } from './entities/notification.entity.js';
import { NotificationTemplate } from './entities/notification-template.entity.js';
import { NotificationPreference } from './entities/notification-preference.entity.js';

// External entities for ReminderCoordinatorService
import { Wallet } from '../payment/entities/wallet.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { Policy } from '../policy/entities/policy.entity.js';

// Services
import { SmsService } from './services/sms.service.js';
import { SmsOrchestratorService } from './services/sms-orchestrator.service.js';
import { WhatsAppService } from './services/whatsapp.service.js';
import { EmailService } from './services/email.service.js';
import { NotificationService } from './services/notification.service.js';
import { ReminderService } from './services/reminder.service.js';
import { ReminderCoordinatorService } from './services/reminder-coordinator.service.js';

// Providers
import { AdvantasmsProvider } from './providers/advantasms.provider.js';
import { AfricasTalkingProvider } from './providers/africastalking.provider.js';

// External modules
import { SchedulerModule } from '../scheduler/scheduler.module.js';

// Controllers
import {
  NotificationController,
  NotificationWebhookController,
} from './controllers/notification.controller.js';

/**
 * Notification Module
 * Handles all outbound notifications via SMS and WhatsApp
 *
 * Per module_architecture.md:
 * - SMS gateway integration (Africa's Talking)
 * - WhatsApp Business API
 * - Payment reminders
 * - Policy delivery notifications
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Notification entities
      Notification,
      NotificationTemplate,
      NotificationPreference,
      // External entities for ReminderCoordinatorService
      Wallet,
      User,
      Policy,
    ]),
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    // Import SchedulerModule for BatchSchedulerService
    forwardRef(() => SchedulerModule),
  ],
  controllers: [
    NotificationController,
    NotificationWebhookController,
  ],
  providers: [
    // SMS Providers
    AdvantasmsProvider,
    AfricasTalkingProvider,
    // SMS Services
    SmsService,
    SmsOrchestratorService,
    // Other Services
    WhatsAppService,
    EmailService,
    NotificationService,
    ReminderService,
    // Coordinator for scheduler integration
    ReminderCoordinatorService,
  ],
  exports: [
    NotificationService,
    ReminderService,
    ReminderCoordinatorService,
    SmsService,
    SmsOrchestratorService,
    WhatsAppService,
    EmailService,
    // Export providers for direct use if needed
    AdvantasmsProvider,
    AfricasTalkingProvider,
  ],
})
export class NotificationModule {}
