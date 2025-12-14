import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportService } from '../services/report.service.js';
import { ExportService } from '../services/export.service.js';
import {
  CreateReportDefinitionDto,
  UpdateReportDefinitionDto,
  GenerateReportDto,
  ReportQueryDto,
} from '../dto/report.dto.js';
import { ReportType, ReportFormat } from '../entities/report-definition.entity.js';
import { ReportStatus } from '../entities/generated-report.entity.js';

/**
 * Report Controller
 * Manages report definitions and generation
 */
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * List report definitions
   */
  @Get('definitions')
  async listDefinitions(
    @Query('type') type?: ReportType,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.reportService.listDefinitions({ type, organizationId });
  }

  /**
   * Get report definition by ID
   */
  @Get('definitions/:id')
  async getDefinition(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportService.getDefinitionById(id);
  }

  /**
   * Create report definition
   */
  @Post('definitions')
  async createDefinition(
    @Body() dto: CreateReportDefinitionDto,
    @Body('userId') userId: string, // Would come from auth in production
  ) {
    return this.reportService.createDefinition(dto, userId);
  }

  /**
   * Update report definition
   */
  @Put('definitions/:id')
  async updateDefinition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDefinitionDto,
  ) {
    return this.reportService.updateDefinition(id, dto);
  }

  /**
   * Delete report definition
   */
  @Delete('definitions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDefinition(@Param('id', ParseUUIDPipe) id: string) {
    await this.reportService.deleteDefinition(id);
  }

  /**
   * Generate a report
   */
  @Post('generate')
  async generateReport(
    @Body() dto: GenerateReportDto,
    @Body('userId') userId: string, // Would come from auth in production
  ) {
    const report = await this.reportService.generateReport(dto, userId);
    return {
      id: report.id,
      name: report.name,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  /**
   * List user's generated reports
   */
  @Get()
  async listReports(
    @Query('userId') userId: string, // Would come from auth in production
    @Query() query: ReportQueryDto,
  ) {
    const { reports, total } = await this.reportService.listUserReports(userId, query);
    return {
      reports: reports.map((r) => ({
        id: r.id,
        name: r.name,
        format: r.format,
        status: r.status,
        recordCount: r.recordCount,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      totalPages: Math.ceil(total / (query.limit ?? 20)),
    };
  }

  /**
   * Get generated report by ID
   */
  @Get(':id')
  async getReport(@Param('id', ParseUUIDPipe) id: string) {
    const report = await this.reportService.getReportById(id);
    return {
      id: report.id,
      name: report.name,
      format: report.format,
      status: report.status,
      parameters: report.parameters,
      startDate: report.startDate,
      endDate: report.endDate,
      recordCount: report.recordCount,
      processingTimeMs: report.processingTimeMs,
      errorMessage: report.errorMessage,
      createdAt: report.createdAt,
      completedAt: report.completedAt,
      expiresAt: report.expiresAt,
    };
  }

  /**
   * Get report data (JSON format)
   */
  @Get(':id/data')
  async getReportData(@Param('id', ParseUUIDPipe) id: string) {
    const report = await this.reportService.getReportById(id);

    if (report.status !== ReportStatus.COMPLETED) {
      return {
        status: report.status,
        message: report.status === ReportStatus.PROCESSING
          ? 'Report is still processing'
          : 'Report generation failed',
        error: report.errorMessage,
      };
    }

    return report.data;
  }

  /**
   * Download report as file
   */
  @Get(':id/download')
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: ReportFormat,
    @Res() res: Response,
  ) {
    const report = await this.reportService.getReportById(id);

    if (report.status !== ReportStatus.COMPLETED) {
      res.status(400).json({
        error: 'Report is not ready for download',
        status: report.status,
      });
      return;
    }

    const data = report.data as { rows?: Record<string, unknown>[] };
    const rows = data?.rows ?? [];
    const exportFormat = format ?? report.format;

    const result = await this.exportService.export(rows, {
      filename: `${report.name.toLowerCase().replace(/\s+/g, '-')}-${report.id.slice(0, 8)}`,
      format: exportFormat,
      title: report.name,
      includeTimestamp: true,
    });

    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.size,
    });

    res.send(result.data);
  }

  /**
   * Seed default report definitions (admin only)
   */
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seedDefaults() {
    const created = await this.reportService.seedDefaultDefinitions();
    return {
      message: created > 0 ? `Seeded ${created} report definitions` : 'Defaults already exist',
      created,
    };
  }

  /**
   * Cleanup expired reports (admin/scheduler)
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanup() {
    const expired = await this.reportService.cleanupExpiredReports();
    return {
      message: `Expired ${expired} reports`,
      expired,
    };
  }
}
