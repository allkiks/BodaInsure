import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import {
  EscrowTracking,
  EscrowType,
  RemittanceStatus,
} from '../entities/escrow-tracking.entity.js';
import {
  RemittanceBatch,
  RemittanceBatchType,
  RemittanceBatchStatus,
} from '../entities/remittance-batch.entity.js';
import { PostingEngineService } from './posting-engine.service.js';

/**
 * Input for creating an escrow record
 */
export interface CreateEscrowInput {
  riderId: string;
  transactionId: string;
  paymentDay: number;
  premiumAmountCents: number;
  serviceFeeAmountCents: number;
  metadata?: Record<string, unknown>;
}

/**
 * Escrow summary for a rider
 */
export interface RiderEscrowSummary {
  riderId: string;
  totalPremiumPending: number;
  totalPremiumRemitted: number;
  totalPremiumRefunded: number;
  pendingRecords: number;
  remittedRecords: number;
}

/**
 * Batch creation result
 */
export interface BatchCreationResult {
  success: boolean;
  batchId?: string;
  batchNumber?: string;
  totalRecords: number;
  totalAmount: number;
  message: string;
}

/**
 * Escrow Service
 *
 * Manages escrow tracking for premium funds before remittance to underwriter.
 *
 * Per Accounting_Remediation.md - Epic 5
 *
 * Key Responsibilities:
 * - Track premium funds from each payment
 * - Schedule Day 1 deposits for immediate remittance
 * - Accumulate Days 2-31 premiums for monthly bulk remittance
 * - Handle refund scenarios
 * - Create remittance batches
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectRepository(EscrowTracking)
    private readonly escrowRepository: Repository<EscrowTracking>,
    @InjectRepository(RemittanceBatch)
    private readonly batchRepository: Repository<RemittanceBatch>,
    private readonly postingEngineService: PostingEngineService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create an escrow record for a payment
   *
   * Called by PaymentService after successful payment processing.
   * Idempotent - checks if escrow already exists for transaction.
   *
   * @param input - Escrow details
   * @returns Created escrow record
   */
  async createEscrowRecord(input: CreateEscrowInput): Promise<EscrowTracking> {
    // Check if escrow already exists for this transaction (idempotency)
    const existing = await this.escrowRepository.findOne({
      where: { transactionId: input.transactionId },
    });

    if (existing) {
      this.logger.debug(
        `Escrow record already exists for transaction ${input.transactionId.slice(0, 8)}...`,
      );
      return existing;
    }

    // Determine escrow type based on payment day
    const escrowType =
      input.paymentDay === 1
        ? EscrowType.DAY_1_IMMEDIATE
        : EscrowType.DAYS_2_31_ACCUMULATED;

    const escrow = this.escrowRepository.create({
      riderId: input.riderId,
      transactionId: input.transactionId,
      paymentDay: input.paymentDay,
      premiumAmount: input.premiumAmountCents,
      serviceFeeAmount: input.serviceFeeAmountCents,
      escrowType,
      remittanceStatus: RemittanceStatus.PENDING,
      metadata: input.metadata,
    });

    await this.escrowRepository.save(escrow);

    this.logger.log(
      `Created escrow record: rider=${input.riderId.slice(0, 8)}... day=${input.paymentDay} type=${escrowType} premium=${input.premiumAmountCents / 100} KES`,
    );

    return escrow;
  }

  /**
   * Get escrow records for a rider
   */
  async getByRiderId(riderId: string): Promise<EscrowTracking[]> {
    return this.escrowRepository.find({
      where: { riderId },
      order: { paymentDay: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get escrow summary for a rider
   */
  async getRiderSummary(riderId: string): Promise<RiderEscrowSummary> {
    const records = await this.getByRiderId(riderId);

    const pending = records.filter(
      (r) => r.remittanceStatus === RemittanceStatus.PENDING,
    );
    const remitted = records.filter(
      (r) => r.remittanceStatus === RemittanceStatus.REMITTED,
    );
    const refunded = records.filter(
      (r) => r.remittanceStatus === RemittanceStatus.REFUNDED,
    );

    return {
      riderId,
      totalPremiumPending: pending.reduce(
        (sum, r) => sum + Number(r.premiumAmount),
        0,
      ),
      totalPremiumRemitted: remitted.reduce(
        (sum, r) => sum + Number(r.premiumAmount),
        0,
      ),
      totalPremiumRefunded: refunded.reduce(
        (sum, r) => sum + Number(r.premiumAmount),
        0,
      ),
      pendingRecords: pending.length,
      remittedRecords: remitted.length,
    };
  }

  /**
   * Get pending escrow records for Day 1 immediate remittance
   *
   * Called by scheduler to create daily Day 1 remittance batch.
   */
  async getPendingDay1Records(): Promise<EscrowTracking[]> {
    return this.escrowRepository.find({
      where: {
        escrowType: EscrowType.DAY_1_IMMEDIATE,
        remittanceStatus: RemittanceStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get pending accumulated records for monthly bulk remittance
   *
   * Called by scheduler to create monthly bulk remittance batch.
   */
  async getPendingAccumulatedRecords(): Promise<EscrowTracking[]> {
    return this.escrowRepository.find({
      where: {
        escrowType: EscrowType.DAYS_2_31_ACCUMULATED,
        remittanceStatus: RemittanceStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Create a Day 1 immediate remittance batch
   *
   * Should be called daily to remit Day 1 deposits to underwriter.
   */
  async createDay1RemittanceBatch(): Promise<BatchCreationResult> {
    const pendingRecords = await this.getPendingDay1Records();

    if (pendingRecords.length === 0) {
      return {
        success: true,
        totalRecords: 0,
        totalAmount: 0,
        message: 'No pending Day 1 records to remit',
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const escrowRepo = manager.getRepository(EscrowTracking);
      const batchRepo = manager.getRepository(RemittanceBatch);

      // Generate batch number
      const batchNumber = await this.generateBatchNumber(
        RemittanceBatchType.DAY_1_IMMEDIATE,
        manager,
      );

      // Calculate totals
      const totalPremium = pendingRecords.reduce(
        (sum, r) => sum + Number(r.premiumAmount),
        0,
      );

      // Create batch
      const batch = batchRepo.create({
        batchNumber,
        batchType: RemittanceBatchType.DAY_1_IMMEDIATE,
        batchDate: new Date(),
        totalPremiumAmount: totalPremium,
        totalRecords: pendingRecords.length,
        status: RemittanceBatchStatus.PENDING,
      });

      const savedBatch = await batchRepo.save(batch);

      // Update escrow records to SCHEDULED
      const escrowIds = pendingRecords.map((r) => r.id);
      await escrowRepo.update(
        { id: In(escrowIds) },
        {
          remittanceBatchId: savedBatch.id,
          remittanceStatus: RemittanceStatus.SCHEDULED,
        },
      );

      this.logger.log(
        `Created Day 1 remittance batch ${batchNumber}: ${pendingRecords.length} records, ${totalPremium / 100} KES`,
      );

      return {
        success: true,
        batchId: savedBatch.id,
        batchNumber: savedBatch.batchNumber,
        totalRecords: pendingRecords.length,
        totalAmount: totalPremium,
        message: `Batch ${batchNumber} created with ${pendingRecords.length} records`,
      };
    });
  }

  /**
   * Create a monthly bulk remittance batch
   *
   * Should be called at month-end to remit accumulated premiums.
   */
  async createMonthlyBulkBatch(): Promise<BatchCreationResult> {
    const pendingRecords = await this.getPendingAccumulatedRecords();

    if (pendingRecords.length === 0) {
      return {
        success: true,
        totalRecords: 0,
        totalAmount: 0,
        message: 'No pending accumulated records to remit',
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const escrowRepo = manager.getRepository(EscrowTracking);
      const batchRepo = manager.getRepository(RemittanceBatch);

      // Generate batch number
      const batchNumber = await this.generateBatchNumber(
        RemittanceBatchType.MONTHLY_BULK,
        manager,
      );

      // Calculate totals
      const totalPremium = pendingRecords.reduce(
        (sum, r) => sum + Number(r.premiumAmount),
        0,
      );

      // Create batch
      const batch = batchRepo.create({
        batchNumber,
        batchType: RemittanceBatchType.MONTHLY_BULK,
        batchDate: new Date(),
        totalPremiumAmount: totalPremium,
        totalRecords: pendingRecords.length,
        status: RemittanceBatchStatus.PENDING,
      });

      const savedBatch = await batchRepo.save(batch);

      // Update escrow records to SCHEDULED
      const escrowIds = pendingRecords.map((r) => r.id);
      await escrowRepo.update(
        { id: In(escrowIds) },
        {
          remittanceBatchId: savedBatch.id,
          remittanceStatus: RemittanceStatus.SCHEDULED,
        },
      );

      this.logger.log(
        `Created monthly bulk batch ${batchNumber}: ${pendingRecords.length} records, ${totalPremium / 100} KES`,
      );

      return {
        success: true,
        batchId: savedBatch.id,
        batchNumber: savedBatch.batchNumber,
        totalRecords: pendingRecords.length,
        totalAmount: totalPremium,
        message: `Batch ${batchNumber} created with ${pendingRecords.length} records`,
      };
    });
  }

  /**
   * Approve a remittance batch
   *
   * @param batchId - Batch ID to approve
   * @param approvedBy - User ID approving the batch
   */
  async approveBatch(batchId: string, approvedBy: string): Promise<RemittanceBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException('Remittance batch not found');
    }

    if (!batch.canBeApproved()) {
      throw new BadRequestException(
        `Batch cannot be approved. Current status: ${batch.status}`,
      );
    }

    batch.status = RemittanceBatchStatus.APPROVED;
    batch.approvedBy = approvedBy;
    batch.approvedAt = new Date();

    await this.batchRepository.save(batch);

    this.logger.log(`Approved remittance batch ${batch.batchNumber}`);

    return batch;
  }

  /**
   * Process a remittance batch (mark as remitted after bank transfer)
   *
   * @param batchId - Batch ID to process
   * @param bankReference - Bank transfer reference
   */
  async processBatch(
    batchId: string,
    bankReference: string,
  ): Promise<RemittanceBatch> {
    return this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(RemittanceBatch);
      const escrowRepo = manager.getRepository(EscrowTracking);

      const batch = await batchRepo.findOne({
        where: { id: batchId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!batch) {
        throw new NotFoundException('Remittance batch not found');
      }

      if (!batch.canBeProcessed()) {
        throw new BadRequestException(
          `Batch cannot be processed. Current status: ${batch.status}`,
        );
      }

      // Create journal entry for remittance
      const postingResult = await this.postingEngineService.postRemittance({
        transactionId: batch.id,
        amountCents: Number(batch.totalPremiumAmount),
        remittanceType: batch.isDay1Batch() ? 'DAY1' : 'BULK',
        description: `Remittance batch ${batch.batchNumber} to Definite Assurance`,
      });

      // Update batch
      batch.status = RemittanceBatchStatus.COMPLETED;
      batch.bankReference = bankReference;
      batch.processedAt = new Date();
      batch.journalEntryId = postingResult.journalEntryId;

      await batchRepo.save(batch);

      // Update all escrow records in the batch
      await escrowRepo.update(
        { remittanceBatchId: batchId },
        {
          remittanceStatus: RemittanceStatus.REMITTED,
          remittedAt: new Date(),
          bankReference,
          journalEntryId: postingResult.journalEntryId,
        },
      );

      this.logger.log(
        `Processed remittance batch ${batch.batchNumber}: ${batch.totalRecords} records, ${Number(batch.totalPremiumAmount) / 100} KES`,
      );

      return batch;
    });
  }

  /**
   * Mark escrow records as refunded
   *
   * Called when a rider requests a refund.
   *
   * @param riderId - Rider ID
   * @param refundTransactionId - Refund transaction ID
   * @param daysToRefund - Number of days to refund (from the end)
   */
  async markAsRefunded(
    riderId: string,
    refundTransactionId: string,
    daysToRefund: number,
  ): Promise<number> {
    // Get pending/scheduled records for this rider (most recent first)
    const records = await this.escrowRepository.find({
      where: {
        riderId,
        remittanceStatus: In([RemittanceStatus.PENDING, RemittanceStatus.SCHEDULED]),
      },
      order: { paymentDay: 'DESC' },
      take: daysToRefund,
    });

    if (records.length === 0) {
      this.logger.warn(
        `No refundable escrow records found for rider ${riderId.slice(0, 8)}...`,
      );
      return 0;
    }

    // Mark as refunded
    const recordIds = records.map((r) => r.id);
    await this.escrowRepository.update(
      { id: In(recordIds) },
      {
        remittanceStatus: RemittanceStatus.REFUNDED,
        refundTransactionId,
        refundedAt: new Date(),
      },
    );

    this.logger.log(
      `Marked ${records.length} escrow records as refunded for rider ${riderId.slice(0, 8)}...`,
    );

    return records.length;
  }

  /**
   * Get batch by ID
   */
  async getBatchById(batchId: string): Promise<RemittanceBatch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['escrowRecords'],
    });

    if (!batch) {
      throw new NotFoundException('Remittance batch not found');
    }

    return batch;
  }

  /**
   * Get batches by status
   */
  async getBatchesByStatus(status: RemittanceBatchStatus): Promise<RemittanceBatch[]> {
    return this.batchRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get batches by date range
   */
  async getBatchesByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<RemittanceBatch[]> {
    return this.batchRepository.find({
      where: {
        batchDate: Between(startDate, endDate),
      },
      order: { batchDate: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Generate unique batch number
   */
  private async generateBatchNumber(
    batchType: RemittanceBatchType,
    manager?: ReturnType<DataSource['createEntityManager']>,
  ): Promise<string> {
    const repo = manager
      ? manager.getRepository(RemittanceBatch)
      : this.batchRepository;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = batchType === RemittanceBatchType.DAY_1_IMMEDIATE ? 'RBD' : 'RBM';

    // Get count for today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await repo.count({
      where: {
        batchType,
        batchDate: Between(startOfDay, endOfDay),
      },
    });

    return `${prefix}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  /**
   * Get total pending premium for all riders
   */
  async getTotalPendingPremium(): Promise<{ day1: number; accumulated: number }> {
    const day1Records = await this.escrowRepository.find({
      where: {
        escrowType: EscrowType.DAY_1_IMMEDIATE,
        remittanceStatus: RemittanceStatus.PENDING,
      },
    });

    const accumulatedRecords = await this.escrowRepository.find({
      where: {
        escrowType: EscrowType.DAYS_2_31_ACCUMULATED,
        remittanceStatus: RemittanceStatus.PENDING,
      },
    });

    return {
      day1: day1Records.reduce((sum, r) => sum + Number(r.premiumAmount), 0),
      accumulated: accumulatedRecords.reduce(
        (sum, r) => sum + Number(r.premiumAmount),
        0,
      ),
    };
  }
}
