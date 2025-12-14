import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

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
export class PaymentModule {}
