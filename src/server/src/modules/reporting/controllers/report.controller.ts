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
  UseGuards,
  ForbiddenException,
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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../identity/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../identity/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';

/**
 * Report Controller
 * Manages report definitions and generation
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * List report definitions
   */
  @Public()
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
  @Public()
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
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportService.createDefinition(dto, user.userId);
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
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.reportService.generateReport(dto, user.userId);
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
    @CurrentUser() user: JwtPayload,
    @Query() query: ReportQueryDto,
  ) {
    const { reports, total } = await this.reportService.listUserReports(user.userId, query);
    return {
      reports: reports.map((r) => ({
        id: r.id,
        name: r.name,
        definitionId: r.reportDefinitionId,
        format: r.format,
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
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
   * User can only access their own reports
   */
  @Get(':id')
  async getReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.reportService.getReportById(id);

    // Ownership check: ensure user can only access their own reports
    if (report.userId !== user.userId) {
      throw new ForbiddenException('You do not have access to this report');
    }

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
   * User can only access their own reports
   */
  @Get(':id/data')
  async getReportData(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.reportService.getReportById(id);

    // Ownership check: ensure user can only access their own reports
    if (report.userId !== user.userId) {
      throw new ForbiddenException('You do not have access to this report');
    }

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
   * User can only access their own reports
   */
  @Get(':id/download')
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: ReportFormat,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const report = await this.reportService.getReportById(id);

    // Ownership check: ensure user can only access their own reports
    if (report.userId !== user.userId) {
      res.status(403).json({
        error: 'You do not have access to this report',
      });
      return;
    }

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
   * TODO: Add admin role check in production
   */
  @Public()
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
   * TODO: Add admin role check in production
   */
  @Public()
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
