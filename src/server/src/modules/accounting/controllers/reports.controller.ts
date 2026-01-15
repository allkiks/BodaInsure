import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/constants/index.js';
import { FinancialReportingService } from '../services/financial-reporting.service.js';
import { PartnerType } from '../entities/partner-settlement.entity.js';

/**
 * Reports Controller
 *
 * Provides API endpoints for financial reports.
 *
 * Per Accounting_Remediation.md - Epic 9 & Epic 10
 *
 * Security: Requires PLATFORM_ADMIN or INSURANCE_ADMIN role
 */
@ApiTags('Accounting - Reports')
@ApiBearerAuth()
@Controller('accounting/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
export class ReportsController {
  constructor(
    private readonly reportingService: FinancialReportingService,
  ) {}

  // ===========================
  // Dashboard Endpoints
  // ===========================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary data' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  async getDashboardSummary() {
    const summary = await this.reportingService.getDashboardSummary();
    return {
      ...summary,
      // Convert to KES for display
      totalAssetsKes: summary.totalAssets / 100,
      totalLiabilitiesKes: summary.totalLiabilities / 100,
      netIncomeKes: summary.netIncome / 100,
      cashBalanceKes: summary.cashBalance / 100,
      premiumPayableKes: summary.premiumPayable / 100,
      serviceFeesPayableKes: summary.serviceFeesPayable / 100,
    };
  }

  // ===========================
  // Financial Statement Endpoints
  // ===========================

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Generate balance sheet report' })
  @ApiQuery({ name: 'asOf', type: String, required: false, description: 'Date (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Balance sheet report' })
  async getBalanceSheet(
    @Query('asOf') asOf?: string,
  ) {
    const date = asOf ? new Date(asOf) : new Date();
    const report = await this.reportingService.generateBalanceSheet(date);

    return {
      ...report,
      // Add KES conversions
      assets: {
        ...report.assets,
        totalKes: report.assets.total / 100,
        accounts: report.assets.accounts.map((a) => ({
          ...a,
          balanceKes: a.balance / 100,
        })),
      },
      liabilities: {
        ...report.liabilities,
        totalKes: report.liabilities.total / 100,
        accounts: report.liabilities.accounts.map((a) => ({
          ...a,
          balanceKes: a.balance / 100,
        })),
      },
      equity: {
        ...report.equity,
        totalKes: report.equity.total / 100,
        retainedEarningsKes: report.equity.retainedEarnings / 100,
        accounts: report.equity.accounts.map((a) => ({
          ...a,
          balanceKes: a.balance / 100,
        })),
      },
      totalLiabilitiesAndEquityKes: report.totalLiabilitiesAndEquity / 100,
    };
  }

  @Get('income-statement')
  @ApiOperation({ summary: 'Generate income statement report' })
  @ApiQuery({ name: 'periodStart', type: String })
  @ApiQuery({ name: 'periodEnd', type: String })
  @ApiResponse({ status: 200, description: 'Income statement report' })
  async getIncomeStatement(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const report = await this.reportingService.generateIncomeStatement(
      new Date(periodStart),
      new Date(periodEnd),
    );

    return {
      ...report,
      // Add KES conversions
      income: {
        ...report.income,
        totalKes: report.income.total / 100,
        accounts: report.income.accounts.map((a) => ({
          ...a,
          balanceKes: a.balance / 100,
        })),
      },
      expenses: {
        ...report.expenses,
        totalKes: report.expenses.total / 100,
        accounts: report.expenses.accounts.map((a) => ({
          ...a,
          balanceKes: a.balance / 100,
        })),
      },
      netIncomeKes: report.netIncome / 100,
    };
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Generate trial balance report' })
  @ApiQuery({ name: 'asOf', type: String, required: false, description: 'Date (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Trial balance report' })
  async getTrialBalance(
    @Query('asOf') asOf?: string,
  ) {
    const date = asOf ? new Date(asOf) : new Date();
    const report = await this.reportingService.generateTrialBalance(date);

    return {
      ...report,
      // Add KES conversions
      totalDebitsKes: report.totalDebits / 100,
      totalCreditsKes: report.totalCredits / 100,
      accounts: report.accounts.map((a) => ({
        ...a,
        debitBalanceKes: a.debitBalance / 100,
        creditBalanceKes: a.creditBalance / 100,
      })),
    };
  }

  // ===========================
  // Partner Statement Endpoints
  // ===========================

  @Get('partner-statement/:partnerType')
  @ApiOperation({ summary: 'Generate partner statement report' })
  @ApiParam({ name: 'partnerType', enum: PartnerType })
  @ApiQuery({ name: 'periodStart', type: String })
  @ApiQuery({ name: 'periodEnd', type: String })
  @ApiResponse({ status: 200, description: 'Partner statement report' })
  async getPartnerStatement(
    @Param('partnerType') partnerType: PartnerType,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const report = await this.reportingService.generatePartnerStatement(
      partnerType,
      new Date(periodStart),
      new Date(periodEnd),
    );

    return {
      ...report,
      // Add KES conversions
      openingBalanceKes: report.openingBalance / 100,
      closingBalanceKes: report.closingBalance / 100,
      transactions: report.transactions.map((t) => ({
        ...t,
        debitKes: t.debit / 100,
        creditKes: t.credit / 100,
        balanceKes: t.balance / 100,
      })),
      summary: {
        ...report.summary,
        totalDebitsKes: report.summary.totalDebits / 100,
        totalCreditsKes: report.summary.totalCredits / 100,
        settledAmountKes: report.summary.settledAmount / 100,
        pendingAmountKes: report.summary.pendingAmount / 100,
      },
    };
  }

  // ===========================
  // Account Activity Endpoints
  // ===========================

  @Get('account-activity/:accountCode')
  @ApiOperation({ summary: 'Get account activity for a period' })
  @ApiParam({ name: 'accountCode', description: 'GL account code (e.g., 1001)' })
  @ApiQuery({ name: 'periodStart', type: String })
  @ApiQuery({ name: 'periodEnd', type: String })
  @ApiResponse({ status: 200, description: 'Account activity report' })
  async getAccountActivity(
    @Param('accountCode') accountCode: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const report = await this.reportingService.getAccountActivity(
      accountCode,
      new Date(periodStart),
      new Date(periodEnd),
    );

    return {
      ...report,
      // Add KES conversions
      openingBalanceKes: report.openingBalance / 100,
      closingBalanceKes: report.closingBalance / 100,
      transactions: report.transactions.map((t) => ({
        ...t,
        debitKes: t.debit / 100,
        creditKes: t.credit / 100,
        balanceKes: t.balance / 100,
      })),
    };
  }
}
