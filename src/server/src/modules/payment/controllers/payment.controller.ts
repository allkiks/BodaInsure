import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { MpesaCallbackGuard } from '../../../common/guards/mpesa-callback.guard.js';
import { CurrentUser } from '../../identity/decorators/current-user.decorator.js';
import { PaymentService } from '../services/payment.service.js';
import { WalletService } from '../services/wallet.service.js';
import { MpesaService } from '../services/mpesa.service.js';
import { KycService } from '../../kyc/services/kyc.service.js';
import type { MpesaCallbackBody } from '../services/mpesa.service.js';
import { TransactionType } from '../entities/transaction.entity.js';
import {
  InitiateDepositDto,
  InitiateDailyPaymentDto,
  InitiatePaymentResponseDto,
  PaymentStatusResponseDto,
} from '../dto/initiate-payment.dto.js';
import {
  WalletBalanceResponseDto,
  PaymentProgressResponseDto,
  PaymentEligibilityResponseDto,
} from '../dto/wallet.dto.js';

/**
 * Authenticated user payload from JWT
 */
interface AuthenticatedUser {
  userId: string;
  phone: string;
}

/**
 * Payment Controller
 * Handles payment initiation, status, and wallet operations
 *
 * Per FEAT-PAY-001, FEAT-PAY-002, FEAT-PAY-003
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly kycService: KycService,
  ) {}

  /**
   * Initiate deposit payment (1,048 KES)
   * Per FEAT-PAY-001
   */
  @Post('deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate deposit payment',
    description: 'Initiates M-Pesa STK push for the initial 1,048 KES deposit',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: InitiatePaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or cannot make deposit' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Deposit already completed' })
  async initiateDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateDepositDto,
    @Req() req: Request,
  ): Promise<InitiatePaymentResponseDto> {
    // Check KYC status before allowing payment
    const canProceed = await this.kycService.canProceedToPayment(user.userId);
    if (!canProceed) {
      throw new ForbiddenException(
        'KYC verification must be completed before making payments. Please upload and get all required documents approved.',
      );
    }

    this.logger.log(`Deposit initiated: userId=${user.userId.slice(0, 8)}...`);

    const result = await this.paymentService.initiatePayment({
      userId: user.userId,
      phone: dto.phone,
      type: TransactionType.DEPOSIT,
      idempotencyKey: dto.idempotencyKey,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: result.success,
      paymentRequestId: result.paymentRequestId,
      checkoutRequestId: result.checkoutRequestId,
      amount: result.amount,
      message: result.message,
      status: result.status,
    };
  }

  /**
   * Initiate daily payment (87 KES per day)
   * Per FEAT-PAY-002
   */
  @Post('daily')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate daily payment',
    description: 'Initiates M-Pesa STK push for daily payment(s). Can pay multiple days at once.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: InitiatePaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or cannot make payment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'All daily payments completed or deposit not made' })
  async initiateDailyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateDailyPaymentDto,
    @Req() req: Request,
  ): Promise<InitiatePaymentResponseDto> {
    // Check KYC status before allowing payment
    const canProceed = await this.kycService.canProceedToPayment(user.userId);
    if (!canProceed) {
      throw new ForbiddenException(
        'KYC verification must be completed before making payments. Please upload and get all required documents approved.',
      );
    }

    this.logger.log(
      `Daily payment initiated: userId=${user.userId.slice(0, 8)}... days=${dto.daysCount ?? 1}`,
    );

    const result = await this.paymentService.initiatePayment({
      userId: user.userId,
      phone: dto.phone,
      type: TransactionType.DAILY_PAYMENT,
      daysCount: dto.daysCount,
      idempotencyKey: dto.idempotencyKey,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: result.success,
      paymentRequestId: result.paymentRequestId,
      checkoutRequestId: result.checkoutRequestId,
      amount: result.amount,
      message: result.message,
      status: result.status,
    };
  }

  /**
   * Get payment request status
   */
  @Get('status/:requestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Check the status of a payment request',
  })
  @ApiParam({ name: 'requestId', description: 'Payment request ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment request not found' })
  async getPaymentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<PaymentStatusResponseDto> {
    const paymentRequest = await this.paymentService.getPaymentRequest(requestId);

    if (!paymentRequest) {
      throw new NotFoundException('Payment request not found');
    }

    // Verify ownership
    if (paymentRequest.userId !== user.userId) {
      throw new NotFoundException('Payment request not found');
    }

    return {
      paymentRequestId: paymentRequest.id,
      status: paymentRequest.status,
      transactionId: paymentRequest.transactionId ?? undefined,
      mpesaReceiptNumber: paymentRequest.mpesaReceiptNumber ?? undefined,
      amount: paymentRequest.getAmountInKes(),
      type: paymentRequest.paymentType,
      failureReason: paymentRequest.resultDescription ?? undefined,
      // GAP-007: Include resultCode for specific M-Pesa error messages on frontend
      resultCode: paymentRequest.resultCode ?? undefined,
      createdAt: paymentRequest.createdAt,
    };
  }

  /**
   * Refresh payment status by querying M-Pesa
   *
   * Per P1-004 in mpesa_remediation.md
   *
   * Use this when a callback may have been missed.
   * Queries M-Pesa directly for the current transaction status.
   */
  @Post('status/:requestId/refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refresh payment status',
    description: 'Query M-Pesa directly to refresh payment status (use when callback may be missed)',
  })
  @ApiParam({ name: 'requestId', description: 'Payment request ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment status refreshed',
  })
  @ApiResponse({ status: 404, description: 'Payment request not found' })
  async refreshPaymentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<{
    success: boolean;
    status: string;
    message: string;
    mpesaReceiptNumber?: string;
  }> {
    const result = await this.paymentService.refreshPaymentStatus(requestId, user.userId);
    return result;
  }

  /**
   * Check if user can make deposit
   */
  @Get('eligibility/deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check deposit eligibility',
    description: 'Check if user can make initial deposit payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligibility status',
    type: PaymentEligibilityResponseDto,
  })
  async checkDepositEligibility(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentEligibilityResponseDto> {
    // Check KYC status first
    const canProceed = await this.kycService.canProceedToPayment(user.userId);
    if (!canProceed) {
      return {
        allowed: false,
        reason: 'KYC verification must be completed before making payments',
      };
    }

    const result = await this.walletService.canMakeDeposit(user.userId);
    return {
      allowed: result.allowed,
      reason: result.reason,
    };
  }

  /**
   * Check if user can make daily payment
   */
  @Get('eligibility/daily')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check daily payment eligibility',
    description: 'Check if user can make daily payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligibility status',
    type: PaymentEligibilityResponseDto,
  })
  async checkDailyEligibility(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentEligibilityResponseDto> {
    // Check KYC status first
    const canProceed = await this.kycService.canProceedToPayment(user.userId);
    if (!canProceed) {
      return {
        allowed: false,
        reason: 'KYC verification must be completed before making payments',
      };
    }

    const result = await this.walletService.canMakeDailyPayment(user.userId);
    return {
      allowed: result.allowed,
      reason: result.reason,
      remainingDays: result.remainingDays,
    };
  }
}

/**
 * Wallet Controller
 * Handles wallet balance and progress queries
 *
 * Per FEAT-PAY-003
 */
@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Get wallet summary with balance and recent transactions
   */
  @Get()
  @ApiOperation({
    summary: 'Get wallet summary',
    description: 'Get wallet balance, progress, and recent transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet summary retrieved',
  })
  async getWalletSummary(@CurrentUser() user: AuthenticatedUser): Promise<{
    data: {
      wallet: {
        id: string;
        userId: string;
        balance: number;
        totalDeposited: number;
        totalDailyPayments: number;
        daysCompleted: number;
        createdAt: Date;
        updatedAt: Date;
      };
      recentTransactions: Array<{
        id: string;
        type: string;
        amount: number;
        status: string;
        createdAt: Date;
      }>;
    };
  }> {
    const wallet = await this.walletService.getOrCreateWallet(user.userId);
    const { transactions } = await this.paymentService.getTransactionHistory(user.userId, {
      page: 1,
      limit: 5,
    });

    return {
      data: {
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          balance: wallet.getBalanceInKes(),
          totalDeposited: Number(wallet.totalDeposited) / 100,
          totalDailyPayments: wallet.dailyPaymentsCount * 87,
          daysCompleted: wallet.dailyPaymentsCount,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        },
        recentTransactions: transactions.map((txn) => ({
          id: txn.id,
          type: txn.type,
          amount: txn.getAmountInKes(),
          status: txn.status,
          createdAt: txn.createdAt,
        })),
      },
    };
  }

  /**
   * Get wallet balance
   */
  @Get('balance')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Get current wallet balance and payment counts',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved',
    type: WalletBalanceResponseDto,
  })
  async getBalance(@CurrentUser() user: AuthenticatedUser): Promise<WalletBalanceResponseDto> {
    const balance = await this.walletService.getBalance(user.userId);
    return {
      balance: balance.balance,
      currency: balance.currency,
      depositCompleted: balance.depositCompleted,
      dailyPaymentsCount: balance.dailyPaymentsCount,
      dailyPaymentsRemaining: balance.dailyPaymentsRemaining,
      dailyPaymentsCompleted: balance.dailyPaymentsCompleted,
    };
  }

  /**
   * Get payment progress
   */
  @Get('progress')
  @ApiOperation({
    summary: 'Get payment progress',
    description: 'Get detailed payment progress including policy eligibility',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment progress retrieved',
    type: PaymentProgressResponseDto,
  })
  async getProgress(@CurrentUser() user: AuthenticatedUser): Promise<PaymentProgressResponseDto> {
    return this.walletService.getPaymentProgress(user.userId);
  }

  /**
   * Get wallet transaction history
   */
  @Get('transactions')
  @ApiOperation({
    summary: 'Get wallet transactions',
    description: 'Get paginated list of wallet transactions',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ['DEPOSIT', 'DAILY_PAYMENT'] })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved',
  })
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ): Promise<{
    data: Array<{
      id: string;
      type: string;
      amount: number;
      currency: string;
      status: string;
      mpesaReceiptNumber: string | null;
      createdAt: Date;
    }>;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    let transactionType: TransactionType | undefined;
    if (type === 'DEPOSIT') {
      transactionType = TransactionType.DEPOSIT;
    } else if (type === 'DAILY_PAYMENT') {
      transactionType = TransactionType.DAILY_PAYMENT;
    }

    const { transactions, total } = await this.paymentService.getTransactionHistory(user.userId, {
      page: pageNum,
      limit: limitNum,
      type: transactionType,
    });

    return {
      data: transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.getAmountInKes(),
        currency: txn.currency,
        status: txn.status,
        mpesaReceiptNumber: txn.mpesaReceiptNumber ?? null,
        createdAt: txn.createdAt,
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

/**
 * Transaction Controller
 * Handles transaction history queries
 */
@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Get transaction history
   */
  @Get()
  @ApiOperation({
    summary: 'Get transaction history',
    description: 'Get paginated list of completed transactions',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'type', required: false, enum: ['DEPOSIT', 'DAILY_PAYMENT'], description: 'Filter by transaction type' })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved',
  })
  async getTransactionHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ): Promise<{
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      currency: string;
      status: string;
      mpesaReceiptNumber: string | null;
      description: string | null;
      createdAt: Date;
      completedAt: Date | null;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    let transactionType: TransactionType | undefined;
    if (type === 'DEPOSIT') {
      transactionType = TransactionType.DEPOSIT;
    } else if (type === 'DAILY_PAYMENT') {
      transactionType = TransactionType.DAILY_PAYMENT;
    }

    const { transactions, total } = await this.paymentService.getTransactionHistory(user.userId, {
      page: pageNum,
      limit: limitNum,
      type: transactionType,
    });

    return {
      transactions: transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.getAmountInKes(),
        currency: txn.currency,
        status: txn.status,
        mpesaReceiptNumber: txn.mpesaReceiptNumber ?? null,
        description: txn.description ?? null,
        createdAt: txn.createdAt,
        completedAt: txn.completedAt ?? null,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }
}

/**
 * M-Pesa Callback Controller
 * Handles webhooks from M-Pesa
 *
 * Per FEAT-PAY-001
 */
@ApiTags('M-Pesa Callbacks')
@Controller('mpesa')
export class MpesaCallbackController {
  private readonly logger = new Logger(MpesaCallbackController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly mpesaService: MpesaService,
  ) {}

  /**
   * M-Pesa STK Push callback
   * This endpoint receives payment confirmations from M-Pesa
   *
   * Security: Protected by IP whitelist (MpesaCallbackGuard)
   * Per P0-001 in mpesa_remediation.md
   */
  @Post('callback')
  @UseGuards(MpesaCallbackGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'M-Pesa STK callback',
    description: 'Webhook endpoint for M-Pesa STK Push callbacks. Do not call directly.',
  })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  @ApiResponse({ status: 403, description: 'Callback source not authorized' })
  async handleCallback(@Body() body: MpesaCallbackBody): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log('M-Pesa callback received');

    try {
      // Parse the callback
      const callbackData = this.mpesaService.parseCallback(body);

      if (!callbackData) {
        this.logger.warn('Invalid callback format received');
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }

      // Process the callback
      const result = await this.paymentService.processCallback(callbackData);

      this.logger.log(
        `Callback processed: checkoutId=${callbackData.checkoutRequestId.slice(0, 8)}... success=${result.success}`,
      );

      // Always return success to M-Pesa to prevent retries
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    } catch (error) {
      this.logger.error('Callback processing error', error);
      // Still return success to prevent M-Pesa retries
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }
  }

  /**
   * M-Pesa validation callback (optional)
   * Can be used to pre-validate transactions
   *
   * Security: Protected by IP whitelist (MpesaCallbackGuard)
   * Per P0-001 in mpesa_remediation.md
   */
  @Post('validation')
  @UseGuards(MpesaCallbackGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'M-Pesa validation callback',
    description: 'Optional validation endpoint for M-Pesa. Do not call directly.',
  })
  @ApiResponse({ status: 200, description: 'Validation response' })
  @ApiResponse({ status: 403, description: 'Callback source not authorized' })
  async handleValidation(@Body() _body: unknown): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log('M-Pesa validation received');
    // Accept all payments for now
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  /**
   * B2C Result URL - receives refund/disbursement confirmations
   *
   * Per P1-001 in mpesa_remediation.md
   *
   * Security: Protected by IP whitelist (MpesaCallbackGuard)
   */
  @Post('b2c/result')
  @UseGuards(MpesaCallbackGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'M-Pesa B2C result callback',
    description: 'Webhook endpoint for M-Pesa B2C result callbacks. Do not call directly.',
  })
  @ApiResponse({ status: 200, description: 'B2C result processed' })
  @ApiResponse({ status: 403, description: 'Callback source not authorized' })
  async handleB2cResult(@Body() body: unknown): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log('M-Pesa B2C result callback received');

    try {
      // Parse B2C callback
      const b2cBody = body as { Result?: { ConversationID?: string; OriginatorConversationID?: string; ResultCode?: number; ResultDesc?: string } };

      if (!b2cBody.Result) {
        this.logger.warn('Invalid B2C callback format - missing Result object');
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }

      const callbackData = this.mpesaService.parseB2cCallback(body as import('../services/mpesa.service.js').B2cCallbackBody);

      this.logger.log(
        `B2C result: conversationId=${callbackData.conversationId} success=${callbackData.isSuccessful}`,
        {
          originatorConversationId: callbackData.originatorConversationId,
          resultCode: callbackData.resultCode,
          amount: callbackData.amount,
        },
      );

      // Process the B2C callback (update refund transaction status)
      await this.paymentService.processB2cCallback(callbackData);

      return { ResultCode: 0, ResultDesc: 'Accepted' };
    } catch (error) {
      this.logger.error('B2C result callback processing error', error);
      // Always return success to prevent M-Pesa retries
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }
  }

  /**
   * B2C Queue Timeout URL - handles timeout scenarios for B2C requests
   *
   * Per P1-001 in mpesa_remediation.md
   *
   * Security: Protected by IP whitelist (MpesaCallbackGuard)
   */
  @Post('b2c/timeout')
  @UseGuards(MpesaCallbackGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'M-Pesa B2C timeout callback',
    description: 'Webhook endpoint for M-Pesa B2C timeout callbacks. Do not call directly.',
  })
  @ApiResponse({ status: 200, description: 'B2C timeout processed' })
  @ApiResponse({ status: 403, description: 'Callback source not authorized' })
  async handleB2cTimeout(@Body() body: unknown): Promise<{ ResultCode: number; ResultDesc: string }> {
    this.logger.log('M-Pesa B2C timeout callback received');

    try {
      // Parse the timeout notification
      const b2cBody = body as { Result?: { OriginatorConversationID?: string; ConversationID?: string } };

      if (!b2cBody.Result) {
        this.logger.warn('Invalid B2C timeout format - missing Result object');
        return { ResultCode: 0, ResultDesc: 'Accepted' };
      }

      const originatorConversationId = b2cBody.Result.OriginatorConversationID;

      this.logger.warn(
        `B2C timeout: originatorConversationId=${originatorConversationId}`,
        {
          conversationId: b2cBody.Result.ConversationID,
        },
      );

      // Mark refund as timed out (can be retried later)
      if (originatorConversationId) {
        await this.paymentService.processB2cTimeout(originatorConversationId);
      }

      return { ResultCode: 0, ResultDesc: 'Accepted' };
    } catch (error) {
      this.logger.error('B2C timeout callback processing error', error);
      // Always return success to prevent M-Pesa retries
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }
  }
}
