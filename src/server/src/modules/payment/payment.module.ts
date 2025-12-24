import { Module, forwardRef, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

// Entities
import { Wallet } from './entities/wallet.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { PaymentRequest } from './entities/payment-request.entity.js';

// Services
import { MpesaService } from './services/mpesa.service.js';
import { WalletService } from './services/wallet.service.js';
import { PaymentService } from './services/payment.service.js';

// Controllers
import {
  PaymentController,
  WalletController,
  TransactionController,
  MpesaCallbackController,
} from './controllers/payment.controller.js';

// External modules
import { KycModule } from '../kyc/kyc.module.js';
import { SchedulerModule } from '../scheduler/scheduler.module.js';
import { BatchSchedulerService } from '../scheduler/services/batch-scheduler.service.js';

/**
 * Payment Module
 * Handles M-Pesa payments, wallet management, and transaction tracking
 *
 * Per FEAT-PAY-001, FEAT-PAY-002, FEAT-PAY-003
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, PaymentRequest]),
    HttpModule.register({
      timeout: 30000, // 30 seconds for M-Pesa API calls
      maxRedirects: 5,
    }),
    ConfigModule,
    forwardRef(() => KycModule), // For KYC status check before payments
    forwardRef(() => SchedulerModule), // For scheduler handler registration
  ],
  controllers: [
    PaymentController,
    WalletController,
    TransactionController,
    MpesaCallbackController,
  ],
  providers: [MpesaService, WalletService, PaymentService],
  exports: [WalletService, PaymentService, MpesaService],
})
export class PaymentModule implements OnModuleInit {
  private readonly logger = new Logger(PaymentModule.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Register handlers with the scheduler on module initialization
   * Per P1-004 in mpesa_remediation.md
   */
  async onModuleInit(): Promise<void> {
    try {
      const batchScheduler = this.moduleRef.get(BatchSchedulerService, { strict: false });

      if (batchScheduler) {
        // Register payment expiry handler
        batchScheduler.registerPaymentExpiryHandler(
          () => this.paymentService.expireStaleRequests(),
        );

        // Register stale payment polling handler (P1-004)
        batchScheduler.registerStalePaymentPollingHandler(
          () => this.paymentService.pollStalePaymentRequests(),
        );

        this.logger.log('Payment handlers registered with batch scheduler');
      }
    } catch (error) {
      this.logger.warn('Could not register payment handlers with scheduler', error);
    }
  }
}
