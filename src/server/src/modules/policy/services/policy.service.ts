import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Policy, PolicyType, PolicyStatus } from '../entities/policy.entity.js';
import { PolicyDocument, DocumentStatus } from '../entities/policy-document.entity.js';
import { BatchProcessingService, PolicyIssuanceRequest } from './batch-processing.service.js';

/**
 * Policy summary for display
 */
export interface PolicySummary {
  id: string;
  policyNumber: string | null;
  policyType: PolicyType;
  status: PolicyStatus;
  coverageStart: Date | null;
  coverageEnd: Date | null;
  daysUntilExpiry: number | null;
  premiumAmount: number;
  isActive: boolean;
  documentAvailable: boolean;
}

/**
 * Policy details with full information
 */
export interface PolicyDetails extends PolicySummary {
  insuredName: string | null;
  vehicleRegistration: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  document?: {
    id: string;
    fileName: string;
    downloadUrl: string | null;
    generatedAt: Date | null;
  };
}

/**
 * Policy Service
 * Handles policy queries, status updates, and user-facing operations
 *
 * Per FEAT-POL-001, FEAT-POL-002, FEAT-POL-003
 */
@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyDocument)
    private readonly documentRepository: Repository<PolicyDocument>,
    private readonly batchProcessingService: BatchProcessingService,
  ) {}

  /**
   * Queue a policy for issuance (called after successful payment)
   * Per FEAT-PAY-001 and FEAT-PAY-002 triggers
   */
  async queuePolicyIssuance(request: PolicyIssuanceRequest): Promise<Policy> {
    return this.batchProcessingService.createPendingPolicy(request);
  }

  /**
   * Get all policies for a user
   * Per FEAT-POL-001
   */
  async getUserPolicies(userId: string): Promise<PolicySummary[]> {
    const policies = await this.policyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Get document availability
    const policyIds = policies.map(p => p.id);
    const documents = await this.documentRepository.find({
      where: {
        policyId: In(policyIds),
        status: DocumentStatus.GENERATED,
      },
      select: ['policyId'],
    });
    const documentPolicyIds = new Set(documents.map(d => d.policyId));

    return policies.map(policy => ({
      id: policy.id,
      policyNumber: policy.policyNumber ?? null,
      policyType: policy.policyType,
      status: policy.status,
      coverageStart: policy.coverageStart ?? null,
      coverageEnd: policy.coverageEnd ?? null,
      daysUntilExpiry: policy.getDaysUntilExpiry(),
      premiumAmount: policy.getPremiumInKes(),
      isActive: policy.isActive(),
      documentAvailable: documentPolicyIds.has(policy.id),
    }));
  }

  /**
   * Get active policy for user (most recent active)
   */
  async getActivePolicy(userId: string): Promise<PolicySummary | null> {
    const policy = await this.policyRepository.findOne({
      where: {
        userId,
        status: In([PolicyStatus.ACTIVE, PolicyStatus.EXPIRING]),
      },
      order: { coverageEnd: 'DESC' },
    });

    if (!policy) return null;

    const document = await this.documentRepository.findOne({
      where: {
        policyId: policy.id,
        status: DocumentStatus.GENERATED,
      },
    });

    return {
      id: policy.id,
      policyNumber: policy.policyNumber ?? null,
      policyType: policy.policyType,
      status: policy.status,
      coverageStart: policy.coverageStart ?? null,
      coverageEnd: policy.coverageEnd ?? null,
      daysUntilExpiry: policy.getDaysUntilExpiry(),
      premiumAmount: policy.getPremiumInKes(),
      isActive: policy.isActive(),
      documentAvailable: !!document,
    };
  }

  /**
   * Get policy details by ID
   * Per FEAT-POL-001
   */
  async getPolicyDetails(policyId: string, userId: string): Promise<PolicyDetails> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    // Verify ownership
    if (policy.userId !== userId) {
      throw new NotFoundException('Policy not found');
    }

    const document = await this.documentRepository.findOne({
      where: {
        policyId: policy.id,
        status: DocumentStatus.GENERATED,
      },
    });

    return {
      id: policy.id,
      policyNumber: policy.policyNumber ?? null,
      policyType: policy.policyType,
      status: policy.status,
      coverageStart: policy.coverageStart ?? null,
      coverageEnd: policy.coverageEnd ?? null,
      daysUntilExpiry: policy.getDaysUntilExpiry(),
      premiumAmount: policy.getPremiumInKes(),
      isActive: policy.isActive(),
      documentAvailable: !!document,
      insuredName: policy.insuredName ?? null,
      vehicleRegistration: policy.vehicleRegistration ?? null,
      issuedAt: policy.issuedAt ?? null,
      createdAt: policy.createdAt,
      document: document ? {
        id: document.id,
        fileName: document.fileName,
        downloadUrl: document.hasValidDownloadUrl() ? (document.downloadUrl ?? null) : null,
        generatedAt: document.generatedAt ?? null,
      } : undefined,
    };
  }

  /**
   * Get policy document for download
   * Per FEAT-POL-002
   */
  async getPolicyDocument(policyId: string, userId: string): Promise<PolicyDocument> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
    });

    if (!policy || policy.userId !== userId) {
      throw new NotFoundException('Policy not found');
    }

    const document = await this.documentRepository.findOne({
      where: {
        policyId,
        status: DocumentStatus.GENERATED,
      },
    });

    if (!document) {
      throw new NotFoundException('Policy document not yet generated');
    }

    // Update download count
    document.downloadCount++;
    document.lastDownloadedAt = new Date();
    await this.documentRepository.save(document);

    return document;
  }

  /**
   * Get policies expiring within given days
   * Per FEAT-POL-003
   */
  async getExpiringPolicies(daysUntilExpiry: number): Promise<Policy[]> {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

    return this.policyRepository.find({
      where: {
        status: In([PolicyStatus.ACTIVE, PolicyStatus.EXPIRING]),
        expiresAt: LessThan(expiryThreshold),
      },
      order: { expiresAt: 'ASC' },
    });
  }

  /**
   * Update policies to EXPIRING status (30 days before expiry)
   * Called by scheduler
   */
  async updateExpiringPolicies(): Promise<number> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const result = await this.policyRepository.update(
      {
        status: PolicyStatus.ACTIVE,
        expiresAt: LessThan(thirtyDaysFromNow),
      },
      {
        status: PolicyStatus.EXPIRING,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Updated ${result.affected} policies to EXPIRING status`);
    }

    return result.affected ?? 0;
  }

  /**
   * Update policies to EXPIRED status
   * Called by scheduler
   */
  async expirePolicies(): Promise<number> {
    const now = new Date();

    const result = await this.policyRepository.update(
      {
        status: In([PolicyStatus.ACTIVE, PolicyStatus.EXPIRING]),
        expiresAt: LessThan(now),
      },
      {
        status: PolicyStatus.EXPIRED,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} policies`);
    }

    return result.affected ?? 0;
  }

  /**
   * Free look period in days
   * Per CR-IRA-002: 30-day free look period with full refund
   */
  private readonly FREE_LOOK_PERIOD_DAYS = 30;

  /**
   * Check if policy is within free look period
   * Per CR-IRA-002
   */
  isWithinFreeLookPeriod(policy: Policy): boolean {
    if (!policy.issuedAt) {
      return false;
    }
    const daysSinceIssue = Math.floor(
      (Date.now() - policy.issuedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceIssue <= this.FREE_LOOK_PERIOD_DAYS;
  }

  /**
   * Cancel a policy with optional refund
   * Per CR-IRA-002: Full refund during 30-day free look period
   */
  async cancelPolicy(
    policyId: string,
    userId: string,
    reason: string,
  ): Promise<{
    policy: Policy;
    refundEligible: boolean;
    refundAmount: number;
    message: string;
  }> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
    });

    if (!policy || policy.userId !== userId) {
      throw new NotFoundException('Policy not found');
    }

    if (!policy.isActive() && !policy.isPending()) {
      throw new BadRequestException('Policy cannot be cancelled');
    }

    // Check free look period per CR-IRA-002
    const withinFreeLook = this.isWithinFreeLookPeriod(policy);
    const refundAmount = withinFreeLook ? policy.getPremiumInKes() : 0;

    policy.status = PolicyStatus.CANCELLED;
    policy.cancelledAt = new Date();
    policy.cancellationReason = reason;
    policy.metadata = {
      ...policy.metadata,
      cancelledWithinFreeLook: withinFreeLook,
      refundAmount: refundAmount,
      freeLookPeriodDays: this.FREE_LOOK_PERIOD_DAYS,
    };

    await this.policyRepository.save(policy);

    this.logger.log(
      `Policy cancelled: ${policy.policyNumber ?? policy.id} ` +
      `freeLook=${withinFreeLook} refund=${refundAmount} KES`
    );

    let message: string;
    if (withinFreeLook) {
      message = `Policy cancelled within ${this.FREE_LOOK_PERIOD_DAYS}-day free look period. ` +
        `A full refund of KES ${refundAmount} will be processed.`;
    } else {
      message = 'Policy cancelled. No refund available as free look period has expired.';
    }

    return {
      policy,
      refundEligible: withinFreeLook,
      refundAmount,
      message,
    };
  }

  /**
   * Get cancellation preview (shows refund eligibility without cancelling)
   * Per CR-IRA-002
   */
  async getCancellationPreview(policyId: string, userId: string): Promise<{
    canCancel: boolean;
    withinFreeLookPeriod: boolean;
    freeLookDaysRemaining: number;
    refundAmount: number;
    message: string;
  }> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
    });

    if (!policy || policy.userId !== userId) {
      throw new NotFoundException('Policy not found');
    }

    const canCancel = policy.isActive() || policy.isPending();
    const withinFreeLook = this.isWithinFreeLookPeriod(policy);

    let freeLookDaysRemaining = 0;
    if (policy.issuedAt) {
      const daysSinceIssue = Math.floor(
        (Date.now() - policy.issuedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      freeLookDaysRemaining = Math.max(0, this.FREE_LOOK_PERIOD_DAYS - daysSinceIssue);
    }

    const refundAmount = withinFreeLook ? policy.getPremiumInKes() : 0;

    let message: string;
    if (!canCancel) {
      message = 'This policy cannot be cancelled as it is no longer active.';
    } else if (withinFreeLook) {
      message = `You have ${freeLookDaysRemaining} days remaining in the free look period. ` +
        `Cancelling now will result in a full refund of KES ${refundAmount}.`;
    } else {
      message = 'The 30-day free look period has expired. No refund is available if you cancel.';
    }

    return {
      canCancel,
      withinFreeLookPeriod: withinFreeLook,
      freeLookDaysRemaining,
      refundAmount,
      message,
    };
  }

  /**
   * Check if user has an active policy of given type
   */
  async hasActivePolicy(userId: string, policyType?: PolicyType): Promise<boolean> {
    const query: Record<string, unknown> = {
      userId,
      status: In([PolicyStatus.ACTIVE, PolicyStatus.EXPIRING]),
    };

    if (policyType) {
      query['policyType'] = policyType;
    }

    const count = await this.policyRepository.count({ where: query });
    return count > 0;
  }

  /**
   * Get policy statistics for a user
   */
  async getUserPolicyStats(userId: string): Promise<{
    totalPolicies: number;
    activePolicies: number;
    expiredPolicies: number;
    totalPremiumPaid: number;
    currentCoverage: {
      oneMonth: boolean;
      elevenMonth: boolean;
    };
  }> {
    const policies = await this.policyRepository.find({
      where: { userId },
    });

    const activePolicies = policies.filter(p => p.isActive());
    const expiredPolicies = policies.filter(p => p.status === PolicyStatus.EXPIRED);

    return {
      totalPolicies: policies.length,
      activePolicies: activePolicies.length,
      expiredPolicies: expiredPolicies.length,
      totalPremiumPaid: policies
        .filter(p => p.status !== PolicyStatus.CANCELLED)
        .reduce((sum, p) => sum + p.getPremiumInKes(), 0),
      currentCoverage: {
        oneMonth: activePolicies.some(p => p.policyType === PolicyType.ONE_MONTH),
        elevenMonth: activePolicies.some(p => p.policyType === PolicyType.ELEVEN_MONTH),
      },
    };
  }

  /**
   * Find policy by ID (internal use)
   * Per GAP-020: Used by queue processors
   */
  async findById(policyId: string): Promise<Policy | null> {
    return this.policyRepository.findOne({
      where: { id: policyId },
    });
  }

  /**
   * Update policy status
   * Per GAP-020: Used by queue processors for batch operations
   */
  async updatePolicyStatus(
    policyId: string,
    status: PolicyStatus,
  ): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
    });

    if (!policy) {
      throw new NotFoundException(`Policy not found: ${policyId}`);
    }

    policy.status = status;

    // Store status change timestamp in metadata
    policy.metadata = {
      ...policy.metadata,
      [`${status.toLowerCase()}At`]: new Date().toISOString(),
    };

    await this.policyRepository.save(policy);
    this.logger.log(`Policy ${policyId} status updated to ${status}`);

    return policy;
  }
}
