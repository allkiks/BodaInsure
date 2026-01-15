import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiderRefund, RefundStatus, RefundPayoutMethod } from '../entities/rider-refund.entity.js';
import { PostingEngineService } from '../../accounting/services/posting-engine.service.js';
import { WalletService } from '../../payment/services/wallet.service.js';
import { MpesaService } from '../../payment/services/mpesa.service.js';
import { PAYMENT_AMOUNTS } from '../../accounting/config/posting-rules.config.js';

/**
 * Refund creation input
 */
export interface CreateRefundInput {
  userId: string;
  policyId: string;
  originalAmountCents: number;
  daysPaid: number;
  cancellationReason: string;
  payoutPhone?: string;
}

/**
 * Refund Service
 *
 * Manages rider refund lifecycle from policy cancellation to payout.
 * Integrates with accounting module for journal entries.
 *
 * Workflow:
 * 1. Policy cancelled -> createRefund() -> PENDING
 * 2. Admin approves -> approveRefund() -> APPROVED
 * 3. Admin processes payout -> processRefund() -> PROCESSING
 * 4. M-Pesa callback -> completeRefund() -> COMPLETED
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(RiderRefund)
    private readonly refundRepository: Repository<RiderRefund>,
    @Inject(forwardRef(() => PostingEngineService))
    private readonly postingEngineService: PostingEngineService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => MpesaService))
    private readonly mpesaService: MpesaService,
  ) {}

  /**
   * Generate unique refund number
   */
  private generateRefundNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REF-${dateStr}-${random}`;
  }

  /**
   * Create a refund request for a cancelled policy
   *
   * Called from PolicyService.cancelPolicy() when within free-look period.
   * Creates journal entries via PostingEngineService.
   */
  async createRefund(input: CreateRefundInput): Promise<RiderRefund> {
    const { userId, policyId, originalAmountCents, daysPaid, cancellationReason, payoutPhone } = input;

    // Calculate refund amounts
    const riderRefundCents = Math.floor(
      (originalAmountCents * PAYMENT_AMOUNTS.REFUND_RIDER_PERCENT) / 100
    );
    const reversalFeeCents = originalAmountCents - riderRefundCents;

    // Create refund record
    const refund = this.refundRepository.create({
      refundNumber: this.generateRefundNumber(),
      userId,
      policyId,
      refundAmountCents: BigInt(riderRefundCents),
      reversalFeeCents: BigInt(reversalFeeCents),
      originalAmountCents: BigInt(originalAmountCents),
      daysPaid,
      status: RefundStatus.PENDING,
      payoutMethod: RefundPayoutMethod.MPESA,
      payoutPhone,
      cancellationReason,
      metadata: {
        calculatedAt: new Date().toISOString(),
        refundPercent: PAYMENT_AMOUNTS.REFUND_RIDER_PERCENT,
        reversalFeePercent: PAYMENT_AMOUNTS.REFUND_REVERSAL_FEE_PERCENT,
      },
    });

    await this.refundRepository.save(refund);

    // Create journal entries for the refund
    const postingResult = await this.postingEngineService.postRefund({
      transactionId: refund.id,
      userId,
      amountCents: originalAmountCents,
      daysCount: daysPaid,
      description: `Refund for policy cancellation - ${refund.refundNumber}`,
      createdBy: userId,
    });

    if (postingResult.success) {
      refund.journalEntryId = postingResult.journalEntryId;
      await this.refundRepository.save(refund);
    }

    this.logger.log(
      `Created refund ${refund.refundNumber}: rider=${userId.slice(0, 8)}... ` +
      `amount=${riderRefundCents / 100} KES, reversalFee=${reversalFeeCents / 100} KES`
    );

    return refund;
  }

  /**
   * Get all refunds with optional filtering
   */
  async getRefunds(params?: {
    status?: RefundStatus;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ refunds: RiderRefund[]; total: number }> {
    const { status, userId, page = 1, limit = 20 } = params || {};

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [refunds, total] = await this.refundRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['policy'],
    });

    return { refunds, total };
  }

  /**
   * Get pending refunds (awaiting approval)
   */
  async getPendingRefunds(): Promise<RiderRefund[]> {
    return this.refundRepository.find({
      where: { status: RefundStatus.PENDING },
      order: { createdAt: 'ASC' },
      relations: ['policy'],
    });
  }

  /**
   * Get approved refunds (ready for payout)
   */
  async getApprovedRefunds(): Promise<RiderRefund[]> {
    return this.refundRepository.find({
      where: { status: RefundStatus.APPROVED },
      order: { approvedAt: 'ASC' },
      relations: ['policy'],
    });
  }

  /**
   * Get refund by ID
   */
  async getRefund(id: string): Promise<RiderRefund> {
    const refund = await this.refundRepository.findOne({
      where: { id },
      relations: ['policy'],
    });

    if (!refund) {
      throw new NotFoundException(`Refund ${id} not found`);
    }

    return refund;
  }

  /**
   * Approve a pending refund
   */
  async approveRefund(
    refundId: string,
    approvedBy: string,
  ): Promise<RiderRefund> {
    const refund = await this.getRefund(refundId);

    if (!refund.canApprove()) {
      throw new BadRequestException(
        `Refund ${refund.refundNumber} cannot be approved (status: ${refund.status})`
      );
    }

    refund.status = RefundStatus.APPROVED;
    refund.approvedBy = approvedBy;
    refund.approvedAt = new Date();

    await this.refundRepository.save(refund);

    this.logger.log(
      `Approved refund ${refund.refundNumber} by ${approvedBy.slice(0, 8)}...`
    );

    return refund;
  }

  /**
   * Process refund payout (initiate M-Pesa B2C)
   *
   * In production, this would call M-Pesa B2C API.
   * For now, it marks the refund as PROCESSING.
   */
  async processRefund(
    refundId: string,
    processedBy: string,
    payoutPhone?: string,
  ): Promise<RiderRefund> {
    const refund = await this.getRefund(refundId);

    if (!refund.canProcess()) {
      throw new BadRequestException(
        `Refund ${refund.refundNumber} cannot be processed (status: ${refund.status})`
      );
    }

    // Update payout phone if provided
    if (payoutPhone) {
      refund.payoutPhone = payoutPhone;
    }

    if (!refund.payoutPhone) {
      throw new BadRequestException('Payout phone number is required');
    }

    refund.status = RefundStatus.PROCESSING;
    refund.processedBy = processedBy;
    refund.processedAt = new Date();

    // Initiate M-Pesa B2C payout
    const refundAmountKes = refund.getRefundAmountInKes();
    const mpesaResult = await this.mpesaService.processRefund({
      phone: refund.payoutPhone,
      amount: refundAmountKes,
      reason: `Refund ${refund.refundNumber}`,
      transactionRef: refund.id,
    });

    if (mpesaResult.success) {
      refund.mpesaConversationId = mpesaResult.conversationId;
      this.logger.log(
        `M-Pesa B2C initiated for refund ${refund.refundNumber}: conversationId=${mpesaResult.conversationId}`
      );
    } else {
      // Log the failure but continue - can be retried later
      this.logger.warn(
        `M-Pesa B2C failed for refund ${refund.refundNumber}: ${mpesaResult.errorMessage}`
      );
      refund.mpesaConversationId = `FAILED-${Date.now()}`;
      refund.metadata = {
        ...refund.metadata,
        lastMpesaError: mpesaResult.errorMessage,
        lastMpesaErrorCode: mpesaResult.errorCode,
        lastMpesaAttempt: new Date().toISOString(),
      };
    }

    await this.refundRepository.save(refund);

    this.logger.log(
      `Processing refund ${refund.refundNumber} to ${refund.payoutPhone}`
    );

    return refund;
  }

  /**
   * Complete refund (called from M-Pesa callback or manually)
   *
   * This method:
   * 1. Creates journal entry for payout (debit 2101, credit 1002)
   * 2. Resets the rider's wallet to initial state
   * 3. Marks refund as completed
   */
  async completeRefund(
    refundId: string,
    mpesaTransactionId?: string,
  ): Promise<RiderRefund> {
    const refund = await this.getRefund(refundId);

    if (refund.status !== RefundStatus.PROCESSING) {
      throw new BadRequestException(
        `Refund ${refund.refundNumber} is not in PROCESSING status`
      );
    }

    const refundAmountCents = Number(refund.refundAmountCents);

    // 1. Create journal entry for the payout (clears liability in 2101)
    const payoutResult = await this.postingEngineService.postRefundPayout({
      transactionId: refund.id,
      userId: refund.userId,
      refundAmountCents,
      mpesaTransactionId,
      description: `Refund payout for ${refund.refundNumber}`,
      createdBy: refund.processedBy,
    });

    if (!payoutResult.success) {
      this.logger.error(
        `Failed to create payout journal entry for refund ${refund.refundNumber}: ${payoutResult.message}`
      );
      // Continue with completion even if posting fails - can be reconciled later
    }

    // 2. Reset the rider's wallet to initial state
    try {
      await this.walletService.resetWalletForRefund(
        refund.userId,
        `Wallet reset due to refund ${refund.refundNumber}`
      );
      this.logger.log(
        `Reset wallet for user ${refund.userId.slice(0, 8)}... after refund ${refund.refundNumber}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to reset wallet for user ${refund.userId.slice(0, 8)}...`,
        error
      );
      // Continue - wallet reset is important but shouldn't block refund completion
    }

    // 3. Mark refund as completed
    refund.status = RefundStatus.COMPLETED;
    refund.completedAt = new Date();
    if (mpesaTransactionId) {
      refund.mpesaTransactionId = mpesaTransactionId;
    }

    // Store payout journal entry ID if available
    if (payoutResult.success && payoutResult.journalEntryId) {
      refund.metadata = {
        ...refund.metadata,
        payoutJournalEntryId: payoutResult.journalEntryId,
        payoutEntryNumber: payoutResult.entryNumber,
      };
    }

    await this.refundRepository.save(refund);

    this.logger.log(
      `Completed refund ${refund.refundNumber}: ${refund.getRefundAmountInKes()} KES paid to rider`
    );

    return refund;
  }

  /**
   * Mark refund as failed
   */
  async failRefund(refundId: string, reason: string): Promise<RiderRefund> {
    const refund = await this.getRefund(refundId);

    refund.status = RefundStatus.FAILED;
    refund.failureReason = reason;

    await this.refundRepository.save(refund);

    this.logger.warn(
      `Failed refund ${refund.refundNumber}: ${reason}`
    );

    return refund;
  }

  /**
   * Cancel a pending refund
   */
  async cancelRefund(refundId: string, reason: string): Promise<RiderRefund> {
    const refund = await this.getRefund(refundId);

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(
        `Only PENDING refunds can be cancelled`
      );
    }

    refund.status = RefundStatus.CANCELLED;
    refund.failureReason = reason;

    await this.refundRepository.save(refund);

    this.logger.log(
      `Cancelled refund ${refund.refundNumber}: ${reason}`
    );

    return refund;
  }

  /**
   * Get refund summary statistics
   */
  async getRefundStats(): Promise<{
    pending: number;
    approved: number;
    processing: number;
    completed: number;
    failed: number;
    totalRefundedAmount: number;
    totalReversalFees: number;
  }> {
    const [pending, approved, processing, completed, failed] = await Promise.all([
      this.refundRepository.count({ where: { status: RefundStatus.PENDING } }),
      this.refundRepository.count({ where: { status: RefundStatus.APPROVED } }),
      this.refundRepository.count({ where: { status: RefundStatus.PROCESSING } }),
      this.refundRepository.count({ where: { status: RefundStatus.COMPLETED } }),
      this.refundRepository.count({ where: { status: RefundStatus.FAILED } }),
    ]);

    // Get total amounts for completed refunds
    const completedRefunds = await this.refundRepository.find({
      where: { status: RefundStatus.COMPLETED },
      select: ['refundAmountCents', 'reversalFeeCents'],
    });

    const totalRefundedAmount = completedRefunds.reduce(
      (sum, r) => sum + Number(r.refundAmountCents),
      0
    ) / 100;

    const totalReversalFees = completedRefunds.reduce(
      (sum, r) => sum + Number(r.reversalFeeCents),
      0
    ) / 100;

    return {
      pending,
      approved,
      processing,
      completed,
      failed,
      totalRefundedAmount,
      totalReversalFees,
    };
  }

  /**
   * Get refunds for a specific user
   */
  async getUserRefunds(userId: string): Promise<RiderRefund[]> {
    return this.refundRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['policy'],
    });
  }
}
