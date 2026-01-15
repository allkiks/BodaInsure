import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { Policy } from './entities/policy.entity.js';
import { PolicyDocument } from './entities/policy-document.entity.js';
import { PolicyBatch } from './entities/policy-batch.entity.js';
import {
  PolicyTerms,
  PolicyTermsAcknowledgment,
} from './entities/policy-terms.entity.js';
import { RiderRefund } from './entities/rider-refund.entity.js';

// Services
import { PdfGenerationService } from './services/pdf-generation.service.js';
import { BatchProcessingService } from './services/batch-processing.service.js';
import { PolicyService } from './services/policy.service.js';
import { PolicyTermsService } from './services/policy-terms.service.js';
import { RefundService } from './services/refund.service.js';

// Controllers
import { PolicyController, PolicyBatchController } from './controllers/policy.controller.js';
import { PolicyTermsController } from './controllers/policy-terms.controller.js';
import { RefundController } from './controllers/refund.controller.js';

// External Modules
import { AccountingModule } from '../accounting/accounting.module.js';
import { PaymentModule } from '../payment/payment.module.js';

/**
 * Policy Module
 * Handles policy lifecycle, batch processing, and document generation
 *
 * Per FEAT-POL-001, FEAT-POL-002, FEAT-POL-003
 * CR-IRA-003: Policy terms display and acknowledgment
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Policy,
      PolicyDocument,
      PolicyBatch,
      PolicyTerms,
      PolicyTermsAcknowledgment,
      RiderRefund,
    ]),
    ConfigModule,
    forwardRef(() => AccountingModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [PolicyController, PolicyBatchController, PolicyTermsController, RefundController],
  providers: [
    PdfGenerationService,
    BatchProcessingService,
    PolicyService,
    PolicyTermsService,
    RefundService,
  ],
  exports: [
    PolicyService,
    BatchProcessingService,
    PdfGenerationService,
    PolicyTermsService,
    RefundService,
  ],
})
export class PolicyModule {}
