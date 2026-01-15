import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentProvider,
} from '../entities/transaction.entity.js';
import {
  PaymentRequest,
  PaymentRequestStatus,
  MPESA_STK_TIMEOUT_SECONDS,
} from '../entities/payment-request.entity.js';
import { Wallet } from '../entities/wallet.entity.js'; // Used in transaction manager
import { MpesaService, ParsedCallbackData } from './mpesa.service.js';
import { WalletService } from './wallet.service.js';
import { PAYMENT_CONFIG } from '../../../common/constants/index.js';
import { PostingEngineService } from '../../accounting/services/posting-engine.service.js';
import { EscrowService } from '../../accounting/services/escrow.service.js';
import { PAYMENT_AMOUNTS } from '../../accounting/config/posting-rules.config.js';

/**
 * Payment initiation request
 */
export interface InitiatePaymentRequest {
  userId: string;
  phone: string;
  type: TransactionType.DEPOSIT | TransactionType.DAILY_PAYMENT;
  daysCount?: number; // For multi-day payments
  idempotencyKey: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Payment initiation result
 */
export interface InitiatePaymentResult {
  success: boolean;
  paymentRequestId?: string;
  checkoutRequestId?: string;
  amount?: number;
  message: string;
  status?: PaymentRequestStatus;
}

/**
 * Payment callback processing result
 */
export interface CallbackProcessResult {
  success: boolean;
  transactionId?: string;
  paymentRequestId?: string;
  message: string;
  triggeredPolicy?: 'POLICY_1' | 'POLICY_2';
}

/**
 * Payment Service
 * Orchestrates payment flows for deposits and daily payments
 *
 * Per FEAT-PAY-001 and FEAT-PAY-002
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(PaymentRequest)
    private readonly paymentRequestRepository: Repository<PaymentRequest>,
    private readonly mpesaService: MpesaService,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
    private readonly postingEngineService: PostingEngineService,
    private readonly escrowService: EscrowService,
  ) {}

  /**
   * Initiate a payment (deposit or daily)
   * Per FEAT-PAY-001 and FEAT-PAY-002
   */
  async initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    // Check for existing payment with same idempotency key
    const existingRequest = await this.paymentRequestRepository.findOne({
      where: { idempotencyKey: request.idempotencyKey },
    });

    if (existingRequest) {
      // Return cached result for idempotent requests
      return {
        success: existingRequest.isSuccessful(),
        paymentRequestId: existingRequest.id,
        checkoutRequestId: existingRequest.checkoutRequestId,
        amount: existingRequest.getAmountInKes(),
        message: existingRequest.isSuccessful()
          ? 'Payment already processed'
          : existingRequest.isPending()
            ? 'Payment already initiated'
            : 'Previous payment failed',
        status: existingRequest.status,
      };
    }

    // Get or create wallet
    const wallet = await this.walletService.getOrCreateWallet(request.userId);

    // Validate payment type
    let amountCents: number;
    let accountReference: string;
    let transactionDesc: string;
    let daysCount = 1;

    if (request.type === TransactionType.DEPOSIT) {
      const canDeposit = await this.walletService.canMakeDeposit(request.userId);
      if (!canDeposit.allowed) {
        return {
          success: false,
          message: canDeposit.reason ?? 'Cannot make deposit',
        };
      }
      amountCents = PAYMENT_CONFIG.DEPOSIT_AMOUNT * 100;
      accountReference = 'BODA-DEPOSIT';
      transactionDesc = 'BodaInsure Dep';
    } else if (request.type === TransactionType.DAILY_PAYMENT) {
      const canPayDaily = await this.walletService.canMakeDailyPayment(request.userId);
      if (!canPayDaily.allowed) {
        return {
          success: false,
          message: canPayDaily.reason ?? 'Cannot make daily payment',
        };
      }

      // Calculate days count (max remaining days)
      daysCount = Math.min(
        request.daysCount ?? 1,
        canPayDaily.remainingDays ?? 1,
      );

      amountCents = PAYMENT_CONFIG.DAILY_AMOUNT * 100 * daysCount;
      accountReference = `BODA-D${wallet.dailyPaymentsCount + 1}`;
      transactionDesc = daysCount > 1
        ? `BodaIns ${daysCount}days`
        : 'BodaInsure Day';
    } else {
      throw new BadRequestException('Invalid payment type');
    }

    // Create payment request
    const paymentRequest = this.paymentRequestRepository.create({
      userId: request.userId,
      status: PaymentRequestStatus.INITIATED,
      paymentType: request.type,
      amount: amountCents,
      phone: request.phone,
      idempotencyKey: request.idempotencyKey,
      daysCount,
      accountReference,
      transactionDesc,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      expiresAt: new Date(Date.now() + MPESA_STK_TIMEOUT_SECONDS * 1000),
    });

    await this.paymentRequestRepository.save(paymentRequest);

    // Initiate M-Pesa STK Push
    const stkResult = await this.mpesaService.initiateSTKPush({
      phone: request.phone,
      amount: amountCents / 100, // M-Pesa expects KES not cents
      accountReference,
      transactionDesc,
    });

    if (!stkResult.success) {
      // Update request status
      paymentRequest.status = PaymentRequestStatus.FAILED;
      paymentRequest.responseCode = stkResult.errorCode;
      paymentRequest.responseDescription = stkResult.errorMessage;
      await this.paymentRequestRepository.save(paymentRequest);

      return {
        success: false,
        paymentRequestId: paymentRequest.id,
        message: stkResult.errorMessage ?? 'Failed to initiate payment',
      };
    }

    // Update request with M-Pesa response
    paymentRequest.status = PaymentRequestStatus.SENT;
    paymentRequest.checkoutRequestId = stkResult.checkoutRequestId;
    paymentRequest.merchantRequestId = stkResult.merchantRequestId;
    paymentRequest.responseCode = stkResult.responseCode;
    paymentRequest.responseDescription = stkResult.responseDescription;
    await this.paymentRequestRepository.save(paymentRequest);

    this.logger.log(
      `Payment initiated: userId=${request.userId.slice(0, 8)}... type=${request.type} amount=${amountCents / 100} KES`,
    );

    return {
      success: true,
      paymentRequestId: paymentRequest.id,
      checkoutRequestId: stkResult.checkoutRequestId,
      amount: amountCents / 100,
      message: 'Payment initiated. Please complete payment on your phone.',
      status: PaymentRequestStatus.SENT,
    };
  }

  /**
   * Process M-Pesa callback
   *
   * Security: Enhanced validation per P0-002 in mpesa_remediation.md
   * - Validates checkoutRequestId exists in our database
   * - Validates amount matches expected amount (within tolerance)
   * - Validates phone number matches (last 4 digits)
   * - Logs suspicious callbacks for security audit
   */
  async processCallback(callbackData: ParsedCallbackData): Promise<CallbackProcessResult> {
    // Find payment request
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { checkoutRequestId: callbackData.checkoutRequestId },
    });

    // P0-002: Validate payment request exists
    if (!paymentRequest) {
      this.logger.warn(
        `[SECURITY] Callback for unknown checkoutRequestId - potential fraud attempt`,
        {
          checkoutRequestId: callbackData.checkoutRequestId,
          merchantRequestId: callbackData.merchantRequestId,
          amount: callbackData.amount,
          phone: callbackData.phoneNumber ? `***${callbackData.phoneNumber.slice(-4)}` : 'unknown',
          timestamp: new Date().toISOString(),
        },
      );
      return {
        success: false,
        message: 'Payment request not found',
      };
    }

    // P0-002: Validate amount matches (for successful callbacks)
    if (callbackData.isSuccessful && callbackData.amount) {
      const expectedAmountKes = paymentRequest.getAmountInKes();
      const receivedAmountKes = callbackData.amount;
      // Allow 1 KES tolerance for rounding
      if (Math.abs(receivedAmountKes - expectedAmountKes) > 1) {
        this.logger.error(
          `[SECURITY] Amount mismatch in callback - potential fraud attempt`,
          {
            paymentRequestId: paymentRequest.id,
            expectedAmount: expectedAmountKes,
            receivedAmount: receivedAmountKes,
            difference: receivedAmountKes - expectedAmountKes,
            checkoutRequestId: callbackData.checkoutRequestId,
            timestamp: new Date().toISOString(),
          },
        );
        // Don't process - potential fraud attempt
        // Update status to flag for manual review
        paymentRequest.status = PaymentRequestStatus.FAILED;
        paymentRequest.resultDescription = `Amount mismatch: expected ${expectedAmountKes}, received ${receivedAmountKes}`;
        paymentRequest.callbackPayload = callbackData as unknown as Record<string, unknown>;
        await this.paymentRequestRepository.save(paymentRequest);

        return {
          success: false,
          paymentRequestId: paymentRequest.id,
          message: 'Amount validation failed',
        };
      }
    }

    // P0-002: Validate phone number (last 4 digits) for successful callbacks
    if (callbackData.isSuccessful && callbackData.phoneNumber && paymentRequest.phone) {
      const expectedPhoneLast4 = paymentRequest.phone.slice(-4);
      const receivedPhoneLast4 = callbackData.phoneNumber.slice(-4);
      if (expectedPhoneLast4 !== receivedPhoneLast4) {
        this.logger.warn(
          `[SECURITY] Phone number mismatch in callback`,
          {
            paymentRequestId: paymentRequest.id,
            expectedPhoneLast4,
            receivedPhoneLast4,
            checkoutRequestId: callbackData.checkoutRequestId,
            timestamp: new Date().toISOString(),
          },
        );
        // Log but don't reject - phone format may differ slightly
        // This is informational for security monitoring
      }
    }

    // Check if already processed (idempotency)
    if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
      this.logger.debug(
        `Duplicate callback received for already processed payment: ${paymentRequest.id}`,
      );
      return {
        success: true,
        paymentRequestId: paymentRequest.id,
        transactionId: paymentRequest.transactionId ?? undefined,
        message: 'Payment already processed',
      };
    }

    // Update payment request with callback data
    paymentRequest.callbackReceivedAt = new Date();
    paymentRequest.resultCode = String(callbackData.resultCode);
    paymentRequest.resultDescription = callbackData.resultDesc;

    // Calculate and log callback delay for monitoring (Phase 8: Monitoring Enhancements)
    const callbackDelaySeconds = Math.floor(
      (paymentRequest.callbackReceivedAt.getTime() - paymentRequest.createdAt.getTime()) / 1000
    );
    const isDelayedCallback = callbackDelaySeconds > 60;

    this.logger.log({
      event: 'payment_callback_received',
      paymentRequestId: paymentRequest.id,
      callbackDelaySeconds,
      isDelayedCallback,
      resultCode: callbackData.resultCode,
      isSuccessful: callbackData.isSuccessful,
      mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
      paymentType: paymentRequest.paymentType,
    });
    paymentRequest.callbackPayload = callbackData as unknown as Record<string, unknown>;

    if (!callbackData.isSuccessful) {
      // Payment failed
      paymentRequest.status = this.mapResultCodeToStatus(callbackData.resultCode);
      await this.paymentRequestRepository.save(paymentRequest);

      this.logger.log(
        `Payment failed: requestId=${paymentRequest.id.slice(0, 8)}... code=${callbackData.resultCode}`,
      );

      return {
        success: false,
        paymentRequestId: paymentRequest.id,
        message: callbackData.resultDesc,
      };
    }

    // Payment successful - process in transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const txnRepo = manager.getRepository(Transaction);
      const walletRepo = manager.getRepository(Wallet);
      const requestRepo = manager.getRepository(PaymentRequest);

      // Get wallet with lock
      const wallet = await walletRepo.findOne({
        where: { userId: paymentRequest.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Create transaction record
      const transaction = txnRepo.create({
        userId: paymentRequest.userId,
        walletId: wallet.id,
        type: paymentRequest.paymentType,
        status: TransactionStatus.COMPLETED,
        provider: PaymentProvider.MPESA,
        amount: paymentRequest.amount,
        currency: 'KES',
        phone: paymentRequest.phone,
        mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
        mpesaCheckoutRequestId: callbackData.checkoutRequestId,
        mpesaMerchantRequestId: callbackData.merchantRequestId,
        idempotencyKey: paymentRequest.idempotencyKey,
        daysCount: paymentRequest.daysCount,
        resultCode: String(callbackData.resultCode),
        resultDescription: callbackData.resultDesc,
        completedAt: new Date(),
        ipAddress: paymentRequest.ipAddress,
      });

      // Update wallet and determine if policy should be triggered
      let triggeredPolicy: 'POLICY_1' | 'POLICY_2' | undefined;

      if (paymentRequest.paymentType === TransactionType.DEPOSIT) {
        wallet.balance = Number(wallet.balance) + Number(paymentRequest.amount);
        wallet.totalDeposited = Number(wallet.totalDeposited) + Number(paymentRequest.amount);
        wallet.depositCompleted = true;
        wallet.depositCompletedAt = new Date();

        transaction.description = 'Initial deposit payment';
        triggeredPolicy = 'POLICY_1';

        this.logger.log(`Deposit completed for user ${paymentRequest.userId.slice(0, 8)}... - Policy 1 triggered`);
      } else if (paymentRequest.paymentType === TransactionType.DAILY_PAYMENT) {
        wallet.balance = Number(wallet.balance) + Number(paymentRequest.amount);
        wallet.totalDeposited = Number(wallet.totalDeposited) + Number(paymentRequest.amount);

        const previousCount = wallet.dailyPaymentsCount;
        wallet.dailyPaymentsCount = Math.min(
          previousCount + paymentRequest.daysCount,
          PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS,
        );
        wallet.lastDailyPaymentAt = new Date();

        transaction.dailyPaymentNumber = wallet.dailyPaymentsCount;
        transaction.description = paymentRequest.daysCount > 1
          ? `Daily payments (${previousCount + 1}-${wallet.dailyPaymentsCount})`
          : `Daily payment #${wallet.dailyPaymentsCount}`;

        // Check if 30th payment
        if (!wallet.dailyPaymentsCompleted && wallet.dailyPaymentsCount >= PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS) {
          wallet.dailyPaymentsCompleted = true;
          wallet.dailyPaymentsCompletedAt = new Date();
          triggeredPolicy = 'POLICY_2';

          this.logger.log(`All daily payments completed for user ${paymentRequest.userId.slice(0, 8)}... - Policy 2 triggered`);
        }
      }

      await walletRepo.save(wallet);
      await txnRepo.save(transaction);

      // Update payment request
      paymentRequest.status = PaymentRequestStatus.COMPLETED;
      paymentRequest.mpesaReceiptNumber = callbackData.mpesaReceiptNumber;
      paymentRequest.transactionId = transaction.id;
      await requestRepo.save(paymentRequest);

      this.logger.log(
        `Payment completed: txnId=${transaction.id.slice(0, 8)}... receipt=${callbackData.mpesaReceiptNumber}`,
      );

      return {
        success: true,
        transactionId: transaction.id,
        paymentRequestId: paymentRequest.id,
        message: 'Payment processed successfully',
        triggeredPolicy,
        // Include data needed for posting and escrow
        _postingData: {
          userId: paymentRequest.userId,
          paymentType: paymentRequest.paymentType,
          amountCents: paymentRequest.amount,
          daysCount: paymentRequest.daysCount,
          mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
          // For escrow tracking - payment day (1 for deposit, else daily payment number)
          paymentDay: paymentRequest.paymentType === TransactionType.DEPOSIT
            ? 1
            : wallet.dailyPaymentsCount - paymentRequest.daysCount + 1, // First day of batch
        },
      };
    });

    // Post journal entry after transaction commits (outside transaction for isolation)
    // This is idempotent - safe to call on retries from UI or duplicate callbacks
    if (result.success && result.transactionId) {
      try {
        const postingResult = await this.postingEngineService.postPaymentReceipt({
          transactionId: result.transactionId,
          userId: result._postingData.userId,
          paymentType: result._postingData.paymentType === TransactionType.DEPOSIT ? 'DEPOSIT' : 'DAILY_PAYMENT',
          amountCents: result._postingData.amountCents,
          daysCount: result._postingData.daysCount,
          mpesaReceiptNumber: result._postingData.mpesaReceiptNumber,
        });

        if (postingResult.success) {
          this.logger.log(
            `Journal entry ${postingResult.alreadyPosted ? 'already exists' : 'created'}: ${postingResult.entryNumber}`,
          );
        } else {
          // Log warning but don't fail the payment - posting can be retried
          this.logger.warn(
            `Failed to post journal entry for transaction ${result.transactionId.slice(0, 8)}...: ${postingResult.message}`,
          );
        }
      } catch (postingError) {
        // Log error but don't fail the payment - posting can be retried
        this.logger.error(
          `Error posting journal entry for transaction ${result.transactionId.slice(0, 8)}...`,
          postingError,
        );
      }

      // Create escrow record for premium tracking (Epic 5)
      // This is idempotent - safe to call on retries from UI or duplicate callbacks
      try {
        // Calculate premium and service fee amounts based on payment type
        const isDeposit = result._postingData.paymentType === TransactionType.DEPOSIT;
        const daysCount = result._postingData.daysCount;

        // Premium amounts per Accounting_Remediation.md
        const premiumAmountCents = isDeposit
          ? PAYMENT_AMOUNTS.DAY1_PREMIUM
          : PAYMENT_AMOUNTS.DAILY_PREMIUM * daysCount;

        // Service fees (total across all fee types)
        const serviceFeePerDay = PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM
          + PAYMENT_AMOUNTS.SERVICE_FEE_KBA
          + PAYMENT_AMOUNTS.SERVICE_FEE_ROBS;
        const serviceFeeAmountCents = isDeposit
          ? serviceFeePerDay
          : serviceFeePerDay * daysCount;

        const escrowRecord = await this.escrowService.createEscrowRecord({
          riderId: result._postingData.userId,
          transactionId: result.transactionId,
          paymentDay: result._postingData.paymentDay,
          premiumAmountCents,
          serviceFeeAmountCents,
        });

        this.logger.log(
          `Escrow record ${escrowRecord.id ? 'created' : 'already exists'}: type=${escrowRecord.escrowType} premium=${escrowRecord.getPremiumInKes()} KES`,
        );
      } catch (escrowError) {
        // Log error but don't fail the payment - escrow can be created manually if needed
        this.logger.error(
          `Error creating escrow record for transaction ${result.transactionId.slice(0, 8)}...`,
          escrowError,
        );
      }
    }

    // Return the result without internal posting data
    const { _postingData, ...callbackResult } = result;
    return callbackResult;
  }

  /**
   * Get payment request by ID
   */
  async getPaymentRequest(requestId: string): Promise<PaymentRequest | null> {
    return this.paymentRequestRepository.findOne({
      where: { id: requestId },
    });
  }

  /**
   * Get payment request by checkout request ID
   */
  async getPaymentRequestByCheckoutId(checkoutRequestId: string): Promise<PaymentRequest | null> {
    return this.paymentRequestRepository.findOne({
      where: { checkoutRequestId },
    });
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      type?: TransactionType;
    },
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('txn')
      .where('txn.user_id = :userId', { userId })
      .andWhere('txn.status = :status', { status: TransactionStatus.COMPLETED });

    if (options?.type) {
      queryBuilder.andWhere('txn.type = :type', { type: options.type });
    }

    const [transactions, total] = await queryBuilder
      .orderBy('txn.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { transactions, total };
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id: transactionId },
    });
  }

  /**
   * Expire stale payment requests
   * Called by scheduler
   */
  async expireStaleRequests(): Promise<number> {
    const result = await this.paymentRequestRepository.update(
      {
        status: PaymentRequestStatus.SENT,
        expiresAt: LessThan(new Date()),
      },
      {
        status: PaymentRequestStatus.TIMEOUT,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} stale payment requests`);
    }

    return result.affected ?? 0;
  }

  /**
   * Map M-Pesa result code to payment request status
   */
  private mapResultCodeToStatus(resultCode: number): PaymentRequestStatus {
    switch (resultCode) {
      case 0:
        return PaymentRequestStatus.COMPLETED;
      case 1032: // Cancelled by user
        return PaymentRequestStatus.CANCELLED;
      case 1037: // Timeout
      case 1036: // Insufficient balance (no PIN entered)
        return PaymentRequestStatus.TIMEOUT;
      default:
        return PaymentRequestStatus.FAILED;
    }
  }

  /**
   * Check if M-Pesa is available
   */
  isMpesaConfigured(): boolean {
    return this.mpesaService.isConfigured();
  }

  /**
   * Refresh payment status by querying M-Pesa directly
   *
   * Per P1-004 in mpesa_remediation.md
   *
   * Use when a callback may have been missed. Queries M-Pesa
   * for the current status and updates the payment request accordingly.
   *
   * @param requestId - Payment request ID
   * @param userId - User ID (for ownership validation)
   */
  async refreshPaymentStatus(
    requestId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    status: string;
    message: string;
    mpesaReceiptNumber?: string;
  }> {
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Payment request not found');
    }

    // Verify ownership
    if (paymentRequest.userId !== userId) {
      throw new NotFoundException('Payment request not found');
    }

    // If already in final state, return current status
    if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
      return {
        success: true,
        status: paymentRequest.status,
        message: 'Payment already completed',
        mpesaReceiptNumber: paymentRequest.mpesaReceiptNumber ?? undefined,
      };
    }

    if (paymentRequest.status === PaymentRequestStatus.FAILED ||
        paymentRequest.status === PaymentRequestStatus.CANCELLED ||
        paymentRequest.status === PaymentRequestStatus.TIMEOUT) {
      return {
        success: false,
        status: paymentRequest.status,
        message: paymentRequest.resultDescription ?? 'Payment failed',
      };
    }

    // Only query M-Pesa if in SENT status (waiting for callback)
    if (paymentRequest.status !== PaymentRequestStatus.SENT) {
      return {
        success: false,
        status: paymentRequest.status,
        message: 'Payment not in queryable state',
      };
    }

    // Check if we have a checkout request ID
    if (!paymentRequest.checkoutRequestId) {
      return {
        success: false,
        status: paymentRequest.status,
        message: 'No checkout request ID available',
      };
    }

    // Query M-Pesa for status
    this.logger.log(`Querying M-Pesa for payment status: ${requestId.slice(0, 8)}...`);
    const queryResult = await this.mpesaService.querySTKStatus(paymentRequest.checkoutRequestId);

    if (!queryResult.success) {
      // Query failed but doesn't mean payment failed
      return {
        success: false,
        status: paymentRequest.status,
        message: queryResult.errorMessage ?? 'Could not query M-Pesa',
      };
    }

    // Process the query result
    if (queryResult.resultCode === '0') {
      // Payment successful - simulate callback processing
      const callbackData = {
        merchantRequestId: paymentRequest.merchantRequestId ?? '',
        checkoutRequestId: paymentRequest.checkoutRequestId,
        resultCode: 0,
        resultDesc: queryResult.resultDesc ?? 'Success',
        isSuccessful: true,
        mpesaReceiptNumber: queryResult.mpesaReceiptNumber,
        amount: paymentRequest.getAmountInKes(),
        phoneNumber: paymentRequest.phone,
      };

      const result = await this.processCallback(callbackData);

      return {
        success: result.success,
        status: PaymentRequestStatus.COMPLETED,
        message: 'Payment completed',
        mpesaReceiptNumber: queryResult.mpesaReceiptNumber,
      };
    } else {
      // Payment failed or still pending
      const resultCode = parseInt(queryResult.resultCode ?? '1', 10);
      const newStatus = this.mapResultCodeToStatus(resultCode);

      // Update payment request if status changed
      if (newStatus !== PaymentRequestStatus.SENT) {
        paymentRequest.status = newStatus;
        paymentRequest.resultCode = queryResult.resultCode;
        paymentRequest.resultDescription = queryResult.resultDesc;
        await this.paymentRequestRepository.save(paymentRequest);
      }

      return {
        success: false,
        status: newStatus,
        message: queryResult.resultDesc ?? 'Payment not completed',
      };
    }
  }

  /**
   * Poll stale payment requests
   *
   * Per P1-004 in mpesa_remediation.md
   *
   * Finds payment requests in SENT status older than the specified age
   * and queries M-Pesa for their current status.
   *
   * @param maxAgeMinutes - Maximum age of requests to poll (default: 3 minutes)
   * @param limit - Maximum number of requests to poll per run (default: 10)
   */
  async pollStalePaymentRequests(
    maxAgeMinutes: number = 3,
    limit: number = 10,
  ): Promise<{ polled: number; updated: number; errors: number }> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    // Find stale requests
    const staleRequests = await this.paymentRequestRepository.find({
      where: {
        status: PaymentRequestStatus.SENT,
        createdAt: LessThan(cutoffTime),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    if (staleRequests.length === 0) {
      return { polled: 0, updated: 0, errors: 0 };
    }

    this.logger.log(`Polling ${staleRequests.length} stale payment requests`);

    let updated = 0;
    let errors = 0;

    for (const request of staleRequests) {
      try {
        if (!request.checkoutRequestId) {
          // No checkout ID, mark as failed
          request.status = PaymentRequestStatus.FAILED;
          request.resultDescription = 'No checkout request ID - cannot query status';
          await this.paymentRequestRepository.save(request);
          updated++;
          continue;
        }

        // Query M-Pesa
        const queryResult = await this.mpesaService.querySTKStatus(request.checkoutRequestId);

        if (queryResult.resultCode === '0') {
          // Success - process as callback
          const callbackData = {
            merchantRequestId: request.merchantRequestId ?? '',
            checkoutRequestId: request.checkoutRequestId,
            resultCode: 0,
            resultDesc: queryResult.resultDesc ?? 'Success',
            isSuccessful: true,
            mpesaReceiptNumber: queryResult.mpesaReceiptNumber,
            amount: request.getAmountInKes(),
            phoneNumber: request.phone,
          };

          await this.processCallback(callbackData);
          updated++;

          this.logger.log(
            `Stale payment resolved: ${request.id.slice(0, 8)}... -> COMPLETED`,
          );
        } else if (queryResult.resultCode) {
          // Failed or cancelled
          const resultCode = parseInt(queryResult.resultCode, 10);
          request.status = this.mapResultCodeToStatus(resultCode);
          request.resultCode = queryResult.resultCode;
          request.resultDescription = queryResult.resultDesc;
          await this.paymentRequestRepository.save(request);
          updated++;

          this.logger.log(
            `Stale payment resolved: ${request.id.slice(0, 8)}... -> ${request.status}`,
          );
        }
        // If queryResult has no resultCode, the query failed - leave as SENT for next poll

      } catch (error) {
        this.logger.error(
          `Error polling payment request ${request.id.slice(0, 8)}...`,
          error,
        );
        errors++;
      }
    }

    this.logger.log(
      `Stale payment polling complete: polled=${staleRequests.length} updated=${updated} errors=${errors}`,
    );

    return {
      polled: staleRequests.length,
      updated,
      errors,
    };
  }

  /**
   * Process B2C (refund) callback from M-Pesa
   *
   * Per P1-001 in mpesa_remediation.md
   *
   * @param callbackData - Parsed B2C callback data
   */
  async processB2cCallback(callbackData: import('./mpesa.service.js').ParsedB2cCallbackData): Promise<{ success: boolean; message: string }> {
    // Find refund transaction by originatorConversationId
    const transaction = await this.transactionRepository.findOne({
      where: {
        type: TransactionType.REFUND,
        mpesaMerchantRequestId: callbackData.originatorConversationId,
      },
    });

    if (!transaction) {
      this.logger.warn(
        `[SECURITY] B2C callback for unknown originatorConversationId: ${callbackData.originatorConversationId}`,
        {
          conversationId: callbackData.conversationId,
          resultCode: callbackData.resultCode,
        },
      );
      return {
        success: false,
        message: 'Refund transaction not found',
      };
    }

    // Check if already processed
    if (transaction.status === TransactionStatus.COMPLETED || transaction.status === TransactionStatus.FAILED) {
      this.logger.debug(`B2C callback already processed for transaction: ${transaction.id}`);
      return {
        success: true,
        message: 'Refund already processed',
      };
    }

    // Update transaction based on result
    if (callbackData.isSuccessful) {
      transaction.status = TransactionStatus.COMPLETED;
      transaction.mpesaReceiptNumber = callbackData.transactionReceipt;
      transaction.completedAt = new Date();
      transaction.resultCode = String(callbackData.resultCode);
      transaction.resultDescription = callbackData.resultDesc;

      this.logger.log(
        `B2C refund completed: txnId=${transaction.id.slice(0, 8)}... receipt=${callbackData.transactionReceipt}`,
      );
    } else {
      transaction.status = TransactionStatus.FAILED;
      transaction.resultCode = String(callbackData.resultCode);
      transaction.resultDescription = callbackData.resultDesc;

      this.logger.warn(
        `B2C refund failed: txnId=${transaction.id.slice(0, 8)}... code=${callbackData.resultCode} desc=${callbackData.resultDesc}`,
      );
    }

    await this.transactionRepository.save(transaction);

    return {
      success: true,
      message: callbackData.isSuccessful ? 'Refund completed' : 'Refund failed',
    };
  }

  /**
   * Process B2C timeout callback from M-Pesa
   *
   * Per P1-001 in mpesa_remediation.md
   *
   * @param originatorConversationId - The originator conversation ID from the B2C request
   */
  async processB2cTimeout(originatorConversationId: string): Promise<{ success: boolean; message: string }> {
    // Find refund transaction by originatorConversationId
    const transaction = await this.transactionRepository.findOne({
      where: {
        type: TransactionType.REFUND,
        mpesaMerchantRequestId: originatorConversationId,
      },
    });

    if (!transaction) {
      this.logger.warn(
        `B2C timeout for unknown originatorConversationId: ${originatorConversationId}`,
      );
      return {
        success: false,
        message: 'Refund transaction not found',
      };
    }

    // Check if already processed
    if (transaction.status === TransactionStatus.COMPLETED || transaction.status === TransactionStatus.FAILED) {
      this.logger.debug(`B2C timeout received but transaction already processed: ${transaction.id}`);
      return {
        success: true,
        message: 'Refund already processed',
      };
    }

    // Mark as timeout - can be retried
    transaction.status = TransactionStatus.PENDING; // Keep pending for retry
    transaction.resultDescription = 'B2C request timed out - pending retry';

    await this.transactionRepository.save(transaction);

    this.logger.warn(
      `B2C refund timeout: txnId=${transaction.id.slice(0, 8)}... - marked for retry`,
    );

    return {
      success: true,
      message: 'Refund timeout processed - pending retry',
    };
  }

  // ============================================================
  // Phase 3: Progressive Timeout Handling
  // ============================================================

  /**
   * Get payment status with detailed delay information
   *
   * Provides enhanced status info including whether the payment is delayed,
   * how long the delay is, and recommended actions for the user.
   *
   * @param requestId - Payment request ID
   * @param userId - User ID (for ownership validation)
   */
  async getPaymentStatusWithDelayInfo(
    requestId: string,
    userId: string,
  ): Promise<{
    status: PaymentRequestStatus;
    isDelayed: boolean;
    delaySeconds?: number;
    recommendedAction: 'wait' | 'refresh' | 'contact_support';
    message: string;
    mpesaReceiptNumber?: string;
    resultCode?: string;
  }> {
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Payment request not found');
    }

    // Verify ownership
    if (paymentRequest.userId !== userId) {
      throw new NotFoundException('Payment request not found');
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - paymentRequest.createdAt.getTime()) / 1000
    );

    // Handle completed payments
    if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
      return {
        status: paymentRequest.status,
        isDelayed: false,
        message: 'Payment completed successfully',
        recommendedAction: 'wait',
        mpesaReceiptNumber: paymentRequest.mpesaReceiptNumber ?? undefined,
      };
    }

    // Handle failed/cancelled/timeout payments
    if (paymentRequest.status === PaymentRequestStatus.FAILED ||
        paymentRequest.status === PaymentRequestStatus.CANCELLED ||
        paymentRequest.status === PaymentRequestStatus.TIMEOUT) {
      return {
        status: paymentRequest.status,
        isDelayed: false,
        message: paymentRequest.resultDescription ?? 'Payment failed',
        recommendedAction: 'wait',
        resultCode: paymentRequest.resultCode ?? undefined,
      };
    }

    // Payment is still in SENT status - check if delayed
    const isDelayed = elapsedSeconds > 60;

    let recommendedAction: 'wait' | 'refresh' | 'contact_support' = 'wait';
    let message = 'Payment is being processed';

    if (isDelayed) {
      if (elapsedSeconds < 180) {
        // 1-3 minutes
        recommendedAction = 'refresh';
        message = 'Payment is taking longer than expected. We are checking with M-Pesa.';
      } else if (elapsedSeconds < 600) {
        // 3-10 minutes
        recommendedAction = 'refresh';
        message = 'Payment confirmation delayed. Please check your M-Pesa messages.';
      } else {
        // > 10 minutes
        recommendedAction = 'contact_support';
        message = 'Payment status uncertain. Please contact support with your M-Pesa receipt.';
      }

      // Log delayed payment for monitoring
      this.logger.warn({
        event: 'payment_delayed',
        paymentRequestId: requestId,
        delaySeconds: elapsedSeconds,
        userId: userId.slice(0, 8) + '...',
      });
    }

    return {
      status: paymentRequest.status,
      isDelayed,
      delaySeconds: isDelayed ? elapsedSeconds : undefined,
      recommendedAction,
      message,
    };
  }

  // ============================================================
  // Phase 5: Enqueue Delayed Payments
  // ============================================================

  /**
   * Enqueue a payment for delayed/background processing
   *
   * Called when frontend polling times out and payment is still pending.
   * Adds the payment to a monitoring queue for background resolution.
   *
   * @param requestId - Payment request ID
   * @param userId - User ID (for ownership validation)
   */
  async enqueueForDelayedProcessing(
    requestId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string; queuedAt?: string }> {
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!paymentRequest) {
      throw new NotFoundException('Payment request not found');
    }

    // Verify ownership
    if (paymentRequest.userId !== userId) {
      throw new NotFoundException('Payment request not found');
    }

    // Only enqueue if still in SENT status
    if (paymentRequest.status !== PaymentRequestStatus.SENT) {
      this.logger.debug(
        `Payment ${requestId.slice(0, 8)}... not in SENT status (${paymentRequest.status}), skipping queue`
      );
      return {
        success: true,
        message: `Payment is in ${paymentRequest.status} status`,
      };
    }

    // Check if already queued (prevent duplicate queueing)
    if (paymentRequest.metadata?.queuedForDelayedProcessing) {
      return {
        success: true,
        message: 'Payment already queued for monitoring',
        queuedAt: paymentRequest.metadata.queuedAt as string,
      };
    }

    // Mark as queued in metadata
    const now = new Date().toISOString();
    paymentRequest.metadata = {
      ...paymentRequest.metadata,
      queuedForDelayedProcessing: true,
      queuedAt: now,
    };
    await this.paymentRequestRepository.save(paymentRequest);

    this.logger.log({
      event: 'payment_enqueued_for_monitoring',
      paymentRequestId: requestId,
      userId: userId.slice(0, 8) + '...',
      queuedAt: now,
    });

    return {
      success: true,
      message: 'Payment queued for background monitoring',
      queuedAt: now,
    };
  }
}
