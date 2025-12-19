import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import {
  PolicyTermsService,
  CreatePolicyTermsRequest,
} from '../services/policy-terms.service.js';
import { PolicyTermsType } from '../entities/policy-terms.entity.js';
import { UserRole } from '../../identity/entities/user.entity.js';

/**
 * Create policy terms DTO
 */
class CreatePolicyTermsDto implements CreatePolicyTermsRequest {
  version!: string;
  type?: PolicyTermsType;
  title!: string;
  content!: string;
  summary?: string;
  contentSw?: string;
  summarySw?: string;
  keyTerms?: string[];
  keyTermsSw?: string[];
  inclusions?: string[];
  exclusions?: string[];
  effectiveFrom!: Date;
  effectiveTo?: Date;
  underwriterName!: string;
  iraApprovalRef?: string;
  freeLookDays?: number;
  cancellationPolicy?: string;
  claimsProcess?: string;
  pdfUrl?: string;
  createdBy?: string;
}

/**
 * Acknowledge terms DTO
 */
class AcknowledgeTermsDto {
  termsId!: string;
  policyId?: string;
}

/**
 * Policy Terms Controller
 * CR-IRA-003: Policy terms display and acknowledgment
 */
@ApiTags('Policy Terms')
@Controller('policy-terms')
export class PolicyTermsController {
  constructor(private readonly policyTermsService: PolicyTermsService) {}

  // ============================================================
  // Public endpoints (no auth required for viewing terms)
  // ============================================================

  @Get('current')
  @Public()
  @ApiOperation({ summary: 'Get current active policy terms' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyTermsType })
  @ApiQuery({ name: 'language', required: false, enum: ['en', 'sw'] })
  @ApiResponse({ status: 200, description: 'Current terms' })
  async getCurrentTerms(
    @Query('type') type?: PolicyTermsType,
    @Query('language') language?: 'en' | 'sw',
  ) {
    const terms = await this.policyTermsService.getCurrentTerms(
      type ?? PolicyTermsType.TPO,
    );

    if (!terms) {
      return {
        success: false,
        error: 'No active terms found',
      };
    }

    // Select content based on language
    const content =
      language === 'sw' && terms.contentSw ? terms.contentSw : terms.content;
    const summary =
      language === 'sw' && terms.summarySw
        ? terms.summarySw
        : terms.summary ?? terms.title;
    const keyTerms =
      language === 'sw' && terms.keyTermsSw
        ? terms.keyTermsSw
        : terms.keyTerms ?? [];

    return {
      success: true,
      terms: {
        id: terms.id,
        version: terms.version,
        type: terms.type,
        title: terms.title,
        content,
        summary,
        keyTerms,
        inclusions: terms.inclusions,
        exclusions: terms.exclusions,
        freeLookDays: terms.freeLookDays,
        underwriterName: terms.underwriterName,
        effectiveFrom: terms.effectiveFrom,
        pdfUrl: terms.pdfUrl,
      },
    };
  }

  @Get('summary')
  @Public()
  @ApiOperation({ summary: 'Get terms summary (for USSD/mobile)' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyTermsType })
  @ApiQuery({ name: 'language', required: false, enum: ['en', 'sw'] })
  async getTermsSummary(
    @Query('type') type?: PolicyTermsType,
    @Query('language') language?: 'en' | 'sw',
  ) {
    const result = await this.policyTermsService.getTermsForUssd(
      type ?? PolicyTermsType.TPO,
      language ?? 'en',
    );

    if (!result) {
      return {
        success: false,
        error: 'No terms available',
      };
    }

    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get policy terms by ID' })
  @ApiResponse({ status: 200, description: 'Terms details' })
  @ApiResponse({ status: 404, description: 'Terms not found' })
  async getTermsById(@Param('id', ParseUUIDPipe) id: string) {
    const terms = await this.policyTermsService.getTermsById(id);

    if (!terms) {
      return {
        success: false,
        error: 'Terms not found',
      };
    }

    return {
      success: true,
      terms,
    };
  }

  // ============================================================
  // Authenticated user endpoints
  // ============================================================

  @Get('acknowledgment/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check user acknowledgment status' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyTermsType })
  async checkAcknowledgmentStatus(
    @Request() req: { user: { userId: string } },
    @Query('type') type?: PolicyTermsType,
  ) {
    const status = await this.policyTermsService.checkAcknowledgmentStatus(
      req.user.userId,
      type ?? PolicyTermsType.TPO,
    );

    return {
      success: true,
      acknowledged: status.acknowledged,
      requiresReAcknowledgment: status.requiresReAcknowledgment,
      currentTermsId: status.currentTerms?.id,
      currentTermsVersion: status.currentTerms?.version,
      acknowledgedAt: status.acknowledgment?.acknowledgedAt,
    };
  }

  @Post('acknowledge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge policy terms' })
  @ApiResponse({ status: 200, description: 'Terms acknowledged' })
  async acknowledgeTerms(
    @Request()
    req: {
      user: { userId: string };
      ip?: string;
      headers?: { 'user-agent'?: string };
    },
    @Body() dto: AcknowledgeTermsDto,
  ) {
    const acknowledgment = await this.policyTermsService.acknowledgeTerms({
      userId: req.user.userId,
      termsId: dto.termsId,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      channel: 'app',
      policyId: dto.policyId,
    });

    return {
      success: true,
      acknowledgment: {
        id: acknowledgment.id,
        termsId: acknowledgment.termsId,
        acknowledgedAt: acknowledgment.acknowledgedAt,
        channel: acknowledgment.channel,
      },
    };
  }

  @Get('acknowledgment/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user acknowledgment history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAcknowledgmentHistory(
    @Request() req: { user: { userId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.policyTermsService.getUserAcknowledgments(
      req.user.userId,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
    );

    return {
      success: true,
      acknowledgments: result.acknowledgments.map((a) => ({
        id: a.id,
        termsId: a.termsId,
        termsVersion: a.terms?.version,
        termsTitle: a.terms?.title,
        acknowledgedAt: a.acknowledgedAt,
        channel: a.channel,
      })),
      total: result.total,
    };
  }

  @Get('validate/policy-issuance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate terms acknowledgment for policy issuance' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyTermsType })
  async validateForPolicyIssuance(
    @Request() req: { user: { userId: string } },
    @Query('type') type?: PolicyTermsType,
  ) {
    const result = await this.policyTermsService.validateForPolicyIssuance(
      req.user.userId,
      type ?? PolicyTermsType.TPO,
    );

    return {
      success: true,
      ...result,
    };
  }

  // ============================================================
  // Admin endpoints
  // ============================================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new policy terms version' })
  @ApiResponse({ status: 201, description: 'Terms created' })
  async createTerms(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreatePolicyTermsDto,
  ) {
    const terms = await this.policyTermsService.createTerms({
      ...dto,
      createdBy: req.user.userId,
    });

    return {
      success: true,
      terms: {
        id: terms.id,
        version: terms.version,
        type: terms.type,
        title: terms.title,
        effectiveFrom: terms.effectiveFrom,
        createdAt: terms.createdAt,
      },
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all policy terms versions' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyTermsType })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listTerms(
    @Query('type') type?: PolicyTermsType,
    @Query('activeOnly') activeOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.policyTermsService.listTerms({
      type,
      activeOnly: activeOnly === 'true',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      success: true,
      terms: result.terms.map((t) => ({
        id: t.id,
        version: t.version,
        type: t.type,
        title: t.title,
        isActive: t.isActive,
        effectiveFrom: t.effectiveFrom,
        effectiveTo: t.effectiveTo,
        createdAt: t.createdAt,
      })),
      total: result.total,
    };
  }

  @Put(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.INSURANCE_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate policy terms version' })
  async deactivateTerms(@Param('id', ParseUUIDPipe) id: string) {
    const terms = await this.policyTermsService.deactivateTerms(id);

    return {
      success: true,
      terms: {
        id: terms.id,
        version: terms.version,
        isActive: terms.isActive,
      },
    };
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed default TPO terms' })
  async seedDefaultTerms() {
    const terms = await this.policyTermsService.seedDefaultTerms();

    return {
      success: true,
      terms: {
        id: terms.id,
        version: terms.version,
        title: terms.title,
      },
    };
  }
}
