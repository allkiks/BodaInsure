import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  QueueName,
  ReportJobType,
} from '../interfaces/job.interface.js';
import type {
  ReportQueueJobData,
  JobResult,
  ReportGenerationJobData,
  ReportExportJobData,
} from '../interfaces/job.interface.js';
import { ReportService } from '../../reporting/services/report.service.js';
import { ExportService } from '../../reporting/services/export.service.js';

/**
 * Report Queue Processor
 * Per GAP-020: Handles async report operations via BullMQ
 *
 * Processes:
 * - Report generation (async for large reports)
 * - Report export (PDF, Excel, CSV)
 * - Cleanup of expired reports
 */
@Processor(QueueName.REPORT, {
  concurrency: 2,
})
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
  ) {
    super();
  }

  async process(job: Job<ReportQueueJobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing report job ${job.id} (${job.data.type})`);

    try {
      let result: unknown;

      switch (job.data.type) {
        case ReportJobType.GENERATE_REPORT:
          result = await this.processGenerateReport(
            job.data as ReportGenerationJobData,
          );
          break;

        case ReportJobType.EXPORT_REPORT:
          result = await this.processExportReport(
            job.data as ReportExportJobData,
          );
          break;

        case ReportJobType.CLEANUP_EXPIRED:
          result = await this.processCleanupExpired();
          break;

        default:
          throw new Error(`Unknown report job type: ${(job.data as ReportQueueJobData).type}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Completed report job ${job.id} in ${duration}ms`);

      return {
        success: true,
        data: result,
        processedAt: new Date(),
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      this.logger.error(
        `Failed report job ${job.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
        processedAt: new Date(),
        duration,
      };
    }
  }

  private async processGenerateReport(
    data: ReportGenerationJobData,
  ): Promise<{ reportId: string }> {
    this.logger.log(
      `Generating report ${data.reportDefinitionId} for ${data.startDate} - ${data.endDate}`,
    );

    const report = await this.reportService.generateReport(
      {
        reportDefinitionId: data.reportDefinitionId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        organizationId: data.organizationId,
        parameters: data.parameters,
      },
      data.userId ?? 'system',
    );

    return { reportId: report.id };
  }

  private async processExportReport(
    data: ReportExportJobData,
  ): Promise<{ exportUrl: string }> {
    this.logger.log(`Exporting report ${data.reportId} to ${data.format}`);

    const report = await this.reportService.getReportById(data.reportId);

    if (!report) {
      throw new Error(`Report not found: ${data.reportId}`);
    }

    // Export to buffer
    const buffer = await this.exportService.exportToBuffer(
      report.data as { columns: string[]; rows: Record<string, unknown>[] },
      data.format,
      `report_${data.reportId}`,
    );

    // In production, this would upload to storage and return URL
    const exportUrl = `exports/${data.reportId}.${data.format}`;

    this.logger.log(`Exported report to ${exportUrl} (${buffer.length} bytes)`);

    return { exportUrl };
  }

  private async processCleanupExpired(): Promise<{ cleaned: number }> {
    this.logger.log('Cleaning up expired reports');

    const count = await this.reportService.cleanupExpiredReports();

    return { cleaned: count };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ReportQueueJobData>, result: JobResult): void {
    this.logger.debug(
      `Job ${job.id} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ReportQueueJobData>, error: Error): void {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }
}
