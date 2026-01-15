import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// External Modules
import { SchedulerModule } from '../scheduler/scheduler.module.js';

// Entities
import { GlAccount } from './entities/gl-account.entity.js';
import { JournalEntry } from './entities/journal-entry.entity.js';
import { JournalEntryLine } from './entities/journal-entry-line.entity.js';
import { EscrowTracking } from './entities/escrow-tracking.entity.js';
import { RemittanceBatch } from './entities/remittance-batch.entity.js';
import { PartnerSettlement } from './entities/partner-settlement.entity.js';
import { SettlementLineItem } from './entities/settlement-line-item.entity.js';
import { ReconciliationRecord } from './entities/reconciliation-record.entity.js';
import { ReconciliationItem } from './entities/reconciliation-item.entity.js';

// Services
import { GlAccountService } from './services/gl-account.service.js';
import { JournalEntryService } from './services/journal-entry.service.js';
import { PostingEngineService } from './services/posting-engine.service.js';
import { EscrowService } from './services/escrow.service.js';
import { SettlementService } from './services/settlement.service.js';
import { CommissionCalculatorService } from './services/commission-calculator.service.js';
import { ReconciliationService } from './services/reconciliation.service.js';
import { FinancialReportingService } from './services/financial-reporting.service.js';
import { AccountingSchedulerService } from './services/accounting-scheduler.service.js';
import { ExportService } from './services/export.service.js';
import { SettlementNotificationService } from './services/settlement-notification.service.js';

// Controllers
import { GlAccountController } from './controllers/gl-account.controller.js';
import { SettlementController } from './controllers/settlement.controller.js';
import { ReconciliationController } from './controllers/reconciliation.controller.js';
import { ReportsController } from './controllers/reports.controller.js';
import { ExportController } from './controllers/export.controller.js';

// External dependencies
import { Transaction } from '../payment/entities/transaction.entity.js';

/**
 * Accounting Module
 *
 * Provides comprehensive accounting infrastructure for BodaInsure.
 *
 * Per Accounting_Remediation.md - Epics 1-10
 *
 * Features:
 * - Chart of Accounts management (Epic 1)
 * - Double-entry journal entries (Epic 2)
 * - Posting engine for automated journal entries (Epic 3)
 * - Escrow tracking for premium funds (Epic 5)
 * - Remittance batch management (Epic 5)
 * - Partner settlement system (Epic 6)
 * - Commission calculation (Epic 7)
 * - Reconciliation system (Epic 8)
 * - Financial reporting (Epic 9)
 * - API endpoints (Epic 10)
 */
@Module({
  imports: [
    SchedulerModule,
    TypeOrmModule.forFeature([
      // GL Infrastructure
      GlAccount,
      JournalEntry,
      JournalEntryLine,
      // Escrow Management
      EscrowTracking,
      RemittanceBatch,
      // Partner Settlements
      PartnerSettlement,
      SettlementLineItem,
      // Reconciliation
      ReconciliationRecord,
      ReconciliationItem,
      // External (for reconciliation service)
      Transaction,
    ]),
  ],
  providers: [
    // Core GL Services
    GlAccountService,
    JournalEntryService,
    PostingEngineService,
    // Escrow Services
    EscrowService,
    // Settlement Services
    SettlementService,
    CommissionCalculatorService,
    // Reconciliation Services
    ReconciliationService,
    // Reporting Services
    FinancialReportingService,
    // Export Services
    ExportService,
    // Notification Services
    SettlementNotificationService,
    // Scheduler Services
    AccountingSchedulerService,
  ],
  controllers: [
    GlAccountController,
    SettlementController,
    ReconciliationController,
    ReportsController,
    ExportController,
  ],
  exports: [
    // Core Services
    GlAccountService,
    JournalEntryService,
    PostingEngineService,
    EscrowService,
    // Settlement Services
    SettlementService,
    CommissionCalculatorService,
    // Reconciliation Services
    ReconciliationService,
    // Reporting Services
    FinancialReportingService,
    // Export Services
    ExportService,
    // Notification Services
    SettlementNotificationService,
  ],
})
export class AccountingModule {}
