import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QueueName,
  PolicyJobType,
  PolicyQueueJobData,
  JobResult,
  PolicyCertificateJobData,
  PolicyBatchJobData,
  PolicyExpirationJobData,
} from '../interfaces/job.interface.js';
import { PolicyService } from '../../policy/services/policy.service.js';

/**
 * Policy Queue Processor
 * Per GAP-020: Handles async policy operations via BullMQ
 *
 * Processes:
 * - Certificate generation
 * - Batch policy processing (3x daily as per requirements)
 * - Policy expiration
 * - Policy lapsing (grace period exceeded)
 */
@Processor(QueueName.POLICY, {
  concurrency: 3,
})
export class PolicyProcessor extends WorkerHost {
  private readonly logger = new Logger(PolicyProcessor.name);

  constructor(private readonly policyService: PolicyService) {
    super();
  }

  async process(job: Job<PolicyQueueJobData>): Promise<JobResult> {
    const startTime = Date.now();
    this.logger.log(`Processing policy job ${job.id} (${job.data.type})`);

    try {
      let result: unknown;

      switch (job.data.type) {
        case PolicyJobType.GENERATE_CERTIFICATE:
          result = await this.processGenerateCertificate(
            job.data as PolicyCertificateJobData,
          );
          break;

        case PolicyJobType.PROCESS_BATCH:
          result = await this.processPolicicyBatch(
            job.data as PolicyBatchJobData,
          );
          break;

        case PolicyJobType.EXPIRE_POLICY:
          result = await this.processExpirePolicies(
            job.data as PolicyExpirationJobData,
          );
          break;

        case PolicyJobType.LAPSE_POLICY:
          result = await this.processLapsePolicies(
            job.data as PolicyExpirationJobData,
          );
          break;

        default:
          throw new Error(`Unknown policy job type: ${job.data.type}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Completed policy job ${job.id} in ${duration}ms`);

      return {
        success: true,
        data: result,
        processedAt: new Date(),
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      this.logger.error(
        `Failed policy job ${job.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
        processedAt: new Date(),
        duration,
      };
    }
  }

  private async processGenerateCertificate(
    data: PolicyCertificateJobData,
  ): Promise<{ certificateUrl: string }> {
    this.logger.log(`Generating certificate for policy ${data.policyId}`);

    // Get policy and generate certificate
    const policy = await this.policyService.findById(data.policyId);

    if (!policy) {
      throw new Error(`Policy not found: ${data.policyId}`);
    }

    // Certificate generation is typically handled by policy service
    // This would trigger certificate creation and delivery
    const certificateUrl = `certificates/${data.policyId}.pdf`;

    return { certificateUrl };
  }

  private async processPolicicyBatch(
    data: PolicyBatchJobData,
  ): Promise<{ processed: number; errors: number }> {
    this.logger.log(
      `Processing ${data.policyType} batch ${data.batchId}`,
    );

    // Batch processing would typically:
    // 1. Find all eligible payments
    // 2. Group by user
    // 3. Generate policies
    // 4. Send notifications

    // Placeholder for actual batch processing
    return { processed: 0, errors: 0 };
  }

  private async processExpirePolicies(
    data: PolicyExpirationJobData,
  ): Promise<{ expired: number; errors: number }> {
    this.logger.log(`Expiring ${data.policyIds.length} policies`);

    let expired = 0;
    let errors = 0;

    for (const policyId of data.policyIds) {
      try {
        await this.policyService.updatePolicyStatus(policyId, 'EXPIRED');
        expired++;
      } catch (error) {
        errors++;
        this.logger.warn(`Failed to expire policy ${policyId}`);
      }
    }

    return { expired, errors };
  }

  private async processLapsePolicies(
    data: PolicyExpirationJobData,
  ): Promise<{ lapsed: number; errors: number }> {
    this.logger.log(`Lapsing ${data.policyIds.length} policies`);

    let lapsed = 0;
    let errors = 0;

    for (const policyId of data.policyIds) {
      try {
        await this.policyService.updatePolicyStatus(policyId, 'LAPSED');
        lapsed++;
      } catch (error) {
        errors++;
        this.logger.warn(`Failed to lapse policy ${policyId}`);
      }
    }

    return { lapsed, errors };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PolicyQueueJobData>, result: JobResult): void {
    this.logger.debug(
      `Job ${job.id} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PolicyQueueJobData>, error: Error): void {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }
}
