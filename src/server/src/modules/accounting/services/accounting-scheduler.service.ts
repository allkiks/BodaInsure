import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerService, JobHandler } from '../../scheduler/services/scheduler.service.js';
import { JobType } from '../../scheduler/entities/job.entity.js';
import { SettlementService } from './settlement.service.js';
import { EscrowService } from './escrow.service.js';
import { ReconciliationService } from './reconciliation.service.js';
import { CommissionCalculatorService } from './commission-calculator.service.js';
import { PartnerType } from '../entities/partner-settlement.entity.js';
import { RemittanceBatchStatus } from '../entities/remittance-batch.entity.js';

/**
 * Accounting Scheduler Service
 *
 * Registers and handles accounting-related scheduled jobs.
 *
 * Per Accounting_Remediation.md - Automated settlement and reconciliation jobs
 *
 * Jobs:
 * - DAILY_SERVICE_FEE_SETTLEMENT: Daily service fee settlement for KBA/Robs
 * - MONTHLY_COMMISSION_SETTLEMENT: Monthly commission settlement processing
 * - DAILY_MPESA_RECONCILIATION: Daily M-Pesa statement reconciliation
 * - REMITTANCE_BATCH_PROCESSING: Remittance batch processing to underwriter
 */
@Injectable()
export class AccountingSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AccountingSchedulerService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly settlementService: SettlementService,
    private readonly escrowService: EscrowService,
    private readonly reconciliationService: ReconciliationService,
    private readonly commissionCalculatorService: CommissionCalculatorService,
  ) {}

  async onModuleInit() {
    this.registerHandlers();
    this.logger.log('Accounting scheduler handlers registered');
  }

  /**
   * Register all accounting job handlers
   */
  private registerHandlers(): void {
    // Daily Service Fee Settlement
    this.schedulerService.registerHandler(
      JobType.DAILY_SERVICE_FEE_SETTLEMENT,
      this.handleDailyServiceFeeSettlement.bind(this),
    );

    // Monthly Commission Settlement
    this.schedulerService.registerHandler(
      JobType.MONTHLY_COMMISSION_SETTLEMENT,
      this.handleMonthlyCommissionSettlement.bind(this),
    );

    // Daily M-Pesa Reconciliation
    this.schedulerService.registerHandler(
      JobType.DAILY_MPESA_RECONCILIATION,
      this.handleDailyMpesaReconciliation.bind(this),
    );

    // Remittance Batch Processing
    this.schedulerService.registerHandler(
      JobType.REMITTANCE_BATCH_PROCESSING,
      this.handleRemittanceBatchProcessing.bind(this),
    );
  }

  /**
   * Handle daily service fee settlement job
   *
   * Creates service fee settlements for KBA and Robs Insurance
   * based on the previous day's transactions.
   *
   * Schedule: Daily at 6:00 AM
   * Cron: 0 6 * * *
   */
  private handleDailyServiceFeeSettlement: JobHandler = async (config) => {
    this.logger.log('Starting daily service fee settlement job');

    const settlementDate = config?.date
      ? new Date(config.date as string)
      : this.getYesterday();

    const periodStart = new Date(settlementDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(settlementDate);
    periodEnd.setHours(23, 59, 59, 999);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const details: Record<string, unknown> = {};

    // Create KBA service fee settlement
    try {
      processed++;
      const kbaResult = await this.settlementService.createServiceFeeSettlement(
        PartnerType.KBA,
        periodStart,
        periodEnd,
        'system',
      );
      if (kbaResult.success) {
        succeeded++;
        details.kba = {
          settlementId: kbaResult.settlementId,
          settlementNumber: kbaResult.settlementNumber,
          amount: kbaResult.totalAmount,
          transactions: kbaResult.transactionCount,
        };
      } else {
        failed++;
        details.kbaError = kbaResult.message;
      }
    } catch (error) {
      failed++;
      details.kbaError = error instanceof Error ? error.message : String(error);
      this.logger.error('KBA service fee settlement failed', error);
    }

    // Create Robs Insurance service fee settlement
    try {
      processed++;
      const robsResult = await this.settlementService.createServiceFeeSettlement(
        PartnerType.ROBS_INSURANCE,
        periodStart,
        periodEnd,
        'system',
      );
      if (robsResult.success) {
        succeeded++;
        details.robsInsurance = {
          settlementId: robsResult.settlementId,
          settlementNumber: robsResult.settlementNumber,
          amount: robsResult.totalAmount,
          transactions: robsResult.transactionCount,
        };
      } else {
        failed++;
        details.robsError = robsResult.message;
      }
    } catch (error) {
      failed++;
      details.robsError = error instanceof Error ? error.message : String(error);
      this.logger.error('Robs service fee settlement failed', error);
    }

    this.logger.log(
      `Daily service fee settlement completed: ${succeeded}/${processed} succeeded`,
    );

    return {
      processed,
      succeeded,
      failed,
      skipped: 0,
      details,
    };
  };

  /**
   * Handle monthly commission settlement job
   *
   * Calculates and creates commission settlements for all partners
   * based on the previous month's policy count.
   *
   * Schedule: Monthly on 1st at 8:00 AM
   * Cron: 0 8 1 * *
   */
  private handleMonthlyCommissionSettlement: JobHandler = async (config) => {
    this.logger.log('Starting monthly commission settlement job');

    // Calculate period (previous month)
    const now = config?.date ? new Date(config.date as string) : new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1); // First day of previous month

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const details: Record<string, unknown> = {};

    try {
      // Calculate commission using the real service
      const commissionResult = await this.commissionCalculatorService.calculateForPeriod(
        periodStart,
        periodEnd,
      );

      if (commissionResult.totalRiders === 0) {
        this.logger.log('No riders found for commission calculation');
        return {
          processed: 0,
          succeeded: 0,
          failed: 0,
          skipped: 1,
          details: { message: 'No riders found for commission calculation' },
        };
      }

      details.calculation = {
        totalRiders: commissionResult.totalRiders,
        fullTermRiders: commissionResult.fullTermRiders,
        totalCommission: commissionResult.totalCommission,
        breakdown: commissionResult.breakdown,
        distribution: commissionResult.distribution,
      };

      // Create KBA commission settlement
      processed++;
      try {
        const kbaResult = await this.settlementService.createCommissionSettlement(
          PartnerType.KBA,
          periodStart,
          periodEnd,
          commissionResult.distribution.kba,
          { source: 'monthly_commission', totalRiders: commissionResult.totalRiders },
          'system',
        );
        if (kbaResult.success && kbaResult.totalAmount > 0) {
          succeeded++;
          details.kbaSettlement = kbaResult;
        }
      } catch (error) {
        failed++;
        details.kbaError = error instanceof Error ? error.message : String(error);
      }

      // Create Robs Insurance commission settlement
      processed++;
      try {
        const robsResult = await this.settlementService.createCommissionSettlement(
          PartnerType.ROBS_INSURANCE,
          periodStart,
          periodEnd,
          commissionResult.distribution.robs,
          { source: 'monthly_commission', totalRiders: commissionResult.totalRiders },
          'system',
        );
        if (robsResult.success && robsResult.totalAmount > 0) {
          succeeded++;
          details.robsSettlement = robsResult;
        }
      } catch (error) {
        failed++;
        details.robsError = error instanceof Error ? error.message : String(error);
      }

      this.logger.log(
        `Monthly commission settlement completed: ${succeeded}/${processed} succeeded`,
      );
    } catch (error) {
      failed++;
      details.error = error instanceof Error ? error.message : String(error);
      this.logger.error('Monthly commission settlement failed', error);
    }

    return {
      processed,
      succeeded,
      failed,
      skipped: 0,
      details,
    };
  };

  /**
   * Handle daily M-Pesa reconciliation job
   *
   * Fetches M-Pesa statement and reconciles with ledger transactions.
   * Note: In production, this would fetch from M-Pesa API or uploaded statement.
   *
   * Schedule: Daily at 7:00 AM
   * Cron: 0 7 * * *
   */
  private handleDailyMpesaReconciliation: JobHandler = async (config) => {
    this.logger.log('Starting daily M-Pesa reconciliation job');

    const reconciliationDate = config?.date
      ? new Date(config.date as string)
      : this.getYesterday();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const details: Record<string, unknown> = {};

    try {
      // In production, this would:
      // 1. Fetch M-Pesa statement from API or S3
      // 2. Parse statement items
      // 3. Create reconciliation

      // For now, we'll create a placeholder reconciliation
      // The statement items would come from config or external source
      const statementItems = (config?.statementItems as Array<{
        reference: string;
        amount: number;
        date: string;
      }>) || [];

      if (statementItems.length === 0) {
        this.logger.log('No M-Pesa statement items provided, skipping reconciliation');
        return {
          processed: 0,
          succeeded: 0,
          failed: 0,
          skipped: 1,
          details: { message: 'No M-Pesa statement items provided' },
        };
      }

      processed++;
      const result = await this.reconciliationService.createMpesaReconciliation(
        reconciliationDate,
        statementItems.map((item) => ({
          reference: item.reference,
          amount: item.amount,
          date: new Date(item.date),
        })),
        'system',
      );

      if (result.success) {
        succeeded++;
        details.reconciliation = {
          reconciliationId: result.reconciliationId,
          totalItems: result.totalItems,
          matchedCount: result.matchedCount,
          unmatchedCount: result.unmatchedCount,
          autoMatchedCount: result.autoMatchedCount,
          variance: result.variance,
          status: result.status,
        };
      } else {
        failed++;
        details.error = 'Reconciliation creation failed';
      }

      this.logger.log(
        `M-Pesa reconciliation completed: ${result.matchedCount}/${result.totalItems} matched`,
      );
    } catch (error) {
      failed++;
      details.error = error instanceof Error ? error.message : String(error);
      this.logger.error('M-Pesa reconciliation failed', error);
    }

    return {
      processed,
      succeeded,
      failed,
      skipped: 0,
      details,
    };
  };

  /**
   * Handle remittance batch processing job
   *
   * Processes pending remittance batches to the underwriter.
   *
   * Schedule: Daily at 10:00 AM
   * Cron: 0 10 * * *
   */
  private handleRemittanceBatchProcessing: JobHandler = async (config) => {
    this.logger.log('Starting remittance batch processing job');

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const details: Record<string, unknown> = {};

    try {
      // Get approved remittance batches ready for processing
      const approvedBatches = await this.escrowService.getBatchesByStatus(
        RemittanceBatchStatus.APPROVED,
      );

      if (approvedBatches.length === 0) {
        this.logger.log('No approved remittance batches to process');
        return {
          processed: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          details: { message: 'No approved remittance batches to process' },
        };
      }

      const batchResults: Array<{ batchId: string; status: string; amount?: number }> = [];

      for (const batch of approvedBatches) {
        processed++;
        try {
          // In production, this would:
          // 1. Initiate bank transfer
          // 2. Wait for confirmation
          // 3. Update batch status

          // Process the batch if autoProcess is enabled
          if (config?.autoProcess) {
            await this.escrowService.processBatch(
              batch.id,
              `BANK-${Date.now()}`,
            );
            succeeded++;
            batchResults.push({
              batchId: batch.id,
              status: 'processed',
              amount: Number(batch.totalPremiumAmount),
            });
          } else {
            // Just report approved batches awaiting processing
            batchResults.push({
              batchId: batch.id,
              status: 'approved_pending_transfer',
              amount: Number(batch.totalPremiumAmount),
            });
          }
        } catch (error) {
          failed++;
          batchResults.push({
            batchId: batch.id,
            status: 'failed',
          });
          this.logger.error(`Batch ${batch.id} processing failed`, error);
        }
      }

      details.batches = batchResults;
      details.totalApprovedAmount = approvedBatches.reduce(
        (sum: number, b) => sum + Number(b.totalPremiumAmount),
        0,
      );

      this.logger.log(
        `Remittance batch processing completed: ${succeeded}/${processed} succeeded`,
      );
    } catch (error) {
      failed++;
      details.error = error instanceof Error ? error.message : String(error);
      this.logger.error('Remittance batch processing failed', error);
    }

    return {
      processed,
      succeeded,
      failed,
      skipped: 0,
      details,
    };
  };

  /**
   * Get yesterday's date
   */
  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
}
