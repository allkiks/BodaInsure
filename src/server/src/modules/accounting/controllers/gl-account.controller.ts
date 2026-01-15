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
import { GlAccountService } from '../services/gl-account.service.js';
import { JournalEntryService } from '../services/journal-entry.service.js';
import { GlAccountType } from '../entities/gl-account.entity.js';
import { JournalEntryType } from '../entities/journal-entry.entity.js';
import { JournalEntry } from '../entities/journal-entry.entity.js';
import {
  GlAccountDto,
  TrialBalanceResponseDto,
  BalanceSummaryDto,
} from '../dto/index.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/constants/index.js';

/**
 * GL Account Controller
 * Provides API endpoints for Chart of Accounts and GL reporting
 *
 * Per Accounting_Remediation.md - Epic 1
 *
 * Security: Requires PLATFORM_ADMIN or INSURANCE_ADMIN role
 */
@ApiTags('Accounting')
@ApiBearerAuth()
@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
export class GlAccountController {
  constructor(
    private readonly glAccountService: GlAccountService,
    private readonly journalEntryService: JournalEntryService,
  ) {}

  // ===========================
  // GL Account Endpoints
  // ===========================

  @Get('gl-accounts')
  @ApiOperation({ summary: 'Get chart of accounts' })
  @ApiResponse({ status: 200, description: 'Chart of accounts', type: [GlAccountDto] })
  async getChartOfAccounts(): Promise<GlAccountDto[]> {
    const accounts = await this.glAccountService.getChartOfAccounts();
    return accounts.map((account) => ({
      ...account,
      balanceInKes: account.getBalanceInKes(),
    }));
  }

  @Get('gl-accounts/by-type/:type')
  @ApiOperation({ summary: 'Get GL accounts by type' })
  @ApiParam({ name: 'type', enum: GlAccountType })
  @ApiResponse({ status: 200, description: 'GL accounts', type: [GlAccountDto] })
  async getAccountsByType(
    @Param('type') type: GlAccountType,
  ): Promise<GlAccountDto[]> {
    const accounts = await this.glAccountService.getByType(type);
    return accounts.map((account) => ({
      ...account,
      balanceInKes: account.getBalanceInKes(),
    }));
  }

  @Get('gl-accounts/:code')
  @ApiOperation({ summary: 'Get GL account by code' })
  @ApiParam({ name: 'code', description: 'Account code (e.g., 1001)' })
  @ApiResponse({ status: 200, description: 'GL account', type: GlAccountDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountByCode(@Param('code') code: string): Promise<GlAccountDto> {
    const account = await this.glAccountService.getByCode(code);
    return {
      ...account,
      balanceInKes: account.getBalanceInKes(),
    };
  }

  // ===========================
  // Reporting Endpoints
  // ===========================

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance' })
  @ApiResponse({ status: 200, description: 'Trial balance', type: TrialBalanceResponseDto })
  async getTrialBalance(): Promise<TrialBalanceResponseDto> {
    return this.glAccountService.getTrialBalance();
  }

  @Get('balance-summary')
  @ApiOperation({ summary: 'Get balance summary by account type' })
  @ApiResponse({ status: 200, description: 'Balance summary', type: BalanceSummaryDto })
  async getBalanceSummary(): Promise<BalanceSummaryDto> {
    return this.glAccountService.getBalanceSummary();
  }

  // ===========================
  // Journal Entry Endpoints
  // ===========================

  @Get('journal-entries')
  @ApiOperation({ summary: 'Get journal entries by date range' })
  @ApiQuery({ name: 'startDate', type: Date })
  @ApiQuery({ name: 'endDate', type: Date })
  @ApiResponse({ status: 200, description: 'Journal entries', type: [JournalEntry] })
  async getJournalEntries(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<JournalEntry[]> {
    return this.journalEntryService.getByDateRange(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('journal-entries/by-type/:type')
  @ApiOperation({ summary: 'Get journal entries by type' })
  @ApiParam({ name: 'type', enum: JournalEntryType })
  @ApiResponse({ status: 200, description: 'Journal entries', type: [JournalEntry] })
  async getJournalEntriesByType(
    @Param('type') type: JournalEntryType,
  ): Promise<JournalEntry[]> {
    return this.journalEntryService.getByType(type);
  }

  @Get('journal-entries/by-rider/:riderId')
  @ApiOperation({ summary: 'Get journal entries by rider ID' })
  @ApiParam({ name: 'riderId', description: 'Rider (user) UUID' })
  @ApiResponse({ status: 200, description: 'Journal entries', type: [JournalEntry] })
  async getJournalEntriesByRider(
    @Param('riderId') riderId: string,
  ): Promise<JournalEntry[]> {
    return this.journalEntryService.getByRiderId(riderId);
  }

  @Get('journal-entries/:id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  @ApiParam({ name: 'id', description: 'Journal entry UUID' })
  @ApiResponse({ status: 200, description: 'Journal entry', type: JournalEntry })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async getJournalEntryById(@Param('id') id: string): Promise<JournalEntry> {
    return this.journalEntryService.getById(id);
  }

  @Get('journal-entries/by-number/:entryNumber')
  @ApiOperation({ summary: 'Get journal entry by entry number' })
  @ApiParam({ name: 'entryNumber', description: 'Entry number (e.g., JE-20240115-00001)' })
  @ApiResponse({ status: 200, description: 'Journal entry', type: JournalEntry })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async getJournalEntryByNumber(
    @Param('entryNumber') entryNumber: string,
  ): Promise<JournalEntry> {
    return this.journalEntryService.getByEntryNumber(entryNumber);
  }

  @Get('journal-entries/by-transaction/:transactionId')
  @ApiOperation({ summary: 'Get journal entries by source transaction ID' })
  @ApiParam({ name: 'transactionId', description: 'Source transaction UUID' })
  @ApiResponse({ status: 200, description: 'Journal entries', type: [JournalEntry] })
  async getJournalEntriesByTransaction(
    @Param('transactionId') transactionId: string,
  ): Promise<JournalEntry[]> {
    return this.journalEntryService.getBySourceTransactionId(transactionId);
  }
}
