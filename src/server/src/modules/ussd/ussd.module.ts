import { Module } from '@nestjs/common';
import { UssdService } from './services/ussd.service.js';
import { UssdController } from './controllers/ussd.controller.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { PolicyModule } from '../policy/policy.module.js';

/**
 * USSD Module
 * Handles USSD channel for feature phone users
 *
 * Per FEAT-USSD-001, FEAT-USSD-002, FEAT-USSD-003:
 * - Balance Check (integrates with WalletService)
 * - Payment (integrates with PaymentService for M-Pesa STK Push)
 * - Policy Status (integrates with PolicyService)
 *
 * Supports multi-language (English/Swahili) based on user preference.
 */
@Module({
  imports: [
    IdentityModule,  // For UserService (user lookup by phone)
    PaymentModule,   // For WalletService and PaymentService
    PolicyModule,    // For PolicyService
  ],
  controllers: [UssdController],
  providers: [UssdService],
  exports: [UssdService],
})
export class UssdModule {}
