import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportService } from '../services/export.service.js';
import { PartnerType } from '../entities/partner-settlement.entity.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/constants/index.js';

/**
 * Export Controller
 *
 * Provides API endpoints for exporting accounting data to CSV and Excel.
 *
 * Security: Requires PLATFORM_ADMIN or INSURANCE_ADMIN role
 */
@ApiTags('Accounting - Export')
@ApiBearerAuth()
@Controller('accounting/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // ===========================
  // Chart of Accounts Exports
  // ===========================

  @Get('chart-of-accounts/csv')
  @ApiOperation({ summary: 'Export Chart of Accounts to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportChartOfAccountsCsv(@Res() res: Response) {
    const csv = await this.exportService.exportChartOfAccountsCsv();
    const filename = `chart-of-accounts-${this.getDateString()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('chart-of-accounts/excel')
  @ApiOperation({ summary: 'Export Chart of Accounts to Excel' })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportChartOfAccountsExcel(@Res() res: Response) {
    const buffer = await this.exportService.exportChartOfAccountsExcel();
    const filename = `chart-of-accounts-${this.getDateString()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ===========================
  // Trial Balance Exports
  // ===========================

  @Get('trial-balance/csv')
  @ApiOperation({ summary: 'Export Trial Balance to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportTrialBalanceCsv(@Res() res: Response) {
    const csv = await this.exportService.exportTrialBalanceCsv();
    const filename = `trial-balance-${this.getDateString()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('trial-balance/excel')
  @ApiOperation({ summary: 'Export Trial Balance to Excel' })
  @ApiQuery({ name: 'asOf', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportTrialBalanceExcel(
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    const asOfDate = asOf ? new Date(asOf) : undefined;
    const buffer = await this.exportService.exportTrialBalanceExcel(asOfDate);
    const filename = `trial-balance-${this.getDateString()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ===========================
  // Journal Entries Exports
  // ===========================

  @Get('journal-entries/csv')
  @ApiOperation({ summary: 'Export Journal Entries to CSV' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportJournalEntriesCsv(
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const csv = await this.exportService.exportJournalEntriesCsv(
      new Date(startDate),
      new Date(endDate),
    );
    const filename = `journal-entries-${startDate}-to-${endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('journal-entries/excel')
  @ApiOperation({ summary: 'Export Journal Entries to Excel' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportJournalEntriesExcel(
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const buffer = await this.exportService.exportJournalEntriesExcel(
      new Date(startDate),
      new Date(endDate),
    );
    const filename = `journal-entries-${startDate}-to-${endDate}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ===========================
  // Settlements Exports
  // ===========================

  @Get('settlements/csv')
  @ApiOperation({ summary: 'Export Settlements to CSV' })
  @ApiQuery({ name: 'partnerType', enum: PartnerType, required: false })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportSettlementsCsv(
    @Res() res: Response,
    @Query('partnerType') partnerType?: PartnerType,
  ) {
    const csv = await this.exportService.exportSettlementsCsv(partnerType);
    const filename = `settlements-${partnerType || 'all'}-${this.getDateString()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('settlements/excel')
  @ApiOperation({ summary: 'Export Settlements to Excel' })
  @ApiQuery({ name: 'partnerType', enum: PartnerType, required: false })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportSettlementsExcel(
    @Res() res: Response,
    @Query('partnerType') partnerType?: PartnerType,
  ) {
    const buffer = await this.exportService.exportSettlementsExcel(partnerType);
    const filename = `settlements-${partnerType || 'all'}-${this.getDateString()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ===========================
  // Balance Sheet Exports
  // ===========================

  @Get('balance-sheet/csv')
  @ApiOperation({ summary: 'Export Balance Sheet to CSV' })
  @ApiQuery({ name: 'asOf', type: String, required: false })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportBalanceSheetCsv(
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    const asOfDate = asOf ? new Date(asOf) : undefined;
    const csv = await this.exportService.exportBalanceSheetCsv(asOfDate);
    const filename = `balance-sheet-${this.getDateString()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('balance-sheet/excel')
  @ApiOperation({ summary: 'Export Balance Sheet to Excel' })
  @ApiQuery({ name: 'asOf', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportBalanceSheetExcel(
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    const asOfDate = asOf ? new Date(asOf) : undefined;
    const buffer = await this.exportService.exportBalanceSheetExcel(asOfDate);
    const filename = `balance-sheet-${this.getDateString()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ===========================
  // Income Statement Exports
  // ===========================

  @Get('income-statement/csv')
  @ApiOperation({ summary: 'Export Income Statement to CSV' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportIncomeStatementCsv(
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const csv = await this.exportService.exportIncomeStatementCsv(
      new Date(startDate),
      new Date(endDate),
    );
    const filename = `income-statement-${startDate}-to-${endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('income-statement/excel')
  @ApiOperation({ summary: 'Export Income Statement to Excel' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportIncomeStatementExcel(
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const buffer = await this.exportService.exportIncomeStatementExcel(
      new Date(startDate),
      new Date(endDate),
    );
    const filename = `income-statement-${startDate}-to-${endDate}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ===========================
  // Helpers
  // ===========================

  private getDateString(): string {
    return new Date().toISOString().split('T')[0] ?? new Date().toDateString();
  }
}
