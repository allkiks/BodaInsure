import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { Policy } from './entities/policy.entity.js';
import { PolicyDocument } from './entities/policy-document.entity.js';
import { PolicyBatch } from './entities/policy-batch.entity.js';

// Services
import { PdfGenerationService } from './services/pdf-generation.service.js';
import { BatchProcessingService } from './services/batch-processing.service.js';
import { PolicyService } from './services/policy.service.js';

// Controllers
import { PolicyController, PolicyBatchController } from './controllers/policy.controller.js';

/**
 * Policy Module
 * Handles policy lifecycle, batch processing, and document generation
 *
 * Per FEAT-POL-001, FEAT-POL-002, FEAT-POL-003
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Policy, PolicyDocument, PolicyBatch]),
    ConfigModule,
  ],
  controllers: [PolicyController, PolicyBatchController],
  providers: [
    PdfGenerationService,
    BatchProcessingService,
    PolicyService,
  ],
  exports: [PolicyService, BatchProcessingService, PdfGenerationService],
})
export class PolicyModule {}
