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
   */
  async processCallback(callbackData: ParsedCallbackData): Promise<CallbackProcessResult> {
    // Find payment request
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { checkoutRequestId: callbackData.checkoutRequestId },
    });

    if (!paymentRequest) {
      this.logger.warn(
        `Callback for unknown checkoutRequestId: ${callbackData.checkoutRequestId}`,
      );
      return {
        success: false,
        message: 'Payment request not found',
      };
    }

    // Check if already processed
    if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
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
    return this.dataSource.transaction(async (manager) => {
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
      };
    });
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
}
