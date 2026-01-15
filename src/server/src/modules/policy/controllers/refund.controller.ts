import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
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
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { ROLES } from '../../../common/constants/index.js';
import { RefundService } from '../services/refund.service.js';
import { RefundStatus } from '../entities/rider-refund.entity.js';

interface AuthenticatedUser {
  userId: string;
  phone: string;
  role?: string;
}

/**
 * Refund Controller
 *
 * Manages rider refund operations for policy cancellations.
 *
 * Admin endpoints:
 * - List all refunds
 * - Approve pending refunds
 * - Process refund payouts
 * - Complete/fail refunds
 *
 * User endpoints:
 * - View own refunds
 */
@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  // ===========================
  // Admin Endpoints
  // ===========================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Get all refunds (admin)' })
  @ApiQuery({ name: 'status', enum: RefundStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'List of refunds' })
  async getRefunds(
    @Query('status') status?: RefundStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.refundService.getRefunds({
      status,
      page: page || 1,
      limit: limit || 20,
    });

    return {
      data: result.refunds.map((r) => ({
        ...r,
        refundAmountCents: Number(r.refundAmountCents),
        reversalFeeCents: Number(r.reversalFeeCents),
        originalAmountCents: Number(r.originalAmountCents),
        refundAmountKes: r.getRefundAmountInKes(),
        reversalFeeKes: r.getReversalFeeInKes(),
        originalAmountKes: r.getOriginalAmountInKes(),
      })),
      total: result.total,
      page: page || 1,
      limit: limit || 20,
    };
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Get pending refunds (awaiting approval)' })
  @ApiResponse({ status: 200, description: 'Pending refunds' })
  async getPendingRefunds() {
    const refunds = await this.refundService.getPendingRefunds();
    return {
      data: refunds.map((r) => ({
        ...r,
        refundAmountCents: Number(r.refundAmountCents),
        reversalFeeCents: Number(r.reversalFeeCents),
        originalAmountCents: Number(r.originalAmountCents),
        refundAmountKes: r.getRefundAmountInKes(),
        reversalFeeKes: r.getReversalFeeInKes(),
        originalAmountKes: r.getOriginalAmountInKes(),
      })),
    };
  }

  @Get('approved')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Get approved refunds (ready for payout)' })
  @ApiResponse({ status: 200, description: 'Approved refunds' })
  async getApprovedRefunds() {
    const refunds = await this.refundService.getApprovedRefunds();
    return {
      data: refunds.map((r) => ({
        ...r,
        refundAmountCents: Number(r.refundAmountCents),
        reversalFeeCents: Number(r.reversalFeeCents),
        originalAmountCents: Number(r.originalAmountCents),
        refundAmountKes: r.getRefundAmountInKes(),
        reversalFeeKes: r.getReversalFeeInKes(),
        originalAmountKes: r.getOriginalAmountInKes(),
      })),
    };
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Get refund statistics' })
  @ApiResponse({ status: 200, description: 'Refund statistics' })
  async getRefundStats() {
    const stats = await this.refundService.getRefundStats();
    return { data: stats };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Get refund by ID' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 200, description: 'Refund details' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async getRefund(@Param('id', ParseUUIDPipe) id: string) {
    const refund = await this.refundService.getRefund(id);
    return {
      data: {
        ...refund,
        refundAmountCents: Number(refund.refundAmountCents),
        reversalFeeCents: Number(refund.reversalFeeCents),
        originalAmountCents: Number(refund.originalAmountCents),
        refundAmountKes: refund.getRefundAmountInKes(),
        reversalFeeKes: refund.getReversalFeeInKes(),
        originalAmountKes: refund.getOriginalAmountInKes(),
      },
    };
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Approve a pending refund' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 200, description: 'Refund approved' })
  @ApiResponse({ status: 400, description: 'Cannot approve refund' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async approveRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const refund = await this.refundService.approveRefund(id, user.userId);
    return {
      data: {
        ...refund,
        refundAmountCents: Number(refund.refundAmountCents),
        reversalFeeCents: Number(refund.reversalFeeCents),
        originalAmountCents: Number(refund.originalAmountCents),
        refundAmountKes: refund.getRefundAmountInKes(),
      },
      message: `Refund ${refund.refundNumber} approved`,
    };
  }

  @Post(':id/process')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Process refund payout (initiate M-Pesa B2C)' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 200, description: 'Refund processing started' })
  @ApiResponse({ status: 400, description: 'Cannot process refund' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async processRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { payoutPhone?: string },
  ) {
    const refund = await this.refundService.processRefund(
      id,
      user.userId,
      body.payoutPhone,
    );
    return {
      data: {
        ...refund,
        refundAmountCents: Number(refund.refundAmountCents),
        reversalFeeCents: Number(refund.reversalFeeCents),
        originalAmountCents: Number(refund.originalAmountCents),
        refundAmountKes: refund.getRefundAmountInKes(),
      },
      message: `Refund ${refund.refundNumber} processing initiated`,
    };
  }

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Mark refund as completed (after M-Pesa success)' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 200, description: 'Refund completed' })
  @ApiResponse({ status: 400, description: 'Cannot complete refund' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async completeRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { mpesaTransactionId?: string },
  ) {
    const refund = await this.refundService.completeRefund(
      id,
      body.mpesaTransactionId,
    );
    return {
      data: {
        ...refund,
        refundAmountCents: Number(refund.refundAmountCents),
        reversalFeeCents: Number(refund.reversalFeeCents),
        originalAmountCents: Number(refund.originalAmountCents),
        refundAmountKes: refund.getRefundAmountInKes(),
      },
      message: `Refund ${refund.refundNumber} completed`,
    };
  }

  @Post(':id/fail')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Mark refund as failed' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 200, description: 'Refund marked as failed' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async failRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    const refund = await this.refundService.failRefund(id, body.reason);
    return {
      data: {
        ...refund,
        refundAmountCents: Number(refund.refundAmountCents),
        reversalFeeCents: Number(refund.reversalFeeCents),
        originalAmountCents: Number(refund.originalAmountCents),
        refundAmountKes: refund.getRefundAmountInKes(),
      },
      message: `Refund ${refund.refundNumber} marked as failed`,
    };
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN, ROLES.INSURANCE_ADMIN)
  @ApiOperation({ summary: 'Cancel a pending refund' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 200, description: 'Refund cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel refund' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async cancelRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    const refund = await this.refundService.cancelRefund(id, body.reason);
    return {
      data: {
        ...refund,
        refundAmountCents: Number(refund.refundAmountCents),
        reversalFeeCents: Number(refund.reversalFeeCents),
        originalAmountCents: Number(refund.originalAmountCents),
        refundAmountKes: refund.getRefundAmountInKes(),
      },
      message: `Refund ${refund.refundNumber} cancelled`,
    };
  }

  // ===========================
  // User Endpoints
  // ===========================

  @Get('my/refunds')
  @ApiOperation({ summary: 'Get my refunds (user)' })
  @ApiResponse({ status: 200, description: 'User refunds' })
  async getMyRefunds(@CurrentUser() user: AuthenticatedUser) {
    const refunds = await this.refundService.getUserRefunds(user.userId);
    return {
      data: refunds.map((r) => ({
        ...r,
        refundAmountCents: Number(r.refundAmountCents),
        reversalFeeCents: Number(r.reversalFeeCents),
        originalAmountCents: Number(r.originalAmountCents),
        refundAmountKes: r.getRefundAmountInKes(),
        reversalFeeKes: r.getReversalFeeInKes(),
        originalAmountKes: r.getOriginalAmountInKes(),
      })),
    };
  }
}
