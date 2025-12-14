import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../identity/decorators/current-user.decorator.js';
import { PolicyService } from '../services/policy.service.js';
import type { PolicySummary, PolicyDetails } from '../services/policy.service.js';
import { BatchProcessingService } from '../services/batch-processing.service.js';
import { BatchSchedule } from '../entities/policy-batch.entity.js';

/**
 * Authenticated user payload from JWT
 */
interface AuthenticatedUser {
  userId: string;
  phone: string;
}

/**
 * Policy Controller
 * Handles policy queries and document downloads
 *
 * Per FEAT-POL-001, FEAT-POL-002
 */
@ApiTags('Policies')
@Controller('policies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
  ) {}

  /**
   * Get all policies for authenticated user
   * Per FEAT-POL-001
   */
  @Get()
  @ApiOperation({
    summary: 'Get user policies',
    description: 'Retrieve all policies for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of policies',
  })
  async getUserPolicies(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ policies: PolicySummary[] }> {
    const policies = await this.policyService.getUserPolicies(user.userId);
    return { policies };
  }

  /**
   * Get active policy
   */
  @Get('active')
  @ApiOperation({
    summary: 'Get active policy',
    description: 'Retrieve the current active policy for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Active policy or null',
  })
  async getActivePolicy(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ policy: PolicySummary | null }> {
    const policy = await this.policyService.getActivePolicy(user.userId);
    return { policy };
  }

  /**
   * Get policy statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get policy statistics',
    description: 'Get summary statistics of user policies',
  })
  @ApiResponse({
    status: 200,
    description: 'Policy statistics',
  })
  async getPolicyStats(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    totalPolicies: number;
    activePolicies: number;
    expiredPolicies: number;
    totalPremiumPaid: number;
    currentCoverage: {
      oneMonth: boolean;
      elevenMonth: boolean;
    };
  }> {
    return this.policyService.getUserPolicyStats(user.userId);
  }

  /**
   * Get policy details by ID
   * Per FEAT-POL-001
   */
  @Get(':policyId')
  @ApiOperation({
    summary: 'Get policy details',
    description: 'Retrieve detailed information about a specific policy',
  })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  @ApiResponse({
    status: 200,
    description: 'Policy details',
  })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async getPolicyDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ): Promise<PolicyDetails> {
    return this.policyService.getPolicyDetails(policyId, user.userId);
  }

  /**
   * Download policy document
   * Per FEAT-POL-002
   */
  @Get(':policyId/document')
  @ApiOperation({
    summary: 'Download policy document',
    description: 'Download the PDF certificate for a policy',
  })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  @ApiResponse({
    status: 200,
    description: 'Policy PDF document',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 404, description: 'Policy or document not found' })
  async downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ downloadUrl: string | null; message: string }> {
    const document = await this.policyService.getPolicyDocument(policyId, user.userId);

    // In production, we would return a signed S3 URL
    // For now, return the document info
    if (!document.storagePath) {
      return {
        downloadUrl: null,
        message: 'Document is being generated. Please try again shortly.',
      };
    }

    // Set response headers for PDF download
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`,
    });

    return {
      downloadUrl: document.downloadUrl ?? null,
      message: 'Document ready for download',
    };
  }

  /**
   * Cancel a policy (within free-look period)
   */
  @Post(':policyId/cancel')
  @ApiOperation({
    summary: 'Cancel policy',
    description: 'Cancel a policy (subject to cancellation rules)',
  })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  @ApiResponse({
    status: 200,
    description: 'Policy cancelled',
  })
  @ApiResponse({ status: 400, description: 'Cannot cancel policy' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async cancelPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() body: { reason: string },
  ): Promise<{ success: boolean; message: string }> {
    await this.policyService.cancelPolicy(policyId, user.userId, body.reason);
    return {
      success: true,
      message: 'Policy has been cancelled',
    };
  }
}

/**
 * Policy Batch Controller (Admin only)
 * Handles batch processing operations
 */
@ApiTags('Policy Batches')
@Controller('policy-batches')
export class PolicyBatchController {
  constructor(
    private readonly batchProcessingService: BatchProcessingService,
  ) {}

  /**
   * Trigger manual batch processing
   * In production, this would be restricted to admin users
   */
  @Post('process')
  @ApiOperation({
    summary: 'Trigger batch processing',
    description: 'Manually trigger batch processing (admin only)',
  })
  @ApiQuery({
    name: 'schedule',
    required: false,
    enum: BatchSchedule,
    description: 'Batch schedule to process',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch processing result',
  })
  async processBatch(
    @Query('schedule') schedule?: string,
  ): Promise<{
    batchId: string;
    batchNumber: string;
    status: string;
    totalPolicies: number;
    processedCount: number;
    failedCount: number;
    processingDurationMs: number;
  }> {
    const batchSchedule = (schedule as BatchSchedule) ?? BatchSchedule.MANUAL;
    const result = await this.batchProcessingService.processBatch(batchSchedule);

    return {
      batchId: result.batchId,
      batchNumber: result.batchNumber,
      status: result.status,
      totalPolicies: result.totalPolicies,
      processedCount: result.processedCount,
      failedCount: result.failedCount,
      processingDurationMs: result.processingDurationMs,
    };
  }

  /**
   * Get batch details
   */
  @Get(':batchId')
  @ApiOperation({
    summary: 'Get batch details',
    description: 'Get details of a specific batch',
  })
  @ApiParam({ name: 'batchId', description: 'Batch ID' })
  async getBatch(
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ): Promise<{
    id: string;
    batchNumber: string;
    schedule: string;
    status: string;
    totalPolicies: number;
    processedCount: number;
    failedCount: number;
    scheduledFor: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }> {
    const batch = await this.batchProcessingService.getBatch(batchId);
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      schedule: batch.schedule,
      status: batch.status,
      totalPolicies: batch.totalPolicies,
      processedCount: batch.processedCount,
      failedCount: batch.failedCount,
      scheduledFor: batch.scheduledFor,
      startedAt: batch.startedAt ?? null,
      completedAt: batch.completedAt ?? null,
    };
  }

  /**
   * Retry failed policies in a batch
   */
  @Post(':batchId/retry')
  @ApiOperation({
    summary: 'Retry failed policies',
    description: 'Retry processing of failed policies in a batch',
  })
  @ApiParam({ name: 'batchId', description: 'Batch ID' })
  async retryBatch(
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ): Promise<{ retriedCount: number }> {
    const retriedCount = await this.batchProcessingService.retryFailedPolicies(batchId);
    return { retriedCount };
  }
}
