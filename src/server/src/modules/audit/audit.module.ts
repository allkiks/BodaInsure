import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity.js';
import { BreachIncident } from './entities/breach-incident.entity.js';
import { AuditService } from './services/audit.service.js';
import { BreachNotificationService } from './services/breach-notification.service.js';
import { AuditController } from './controllers/audit.controller.js';
import { BreachController } from './controllers/breach.controller.js';
import { NotificationModule } from '../notification/notification.module.js';

/**
 * Audit Module
 * Immutable event logging for compliance
 *
 * CR-DPA-003: Breach notification workflow
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditEvent, BreachIncident]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [AuditController, BreachController],
  providers: [AuditService, BreachNotificationService],
  exports: [AuditService, BreachNotificationService],
})
export class AuditModule {}
