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
import { SettlementService } from '../services/settlement.service.js';
import { CommissionCalculatorService } from '../services/commission-calculator.service.js';
import { PartnerType, SettlementStatus } from '../entities/partner-settlement.entity.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/constants/index.js';

/**
 * DTO for creating service fee settlement
 */
class CreateServiceFeeSettlementDto {
  partnerType!: 'KBA' | 'ROBS_INSURANCE';
  periodStart!: string;
  periodEnd!: string;
  createdBy?: string;
}

/**
 * DTO for creating commission settlement
 */
class CreateCommissionSettlementDto {
  partnerType!: PartnerType;
  periodStart!: string;
  periodEnd!: string;
  commissionAmount!: number;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

/**
 * DTO for processing settlement
 */
class ProcessSettlementDto {
  bankReference!: string;
  bankAccount?: string;
}

/**
 * Settlement Controller
 *
 * Provides API endpoints for partner settlement management.
 *
 * Per Accounting_Remediation.md - Epic 6 & Epic 10
 *
 * Security: Requires PLATFORM_ADMIN or INSURANCE_ADMIN role
 */
@ApiTags('Accounting - Settlements')
@ApiBearerAuth()
@Controller('accounting/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
export class SettlementController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly commissionCalculatorService: CommissionCalculatorService,
  ) {}

  // ===========================
  // Settlement CRUD Endpoints
  // ===========================

  @Get()
  @ApiOperation({ summary: 'Get all settlements' })
  @ApiQuery({ name: 'partnerType', enum: PartnerType, required: false })
  @ApiQuery({ name: 'status', enum: SettlementStatus, required: false })
  @ApiResponse({ status: 200, description: 'List of settlements' })
  async getSettlements(
    @Query('partnerType') partnerType?: PartnerType,
    @Query('status') status?: SettlementStatus,
  ) {
    if (partnerType) {
      return this.settlementService.getByPartner(partnerType);
    }
    if (status) {
      return this.settlementService.getByStatus(status);
    }
    return this.settlementService.getPendingSettlements();
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending settlements' })
  @ApiResponse({ status: 200, description: 'Pending settlements' })
  async getPendingSettlements() {
    return this.settlementService.getPendingSettlements();
  }

  @Get('approved')
  @ApiOperation({ summary: 'Get approved settlements ready for processing' })
  @ApiResponse({ status: 200, description: 'Approved settlements' })
  async getApprovedSettlements() {
    return this.settlementService.getApprovedSettlements();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  @ApiParam({ name: 'id', description: 'Settlement UUID' })
  @ApiResponse({ status: 200, description: 'Settlement details' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async getSettlementById(@Param('id') id: string) {
    return this.settlementService.getById(id);
  }

  // ===========================
  // Settlement Creation Endpoints
  // ===========================

  @Post('service-fee')
  @ApiOperation({ summary: 'Create service fee settlement' })
  @ApiResponse({ status: 201, description: 'Settlement created' })
  async createServiceFeeSettlement(
    @Body() dto: CreateServiceFeeSettlementDto,
  ) {
    const partnerType = dto.partnerType === 'KBA' ? PartnerType.KBA : PartnerType.ROBS_INSURANCE;
    return this.settlementService.createServiceFeeSettlement(
      partnerType,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
      dto.createdBy,
    );
  }

  @Post('commission')
  @ApiOperation({ summary: 'Create commission settlement' })
  @ApiResponse({ status: 201, description: 'Settlement created' })
  async createCommissionSettlement(
    @Body() dto: CreateCommissionSettlementDto,
  ) {
    return this.settlementService.createCommissionSettlement(
      dto.partnerType,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
      dto.commissionAmount,
      dto.metadata,
      dto.createdBy,
    );
  }

  // ===========================
  // Settlement Workflow Endpoints
  // ===========================

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a settlement' })
  @ApiParam({ name: 'id', description: 'Settlement UUID' })
  @ApiResponse({ status: 200, description: 'Settlement approved' })
  @ApiResponse({ status: 400, description: 'Settlement cannot be approved' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async approveSettlement(
    @Param('id') id: string,
    @Body('approvedBy') approvedBy: string,
  ) {
    return this.settlementService.approveSettlement(id, approvedBy);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process a settlement (execute bank transfer)' })
  @ApiParam({ name: 'id', description: 'Settlement UUID' })
  @ApiResponse({ status: 200, description: 'Settlement processed' })
  @ApiResponse({ status: 400, description: 'Settlement cannot be processed' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async processSettlement(
    @Param('id') id: string,
    @Body() dto: ProcessSettlementDto,
  ) {
    return this.settlementService.processSettlement(
      id,
      dto.bankReference,
      dto.bankAccount,
    );
  }

  // ===========================
  // Commission Calculation Endpoints
  // ===========================

  @Get('commission/calculate')
  @ApiOperation({ summary: 'Calculate commission for a period' })
  @ApiQuery({ name: 'periodStart', type: String })
  @ApiQuery({ name: 'periodEnd', type: String })
  @ApiResponse({ status: 200, description: 'Commission calculation result' })
  async calculateCommission(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const result = await this.commissionCalculatorService.calculateForPeriod(
      new Date(periodStart),
      new Date(periodEnd),
    );

    const validation = this.commissionCalculatorService.validateCalculation(result);
    const summaries = this.commissionCalculatorService.getPartnerCommissionSummaries(result);

    return {
      ...result,
      validation,
      partnerSummaries: summaries,
    };
  }

  @Get('partner-summary/:partnerType')
  @ApiOperation({ summary: 'Get settlement summary for a partner' })
  @ApiParam({ name: 'partnerType', enum: PartnerType })
  @ApiQuery({ name: 'periodStart', type: String })
  @ApiQuery({ name: 'periodEnd', type: String })
  @ApiResponse({ status: 200, description: 'Partner settlement summary' })
  async getPartnerSummary(
    @Param('partnerType') partnerType: PartnerType,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.settlementService.getPartnerSummary(
      partnerType,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }
}
