import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  ReportDefinition,
  ReportFrequency,
} from '../entities/report-definition.entity.js';
import { ReportService } from './report.service.js';
import { EmailService } from '../../notification/services/email.service.js';
import { ExportService } from './export.service.js';

/**
 * Scheduled report recipient
 */
export interface ScheduledReportRecipient {
  email: string;
  name?: string;
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReportConfig {
  reportDefinitionId: string;
  frequency: ReportFrequency;
  recipients: ScheduledReportRecipient[];
  organizationId?: string;
  parameters?: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

/**
 * Scheduled Report Service
 * Per GAP-014: Automated scheduled report generation and delivery
 *
 * Supports:
 * - Daily reports at 06:00 EAT (03:00 UTC)
 * - Weekly reports on Monday at 07:00 EAT (04:00 UTC)
 * - Monthly reports on 1st at 08:00 EAT (05:00 UTC)
 * - Email delivery with PDF/Excel attachments
 */
@Injectable()
export class ScheduledReportService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledReportService.name);
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(ReportDefinition)
    private readonly definitionRepository: Repository<ReportDefinition>,
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('SCHEDULED_REPORTS_ENABLED', true);

    if (!this.enabled) {
      this.logger.warn('Scheduled reports are DISABLED. Set SCHEDULED_REPORTS_ENABLED=true to enable.');
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.enabled) {
      this.logger.log('Scheduled report service initialized');
    }
  }

  /**
   * Run daily scheduled reports at 06:00 EAT (03:00 UTC)
   */
  @Cron('0 3 * * *', { name: 'daily-scheduled-reports', timeZone: 'UTC' })
  async runDailyReports(): Promise<void> {
    if (!this.enabled) return;

    this.logger.log('Running daily scheduled reports');

    await this.runScheduledReports(ReportFrequency.DAILY);
  }

  /**
   * Run weekly scheduled reports on Monday at 07:00 EAT (04:00 UTC)
   */
  @Cron('0 4 * * 1', { name: 'weekly-scheduled-reports', timeZone: 'UTC' })
  async runWeeklyReports(): Promise<void> {
    if (!this.enabled) return;

    this.logger.log('Running weekly scheduled reports');

    await this.runScheduledReports(ReportFrequency.WEEKLY);
  }

  /**
   * Run monthly scheduled reports on 1st at 08:00 EAT (05:00 UTC)
   */
  @Cron('0 5 1 * *', { name: 'monthly-scheduled-reports', timeZone: 'UTC' })
  async runMonthlyReports(): Promise<void> {
    if (!this.enabled) return;

    this.logger.log('Running monthly scheduled reports');

    await this.runScheduledReports(ReportFrequency.MONTHLY);
  }

  /**
   * Cleanup expired reports daily at midnight UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'cleanup-expired-reports' })
  async cleanupExpiredReports(): Promise<void> {
    if (!this.enabled) return;

    this.logger.log('Cleaning up expired reports');

    try {
      const count = await this.reportService.cleanupExpiredReports();
      this.logger.log(`Cleaned up ${count} expired reports`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup expired reports: ${errorMessage}`);
    }
  }

  /**
   * Run scheduled reports for a given frequency
   */
  private async runScheduledReports(frequency: ReportFrequency): Promise<void> {
    try {
      // Find all report definitions with this frequency
      const definitions = await this.definitionRepository.find({
        where: {
          frequency,
          isActive: true,
        },
      });

      this.logger.log(`Found ${definitions.length} ${frequency} reports to generate`);

      for (const definition of definitions) {
        try {
          await this.generateAndDeliverReport(definition, frequency);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to generate ${frequency} report "${definition.name}": ${errorMessage}`,
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to run ${frequency} scheduled reports: ${errorMessage}`);
    }
  }

  /**
   * Generate and deliver a scheduled report
   */
  private async generateAndDeliverReport(
    definition: ReportDefinition,
    frequency: ReportFrequency,
  ): Promise<void> {
    const startTime = Date.now();

    // Calculate date range based on frequency
    const { startDate, endDate } = this.calculateDateRange(frequency);

    this.logger.log(
      `Generating ${frequency} report: ${definition.name} (${startDate.toISOString()} - ${endDate.toISOString()})`,
    );

    // Generate the report
    const report = await this.reportService.generateReport(
      {
        reportDefinitionId: definition.id,
        startDate,
        endDate,
        organizationId: definition.organizationId ?? undefined,
        parameters: definition.config?.parameters,
      },
      'system', // System user for scheduled reports
    );

    // Wait for report to complete (with timeout)
    const completedReport = await this.waitForReportCompletion(report.id, 60000);

    if (!completedReport || completedReport.status !== 'COMPLETED') {
      this.logger.warn(
        `Scheduled report "${definition.name}" did not complete in time`,
      );
      return;
    }

    // Get recipients from config
    const recipients = definition.config?.recipients as ScheduledReportRecipient[] | undefined;

    if (!recipients || recipients.length === 0) {
      this.logger.warn(
        `No recipients configured for scheduled report "${definition.name}"`,
      );
      return;
    }

    // Export report to file
    const reportBuffer = await this.exportService.exportToBuffer(
      completedReport.data as { columns: string[]; rows: Record<string, unknown>[] },
      definition.defaultFormat,
      definition.name,
    );

    // Send email to recipients
    const reportDate = new Date();
    const filename = `${definition.name.replace(/\s+/g, '_')}_${reportDate.toISOString().split('T')[0]}.${this.getFileExtension(definition.defaultFormat)}`;

    for (const recipient of recipients) {
      try {
        await this.emailService.sendOrganizationReport(
          recipient.email,
          {
            organizationName: definition.organizationId
              ? 'Organization Report'
              : 'BodaInsure Platform Report',
            reportType: definition.name,
            reportDate,
          },
          reportBuffer,
          filename,
        );

        this.logger.log(
          `Sent ${frequency} report "${definition.name}" to ${recipient.email}`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to send report to ${recipient.email}: ${errorMessage}`,
        );
      }
    }

    // Update last run timestamp
    definition.lastScheduledRun = new Date();
    await this.definitionRepository.save(definition);

    const duration = Date.now() - startTime;
    this.logger.log(
      `Completed ${frequency} report "${definition.name}" in ${duration}ms`,
    );
  }

  /**
   * Calculate date range based on frequency
   */
  private calculateDateRange(frequency: ReportFrequency): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);

    switch (frequency) {
      case ReportFrequency.DAILY:
        // Previous day
        startDate.setDate(startDate.getDate() - 1);
        break;

      case ReportFrequency.WEEKLY:
        // Previous 7 days
        startDate.setDate(startDate.getDate() - 7);
        break;

      case ReportFrequency.MONTHLY:
        // Previous month
        startDate.setMonth(startDate.getMonth() - 1);
        break;

      case ReportFrequency.QUARTERLY:
        // Previous 3 months
        startDate.setMonth(startDate.getMonth() - 3);
        break;

      default:
        // Default to last 24 hours
        startDate.setDate(startDate.getDate() - 1);
    }

    return { startDate, endDate };
  }

  /**
   * Wait for report to complete with timeout
   */
  private async waitForReportCompletion(
    reportId: string,
    timeoutMs: number,
  ): Promise<{ status: string; data?: unknown } | null> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < timeoutMs) {
      const report = await this.reportService.getReportById(reportId);

      if (report.status === 'COMPLETED' || report.status === 'FAILED') {
        return report;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return null;
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: string): string {
    switch (format.toUpperCase()) {
      case 'EXCEL':
        return 'xlsx';
      case 'CSV':
        return 'csv';
      case 'PDF':
        return 'pdf';
      default:
        return 'json';
    }
  }

  /**
   * Manually trigger a scheduled report
   */
  async triggerReport(
    definitionId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      recipientEmails?: string[];
    },
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      const definition = await this.definitionRepository.findOne({
        where: { id: definitionId },
      });

      if (!definition) {
        return { success: false, error: 'Report definition not found' };
      }

      const report = await this.reportService.generateReport(
        {
          reportDefinitionId: definitionId,
          startDate: options?.startDate,
          endDate: options?.endDate,
          organizationId: definition.organizationId ?? undefined,
        },
        'system',
      );

      return { success: true, reportId: report.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get scheduled report status
   */
  async getScheduleStatus(): Promise<{
    enabled: boolean;
    dailyReportsCount: number;
    weeklyReportsCount: number;
    monthlyReportsCount: number;
    nextDailyRun: string;
    nextWeeklyRun: string;
    nextMonthlyRun: string;
  }> {
    const [daily, weekly, monthly] = await Promise.all([
      this.definitionRepository.count({
        where: { frequency: ReportFrequency.DAILY, isActive: true },
      }),
      this.definitionRepository.count({
        where: { frequency: ReportFrequency.WEEKLY, isActive: true },
      }),
      this.definitionRepository.count({
        where: { frequency: ReportFrequency.MONTHLY, isActive: true },
      }),
    ]);

    // Calculate next run times
    const now = new Date();

    const nextDaily = new Date(now);
    nextDaily.setUTCHours(3, 0, 0, 0);
    if (nextDaily <= now) nextDaily.setDate(nextDaily.getDate() + 1);

    const nextWeekly = new Date(now);
    nextWeekly.setUTCHours(4, 0, 0, 0);
    while (nextWeekly.getDay() !== 1 || nextWeekly <= now) {
      nextWeekly.setDate(nextWeekly.getDate() + 1);
    }

    const nextMonthly = new Date(now);
    nextMonthly.setUTCHours(5, 0, 0, 0);
    nextMonthly.setDate(1);
    if (nextMonthly <= now) nextMonthly.setMonth(nextMonthly.getMonth() + 1);

    return {
      enabled: this.enabled,
      dailyReportsCount: daily,
      weeklyReportsCount: weekly,
      monthlyReportsCount: monthly,
      nextDailyRun: `${nextDaily.toISOString()} (06:00 EAT)`,
      nextWeeklyRun: `${nextWeekly.toISOString()} (07:00 EAT Monday)`,
      nextMonthlyRun: `${nextMonthly.toISOString()} (08:00 EAT 1st)`,
    };
  }
}
