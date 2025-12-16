import { Module } from '@nestjs/common';
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

// Services
import { PdfGenerationService } from './services/pdf-generation.service.js';
import { BatchProcessingService } from './services/batch-processing.service.js';
import { PolicyService } from './services/policy.service.js';
import { PolicyTermsService } from './services/policy-terms.service.js';

// Controllers
import { PolicyController, PolicyBatchController } from './controllers/policy.controller.js';
import { PolicyTermsController } from './controllers/policy-terms.controller.js';

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
    ]),
    ConfigModule,
  ],
  controllers: [PolicyController, PolicyBatchController, PolicyTermsController],
  providers: [
    PdfGenerationService,
    BatchProcessingService,
    PolicyService,
    PolicyTermsService,
  ],
  exports: [
    PolicyService,
    BatchProcessingService,
    PdfGenerationService,
    PolicyTermsService,
  ],
})
export class PolicyModule {}
