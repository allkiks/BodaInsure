import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { Policy, PolicyType, PolicyStatus } from '../entities/policy.entity.js';
import { PolicyBatch, BatchStatus, BatchSchedule } from '../entities/policy-batch.entity.js';
import { PolicyDocument, PolicyDocumentType, DocumentStatus } from '../entities/policy-document.entity.js';
import { PdfGenerationService } from './pdf-generation.service.js';
import type { PolicyPdfData } from './pdf-generation.service.js';

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  batchId: string;
  batchNumber: string;
  status: BatchStatus;
  totalPolicies: number;
  processedCount: number;
  failedCount: number;
  processingDurationMs: number;
  failedPolicies: Array<{ policyId: string; error: string }>;
}

/**
 * Policy issuance request (from payment module)
 */
export interface PolicyIssuanceRequest {
  userId: string;
  policyType: PolicyType;
  triggeringTransactionId: string;
  insuredName: string;
  nationalId: string;
  phone: string;
  vehicleRegistration: string;
  premiumAmount: number; // In cents
}

/**
 * Batch Processing Service
 * Handles the 3x daily batch processing for policy issuance
 *
 * Per module_architecture.md:
 * - Batch 1: 08:00 EAT (payments 00:00-07:59)
 * - Batch 2: 14:00 EAT (payments 08:00-13:59)
 * - Batch 3: 20:00 EAT (payments 14:00-19:59)
 */
@Injectable()
export class BatchProcessingService {
  private readonly logger = new Logger(BatchProcessingService.name);

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyBatch)
    private readonly batchRepository: Repository<PolicyBatch>,
    private readonly pdfGenerationService: PdfGenerationService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Check if a vehicle can have another TPO policy this year
   * Per CR-IRA-001: Maximum 2 TPO policies per vehicle per year
   */
  async canIssuePolicyForVehicle(vehicleRegistration: string): Promise<{
    allowed: boolean;
    reason?: string;
    existingCount: number;
  }> {
    if (!vehicleRegistration) {
      return { allowed: true, existingCount: 0 };
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Count active and pending policies for this vehicle this year
    const existingPolicies = await this.policyRepository.count({
      where: {
        vehicleRegistration,
        status: In([
          PolicyStatus.PENDING_ISSUANCE,
          PolicyStatus.PROCESSING,
          PolicyStatus.ACTIVE,
          PolicyStatus.EXPIRING,
        ]),
        createdAt: Between(yearStart, yearEnd),
      },
    });

    if (existingPolicies >= 2) {
      return {
        allowed: false,
        reason: `Vehicle ${vehicleRegistration} already has ${existingPolicies} TPO policies this year. IRA regulations limit to 2 per year.`,
        existingCount: existingPolicies,
      };
    }

    return {
      allowed: true,
      existingCount: existingPolicies,
    };
  }

  /**
   * Create a policy pending issuance (called after successful payment)
   * Per CR-IRA-001: Validates two-policy limit per vehicle before creation
   */
  async createPendingPolicy(request: PolicyIssuanceRequest): Promise<Policy> {
    // Per CR-IRA-001: Check two-policy limit
    const canIssue = await this.canIssuePolicyForVehicle(request.vehicleRegistration);
    if (!canIssue.allowed) {
      throw new Error(canIssue.reason);
    }

    const policy = this.policyRepository.create({
      userId: request.userId,
      policyType: request.policyType,
      status: PolicyStatus.PENDING_ISSUANCE,
      triggeringTransactionId: request.triggeringTransactionId,
      insuredName: request.insuredName,
      nationalId: request.nationalId,
      vehicleRegistration: request.vehicleRegistration,
      premiumAmount: request.premiumAmount,
      currency: 'KES',
      metadata: {
        phone: request.phone,
      },
    });

    await this.policyRepository.save(policy);

    this.logger.log(
      `Pending policy created: userId=${request.userId.slice(0, 8)}... type=${request.policyType} vehicle=${request.vehicleRegistration}`,
    );

    return policy;
  }

  /**
   * Process a scheduled batch
   */
  async processBatch(schedule: BatchSchedule, date?: Date): Promise<BatchProcessingResult> {
    const batchDate = date ?? new Date();
    const batchNumber = PolicyBatch.generateBatchNumber(batchDate, schedule);

    this.logger.log(`Starting batch processing: ${batchNumber}`);

    // Check for existing batch
    let batch = await this.batchRepository.findOne({
      where: { batchNumber },
    });

    if (batch && batch.isComplete()) {
      this.logger.warn(`Batch ${batchNumber} already processed`);
      return this.createBatchResult(batch);
    }

    // Calculate payment window
    const { windowStart, windowEnd } = this.getPaymentWindow(schedule, batchDate);

    // Create or update batch
    if (!batch) {
      batch = this.batchRepository.create({
        batchNumber,
        schedule,
        batchDate,
        status: BatchStatus.PENDING,
        scheduledFor: this.getScheduledTime(schedule, batchDate),
        paymentWindowStart: windowStart,
        paymentWindowEnd: windowEnd,
      });
      await this.batchRepository.save(batch);
    }

    // Get pending policies for this window
    const pendingPolicies = await this.policyRepository.find({
      where: {
        status: PolicyStatus.PENDING_ISSUANCE,
        createdAt: Between(windowStart, windowEnd),
      },
      order: { createdAt: 'ASC' },
    });

    if (pendingPolicies.length === 0) {
      this.logger.log(`No pending policies for batch ${batchNumber}`);
      batch.status = BatchStatus.COMPLETED;
      batch.completedAt = new Date();
      batch.totalPolicies = 0;
      await this.batchRepository.save(batch);
      return this.createBatchResult(batch);
    }

    // Update batch with counts
    batch.status = BatchStatus.PROCESSING;
    batch.startedAt = new Date();
    batch.totalPolicies = pendingPolicies.length;
    batch.oneMonthCount = pendingPolicies.filter(p => p.policyType === PolicyType.ONE_MONTH).length;
    batch.elevenMonthCount = pendingPolicies.filter(p => p.policyType === PolicyType.ELEVEN_MONTH).length;
    batch.totalPremium = pendingPolicies.reduce((sum, p) => sum + Number(p.premiumAmount), 0);
    await this.batchRepository.save(batch);

    // Process each policy
    const failedPolicies: Array<{ policyId: string; error: string }> = [];
    let processedCount = 0;

    for (const policy of pendingPolicies) {
      try {
        await this.processPolicy(policy, batch.id);
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failedPolicies.push({ policyId: policy.id, error: errorMessage });
        this.logger.error(`Failed to process policy ${policy.id}: ${errorMessage}`);
      }
    }

    // Update batch completion
    batch.completedAt = new Date();
    batch.processedCount = processedCount;
    batch.failedCount = failedPolicies.length;
    batch.processingDurationMs = batch.completedAt.getTime() - (batch.startedAt?.getTime() ?? 0);
    batch.failedPolicies = failedPolicies.length > 0 ? failedPolicies : undefined;
    batch.status = failedPolicies.length === 0
      ? BatchStatus.COMPLETED
      : failedPolicies.length === pendingPolicies.length
        ? BatchStatus.FAILED
        : BatchStatus.COMPLETED_WITH_ERRORS;

    await this.batchRepository.save(batch);

    this.logger.log(
      `Batch ${batchNumber} completed: ${processedCount}/${pendingPolicies.length} processed, ${failedPolicies.length} failed`,
    );

    return this.createBatchResult(batch);
  }

  /**
   * Process a single policy in the batch
   */
  private async processPolicy(policy: Policy, batchId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const policyRepo = manager.getRepository(Policy);
      const documentRepo = manager.getRepository(PolicyDocument);

      // Update policy status to processing
      policy.status = PolicyStatus.PROCESSING;
      policy.batchId = batchId;
      await policyRepo.save(policy);

      // Generate policy number
      const policyNumber = await this.generatePolicyNumber(policy.policyType);

      // Calculate coverage dates
      const coverageStart = new Date();
      const coverageEnd = this.calculateCoverageEnd(coverageStart, policy.policyType);

      // Update policy with issuance details
      policy.policyNumber = policyNumber;
      policy.certificateNumber = policyNumber;
      policy.coverageStart = coverageStart;
      policy.coverageEnd = coverageEnd;
      policy.expiresAt = coverageEnd;
      policy.issuedAt = new Date();
      policy.activatedAt = new Date();
      policy.status = PolicyStatus.ACTIVE;

      await policyRepo.save(policy);

      // Generate PDF document
      const pdfData: PolicyPdfData = {
        policyNumber,
        policyType: policy.policyType,
        insuredName: policy.insuredName ?? 'Unknown',
        nationalId: policy.nationalId ?? '',
        phone: (policy.metadata as Record<string, string>)?.phone ?? '',
        vehicleRegistration: policy.vehicleRegistration ?? '',
        coverageStart,
        coverageEnd,
        premiumAmount: policy.getPremiumInKes(),
        issuedAt: policy.issuedAt,
        underwriterName: 'Definite Assurance Company Ltd',
        agentName: 'Robs Insurance Agency',
      };

      const generatedPdf = await this.pdfGenerationService.generatePolicyCertificate(pdfData);

      // Create document record
      const document = documentRepo.create({
        policyId: policy.id,
        userId: policy.userId,
        documentType: PolicyDocumentType.POLICY_CERTIFICATE,
        status: DocumentStatus.GENERATED,
        fileName: generatedPdf.fileName,
        mimeType: generatedPdf.mimeType,
        fileSize: generatedPdf.fileSize,
        contentHash: generatedPdf.contentHash,
        generatedAt: new Date(),
        generationData: pdfData as unknown as Record<string, unknown>,
      });

      // In production, we would upload to S3 here
      // For now, store path would be set after upload
      // document.storagePath = await this.uploadToStorage(generatedPdf.buffer, generatedPdf.fileName);

      await documentRepo.save(document);

      this.logger.log(
        `Policy processed: ${policyNumber} type=${policy.policyType} coverage=${this.formatDate(coverageStart)}-${this.formatDate(coverageEnd)}`,
      );
    });
  }

  /**
   * Generate a unique policy number
   * Format: BDA-YYMM-NNNNNN
   */
  private async generatePolicyNumber(policyType: PolicyType): Promise<string> {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = policyType === PolicyType.ONE_MONTH ? 'BDA' : 'BDB';

    // Get count of policies this month for sequence
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const count = await this.policyRepository.count({
      where: {
        policyType,
        createdAt: Between(monthStart, monthEnd),
      },
    });

    const sequence = String(count + 1).padStart(6, '0');
    return `${prefix}-${year}${month}-${sequence}`;
  }

  /**
   * Calculate coverage end date based on policy type
   */
  private calculateCoverageEnd(start: Date, policyType: PolicyType): Date {
    const end = new Date(start);
    if (policyType === PolicyType.ONE_MONTH) {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setMonth(end.getMonth() + 11);
    }
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Get payment window for a batch schedule
   */
  private getPaymentWindow(schedule: BatchSchedule, date: Date): { windowStart: Date; windowEnd: Date } {
    const windowStart = new Date(date);
    const windowEnd = new Date(date);

    // Set to start of day in EAT (UTC+3)
    windowStart.setUTCHours(0, 0, 0, 0);
    windowEnd.setUTCHours(0, 0, 0, 0);

    switch (schedule) {
      case BatchSchedule.BATCH_1:
        // 00:00 - 07:59 EAT = 21:00 prev day - 04:59 UTC
        windowStart.setDate(windowStart.getDate() - 1);
        windowStart.setUTCHours(21, 0, 0, 0);
        windowEnd.setUTCHours(4, 59, 59, 999);
        break;
      case BatchSchedule.BATCH_2:
        // 08:00 - 13:59 EAT = 05:00 - 10:59 UTC
        windowStart.setUTCHours(5, 0, 0, 0);
        windowEnd.setUTCHours(10, 59, 59, 999);
        break;
      case BatchSchedule.BATCH_3:
        // 14:00 - 19:59 EAT = 11:00 - 16:59 UTC
        windowStart.setUTCHours(11, 0, 0, 0);
        windowEnd.setUTCHours(16, 59, 59, 999);
        break;
      case BatchSchedule.MANUAL:
        // Full day
        windowStart.setUTCHours(0, 0, 0, 0);
        windowEnd.setUTCHours(23, 59, 59, 999);
        break;
    }

    return { windowStart, windowEnd };
  }

  /**
   * Get scheduled time for a batch
   */
  private getScheduledTime(schedule: BatchSchedule, date: Date): Date {
    const scheduled = new Date(date);
    scheduled.setUTCHours(0, 0, 0, 0);

    switch (schedule) {
      case BatchSchedule.BATCH_1:
        scheduled.setUTCHours(5, 0, 0, 0); // 08:00 EAT
        break;
      case BatchSchedule.BATCH_2:
        scheduled.setUTCHours(11, 0, 0, 0); // 14:00 EAT
        break;
      case BatchSchedule.BATCH_3:
        scheduled.setUTCHours(17, 0, 0, 0); // 20:00 EAT
        break;
      case BatchSchedule.MANUAL:
        // Use current time
        break;
    }

    return scheduled;
  }

  /**
   * Create batch result from batch entity
   */
  private createBatchResult(batch: PolicyBatch): BatchProcessingResult {
    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      totalPolicies: batch.totalPolicies,
      processedCount: batch.processedCount,
      failedCount: batch.failedCount,
      processingDurationMs: Number(batch.processingDurationMs ?? 0),
      failedPolicies: batch.failedPolicies ?? [],
    };
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<PolicyBatch | null> {
    return this.batchRepository.findOne({ where: { id: batchId } });
  }

  /**
   * Get batches for a date range
   */
  async getBatches(startDate: Date, endDate: Date): Promise<PolicyBatch[]> {
    return this.batchRepository.find({
      where: {
        batchDate: Between(startDate, endDate),
      },
      order: { scheduledFor: 'DESC' },
    });
  }

  /**
   * Retry failed policies in a batch
   */
  async retryFailedPolicies(batchId: string): Promise<number> {
    const batch = await this.batchRepository.findOne({ where: { id: batchId } });
    if (!batch || !batch.failedPolicies || batch.failedPolicies.length === 0) {
      return 0;
    }

    const failedPolicyIds = batch.failedPolicies.map(f => f.policyId);
    const policies = await this.policyRepository.find({
      where: {
        id: In(failedPolicyIds),
        status: In([PolicyStatus.PENDING_ISSUANCE, PolicyStatus.PROCESSING]),
      },
    });

    let retried = 0;
    for (const policy of policies) {
      try {
        await this.processPolicy(policy, batchId);
        retried++;
      } catch (error) {
        this.logger.error(`Retry failed for policy ${policy.id}`, error);
      }
    }

    // Update batch counts
    batch.processedCount += retried;
    batch.failedCount -= retried;
    if (batch.failedCount === 0) {
      batch.status = BatchStatus.COMPLETED;
    }
    await this.batchRepository.save(batch);

    return retried;
  }

  /**
   * Format date for logging
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0] ?? '';
  }
}
