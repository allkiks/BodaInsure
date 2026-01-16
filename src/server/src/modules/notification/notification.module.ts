import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Notification } from './entities/notification.entity.js';
import { NotificationTemplate } from './entities/notification-template.entity.js';
import { NotificationPreference } from './entities/notification-preference.entity.js';
import { SmsDeliveryReport } from './entities/sms-delivery-report.entity.js';
import { EmailDeliveryReport } from './entities/email-delivery-report.entity.js';

// External entities for ReminderCoordinatorService
import { Wallet } from '../payment/entities/wallet.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { Policy } from '../policy/entities/policy.entity.js';

// Services
import { SmsService } from './services/sms.service.js';
import { SmsOrchestratorService } from './services/sms-orchestrator.service.js';
import { SmsDeliveryReportService } from './services/sms-delivery-report.service.js';
import { EmailDeliveryReportService } from './services/email-delivery-report.service.js';
import { WhatsAppService } from './services/whatsapp.service.js';
import { EmailService } from './services/email.service.js';
import { NotificationService } from './services/notification.service.js';
import { ReminderService } from './services/reminder.service.js';
import { ReminderCoordinatorService } from './services/reminder-coordinator.service.js';
import { TemplateService } from './services/template.service.js';

// Providers
import { AdvantasmsProvider } from './providers/advantasms.provider.js';
import { AfricasTalkingProvider } from './providers/africastalking.provider.js';

// External modules
import { SchedulerModule } from '../scheduler/scheduler.module.js';
import { AuditModule } from '../audit/audit.module.js';

// Controllers
import {
  NotificationController,
  NotificationWebhookController,
} from './controllers/notification.controller.js';
import { TemplateController } from './controllers/template.controller.js';

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
      SmsDeliveryReport,
      EmailDeliveryReport,
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
    // Import AuditModule for audit logging
    forwardRef(() => AuditModule),
  ],
  controllers: [
    NotificationController,
    NotificationWebhookController,
    TemplateController,
  ],
  providers: [
    // SMS Providers
    AdvantasmsProvider,
    AfricasTalkingProvider,
    // SMS Services
    SmsService,
    SmsOrchestratorService,
    SmsDeliveryReportService,
    // Email Services
    EmailDeliveryReportService,
    // Other Services
    WhatsAppService,
    EmailService,
    NotificationService,
    ReminderService,
    TemplateService,
    // Coordinator for scheduler integration
    ReminderCoordinatorService,
  ],
  exports: [
    NotificationService,
    ReminderService,
    ReminderCoordinatorService,
    SmsService,
    SmsOrchestratorService,
    SmsDeliveryReportService,
    EmailDeliveryReportService,
    WhatsAppService,
    EmailService,
    TemplateService,
    // Export providers for direct use if needed
    AdvantasmsProvider,
    AfricasTalkingProvider,
  ],
})
export class NotificationModule {}
