import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
import { ReconciliationService, StatementItem } from '../services/reconciliation.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/constants/index.js';

/**
 * DTO for creating M-Pesa reconciliation
 */
class CreateMpesaReconciliationDto {
  reconciliationDate!: string;
  statementItems!: StatementItem[];
  createdBy?: string;
}

/**
 * DTO for creating bank reconciliation
 */
class CreateBankReconciliationDto {
  reconciliationDate!: string;
  sourceName!: string;
  statementItems!: StatementItem[];
  createdBy?: string;
}

/**
 * DTO for manual matching
 */
class ManualMatchDto {
  ledgerTransactionId!: string;
  resolvedBy!: string;
  notes?: string;
}

/**
 * DTO for resolving items
 */
class ResolveItemDto {
  resolvedBy!: string;
  notes!: string;
}

/**
 * Reconciliation Controller
 *
 * Provides API endpoints for reconciliation management.
 *
 * Per Accounting_Remediation.md - Epic 8 & Epic 10
 *
 * Security: Requires PLATFORM_ADMIN or INSURANCE_ADMIN role
 */
@ApiTags('Accounting - Reconciliation')
@ApiBearerAuth()
@Controller('accounting/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
  ) {}

  // ===========================
  // Reconciliation Record Endpoints
  // ===========================

  @Get()
  @ApiOperation({ summary: 'Get reconciliation records by date range' })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  @ApiResponse({ status: 200, description: 'List of reconciliation records' })
  async getReconciliations(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reconciliationService.getByDateRange(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get reconciliation summary statistics' })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  @ApiResponse({ status: 200, description: 'Reconciliation summary' })
  async getSummaryStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reconciliationService.getSummaryStats(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reconciliation record by ID' })
  @ApiParam({ name: 'id', description: 'Reconciliation record UUID' })
  @ApiResponse({ status: 200, description: 'Reconciliation record with items' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async getReconciliationById(@Param('id') id: string) {
    return this.reconciliationService.getById(id);
  }

  @Get(':id/unmatched')
  @ApiOperation({ summary: 'Get unmatched items for a reconciliation' })
  @ApiParam({ name: 'id', description: 'Reconciliation record UUID' })
  @ApiResponse({ status: 200, description: 'Unmatched items' })
  async getUnmatchedItems(@Param('id') id: string) {
    return this.reconciliationService.getUnmatchedItems(id);
  }

  // ===========================
  // Create Reconciliation Endpoints
  // ===========================

  @Post('mpesa')
  @ApiOperation({ summary: 'Create M-Pesa statement reconciliation' })
  @ApiResponse({ status: 201, description: 'Reconciliation created' })
  async createMpesaReconciliation(
    @Body() dto: CreateMpesaReconciliationDto,
  ) {
    // Convert statement items dates
    const statementItems = dto.statementItems.map((item) => ({
      ...item,
      date: new Date(item.date),
    }));

    return this.reconciliationService.createMpesaReconciliation(
      new Date(dto.reconciliationDate),
      statementItems,
      dto.createdBy,
    );
  }

  @Post('bank')
  @ApiOperation({ summary: 'Create bank statement reconciliation' })
  @ApiResponse({ status: 201, description: 'Reconciliation created' })
  async createBankReconciliation(
    @Body() dto: CreateBankReconciliationDto,
  ) {
    // Convert statement items dates
    const statementItems = dto.statementItems.map((item) => ({
      ...item,
      date: new Date(item.date),
    }));

    return this.reconciliationService.createBankReconciliation(
      new Date(dto.reconciliationDate),
      statementItems,
      dto.sourceName,
      dto.createdBy,
    );
  }

  // ===========================
  // Item Resolution Endpoints
  // ===========================

  @Post('items/:itemId/match')
  @ApiOperation({ summary: 'Manually match a reconciliation item' })
  @ApiParam({ name: 'itemId', description: 'Reconciliation item UUID' })
  @ApiResponse({ status: 200, description: 'Item matched' })
  @ApiResponse({ status: 404, description: 'Item or transaction not found' })
  async manualMatch(
    @Param('itemId') itemId: string,
    @Body() dto: ManualMatchDto,
  ) {
    return this.reconciliationService.manualMatch(
      itemId,
      dto.ledgerTransactionId,
      dto.resolvedBy,
      dto.notes,
    );
  }

  @Post('items/:itemId/resolve')
  @ApiOperation({ summary: 'Resolve an unmatched reconciliation item' })
  @ApiParam({ name: 'itemId', description: 'Reconciliation item UUID' })
  @ApiResponse({ status: 200, description: 'Item resolved' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async resolveItem(
    @Param('itemId') itemId: string,
    @Body() dto: ResolveItemDto,
  ) {
    return this.reconciliationService.resolveItem(
      itemId,
      dto.resolvedBy,
      dto.notes,
    );
  }
}
