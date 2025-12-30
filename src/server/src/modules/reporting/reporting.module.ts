import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { ReportDefinition } from './entities/report-definition.entity.js';
import { GeneratedReport } from './entities/generated-report.entity.js';

// Services
import { DashboardService } from './services/dashboard.service.js';
import { ReportService } from './services/report.service.js';
import { ExportService } from './services/export.service.js';
import { ScheduledReportService } from './services/scheduled-report.service.js';
import { CashFlowReportService } from './services/cash-flow-report.service.js';

// Controllers
import { DashboardController } from './controllers/dashboard.controller.js';
import { ReportController } from './controllers/report.controller.js';

// External modules
import { NotificationModule } from '../notification/notification.module.js';

/**
 * Reporting Module
 * Manages dashboards, reports, and data exports
 *
 * Per GAP-014: Includes scheduled report generation and delivery
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ReportDefinition, GeneratedReport]),
    ConfigModule,
    NotificationModule,
  ],
  controllers: [
    DashboardController,
    ReportController,
  ],
  providers: [
    DashboardService,
    ReportService,
    ExportService,
    ScheduledReportService,
    CashFlowReportService,
  ],
  exports: [
    DashboardService,
    ReportService,
    ExportService,
    ScheduledReportService,
    CashFlowReportService,
  ],
})
export class ReportingModule {}
