import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity.js';
import { AuditService } from './services/audit.service.js';
import { AuditController } from './controllers/audit.controller.js';

/**
 * Audit Module
 * Immutable event logging for compliance
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
