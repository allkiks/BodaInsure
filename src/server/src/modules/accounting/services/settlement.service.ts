import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import {
  PartnerSettlement,
  PartnerType,
  SettlementType,
  SettlementStatus,
} from '../entities/partner-settlement.entity.js';
import { SettlementLineItem } from '../entities/settlement-line-item.entity.js';
import {
  EscrowTracking,
  RemittanceStatus,
} from '../entities/escrow-tracking.entity.js';
import { JournalEntryService } from './journal-entry.service.js';
import { JournalEntryType } from '../entities/journal-entry.entity.js';
import { GL_ACCOUNTS } from '../config/posting-rules.config.js';

/**
 * Settlement creation result
 */
export interface SettlementCreationResult {
  success: boolean;
  settlementId?: string;
  settlementNumber?: string;
  totalAmount: number;
  transactionCount: number;
  message: string;
}

/**
 * Settlement Service
 *
 * Manages partner settlements for service fees, commissions, and premium remittances.
 *
 * Per Accounting_Remediation.md - Epic 6
 *
 * Settlement Types:
 * - SERVICE_FEE: Daily service fee settlements to KBA/Robs
 * - COMMISSION: Monthly commission settlements
 * - PREMIUM_REMITTANCE: Premium remittances to Definite Assurance
 * - REVERSAL_FEE: Reversal fee distributions
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(PartnerSettlement)
    private readonly settlementRepository: Repository<PartnerSettlement>,
    @InjectRepository(EscrowTracking)
    private readonly escrowRepository: Repository<EscrowTracking>,
    private readonly journalEntryService: JournalEntryService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a service fee settlement for a partner
   *
   * @param partnerType - KBA or ROBS_INSURANCE
   * @param periodStart - Start of settlement period
   * @param periodEnd - End of settlement period
   * @param createdBy - User ID creating the settlement
   */
  async createServiceFeeSettlement(
    partnerType: PartnerType.KBA | PartnerType.ROBS_INSURANCE,
    periodStart: Date,
    periodEnd: Date,
    createdBy?: string,
  ): Promise<SettlementCreationResult> {
    if (partnerType !== PartnerType.KBA && partnerType !== PartnerType.ROBS_INSURANCE) {
      throw new BadRequestException('Service fee settlements only for KBA or Robs');
    }

    // Get escrow records for the period
    const escrowRecords = await this.escrowRepository.find({
      where: {
        createdAt: Between(periodStart, periodEnd),
        remittanceStatus: In([RemittanceStatus.PENDING, RemittanceStatus.SCHEDULED, RemittanceStatus.REMITTED]),
      },
    });

    if (escrowRecords.length === 0) {
      return {
        success: true,
        totalAmount: 0,
        transactionCount: 0,
        message: 'No transactions found for settlement period',
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(PartnerSettlement);
      const lineItemRepo = manager.getRepository(SettlementLineItem);

      // Calculate total service fee (KES 1 per transaction = 100 cents)
      const serviceFeePerTransaction = 100; // 1 KES in cents
      const totalAmount = escrowRecords.length * serviceFeePerTransaction;

      // Generate settlement number
      const settlementNumber = await this.generateSettlementNumber(
        partnerType,
        SettlementType.SERVICE_FEE,
        manager,
      );

      // Create settlement
      const settlement = settlementRepo.create({
        settlementNumber,
        partnerType,
        settlementType: SettlementType.SERVICE_FEE,
        periodStart,
        periodEnd,
        totalAmount,
        transactionCount: escrowRecords.length,
        status: SettlementStatus.PENDING,
        createdBy,
      });

      const savedSettlement = await settlementRepo.save(settlement);

      // Create line items (grouped by day for efficiency)
      const byDate = new Map<string, { count: number; amount: number; riders: Set<string> }>();
      for (const escrow of escrowRecords) {
        const dateKey = escrow.createdAt.toISOString().slice(0, 10);
        const existing = byDate.get(dateKey) || { count: 0, amount: 0, riders: new Set() };
        existing.count++;
        existing.amount += serviceFeePerTransaction;
        existing.riders.add(escrow.riderId);
        byDate.set(dateKey, existing);
      }

      let lineNumber = 0;
      for (const [date, data] of byDate) {
        lineNumber++;
        await lineItemRepo.save({
          settlementId: savedSettlement.id,
          lineNumber,
          amount: data.amount,
          description: `Service fees for ${date}: ${data.count} transactions from ${data.riders.size} riders`,
          referenceDate: new Date(date),
          metadata: { transactionCount: data.count, uniqueRiders: data.riders.size },
        });
      }

      this.logger.log(
        `Created service fee settlement ${settlementNumber} for ${partnerType}: ${totalAmount / 100} KES`,
      );

      return {
        success: true,
        settlementId: savedSettlement.id,
        settlementNumber: savedSettlement.settlementNumber,
        totalAmount,
        transactionCount: escrowRecords.length,
        message: `Settlement created with ${escrowRecords.length} transactions`,
      };
    });
  }

  /**
   * Create a commission settlement for a partner
   *
   * @param partnerType - Partner receiving commission
   * @param periodStart - Start of settlement period (typically month start)
   * @param periodEnd - End of settlement period (typically month end)
   * @param commissionAmount - Pre-calculated commission amount in cents
   * @param metadata - Additional calculation details
   * @param createdBy - User ID creating the settlement
   */
  async createCommissionSettlement(
    partnerType: PartnerType,
    periodStart: Date,
    periodEnd: Date,
    commissionAmount: number,
    metadata?: Record<string, unknown>,
    createdBy?: string,
  ): Promise<SettlementCreationResult> {
    if (commissionAmount <= 0) {
      return {
        success: true,
        totalAmount: 0,
        transactionCount: 0,
        message: 'No commission to settle',
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(PartnerSettlement);
      const lineItemRepo = manager.getRepository(SettlementLineItem);

      // Generate settlement number
      const settlementNumber = await this.generateSettlementNumber(
        partnerType,
        SettlementType.COMMISSION,
        manager,
      );

      // Create settlement
      const settlement = settlementRepo.create({
        settlementNumber,
        partnerType,
        settlementType: SettlementType.COMMISSION,
        periodStart,
        periodEnd,
        totalAmount: commissionAmount,
        transactionCount: 1,
        status: SettlementStatus.PENDING,
        createdBy,
        metadata,
      });

      const savedSettlement = await settlementRepo.save(settlement);

      // Create single line item for commission
      await lineItemRepo.save({
        settlementId: savedSettlement.id,
        lineNumber: 1,
        amount: commissionAmount,
        description: `Commission for period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
        referenceDate: periodEnd,
        metadata,
      });

      this.logger.log(
        `Created commission settlement ${settlementNumber} for ${partnerType}: ${commissionAmount / 100} KES`,
      );

      return {
        success: true,
        settlementId: savedSettlement.id,
        settlementNumber: savedSettlement.settlementNumber,
        totalAmount: commissionAmount,
        transactionCount: 1,
        message: `Commission settlement created`,
      };
    });
  }

  /**
   * Approve a settlement
   *
   * @param settlementId - Settlement to approve
   * @param approvedBy - User approving
   */
  async approveSettlement(settlementId: string, approvedBy: string): Promise<PartnerSettlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (!settlement.canBeApproved()) {
      throw new BadRequestException(
        `Settlement cannot be approved. Current status: ${settlement.status}`,
      );
    }

    settlement.status = SettlementStatus.APPROVED;
    settlement.approvedBy = approvedBy;
    settlement.approvedAt = new Date();

    await this.settlementRepository.save(settlement);

    this.logger.log(`Approved settlement ${settlement.settlementNumber}`);

    return settlement;
  }

  /**
   * Process a settlement (execute bank transfer and create journal entry)
   *
   * @param settlementId - Settlement to process
   * @param bankReference - Bank transfer reference
   * @param bankAccount - Bank account used
   */
  async processSettlement(
    settlementId: string,
    bankReference: string,
    bankAccount?: string,
  ): Promise<PartnerSettlement> {
    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(PartnerSettlement);

      const settlement = await settlementRepo.findOne({
        where: { id: settlementId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }

      if (!settlement.canBeProcessed()) {
        throw new BadRequestException(
          `Settlement cannot be processed. Current status: ${settlement.status}`,
        );
      }

      // Create journal entry for the settlement
      const journalEntry = await this.createSettlementJournalEntry(settlement);

      // Update settlement
      settlement.status = SettlementStatus.COMPLETED;
      settlement.bankReference = bankReference;
      settlement.bankAccount = bankAccount;
      settlement.settledAt = new Date();
      settlement.journalEntryId = journalEntry.id;

      await settlementRepo.save(settlement);

      this.logger.log(
        `Processed settlement ${settlement.settlementNumber}: ${Number(settlement.totalAmount) / 100} KES to ${settlement.partnerType}`,
      );

      return settlement;
    });
  }

  /**
   * Create journal entry for settlement
   */
  private async createSettlementJournalEntry(settlement: PartnerSettlement) {
    // Determine GL accounts based on partner and settlement type
    const { debitAccount, creditAccount } = this.getSettlementGlAccounts(settlement);

    const lines = [
      {
        accountCode: debitAccount,
        debitAmount: Number(settlement.totalAmount),
        description: `Settlement to ${settlement.getPartnerDisplayName()}`,
      },
      {
        accountCode: creditAccount,
        creditAmount: Number(settlement.totalAmount),
        description: `Cash paid for ${settlement.getTypeDisplayName()}`,
      },
    ];

    return this.journalEntryService.create({
      entryType: JournalEntryType.SERVICE_FEE_DISTRIBUTION,
      entryDate: new Date(),
      description: `${settlement.getTypeDisplayName()} settlement to ${settlement.getPartnerDisplayName()} - ${settlement.settlementNumber}`,
      lines,
      sourceEntityType: 'partner_settlement',
      sourceEntityId: settlement.id,
      autoPost: true,
      metadata: {
        settlementNumber: settlement.settlementNumber,
        partnerType: settlement.partnerType,
        settlementType: settlement.settlementType,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
      },
    });
  }

  /**
   * Get GL accounts for settlement posting
   */
  private getSettlementGlAccounts(settlement: PartnerSettlement): { debitAccount: string; creditAccount: string } {
    let debitAccount: string;
    const creditAccount = GL_ACCOUNTS.CASH_PLATFORM_OPERATING;

    switch (settlement.partnerType) {
      case PartnerType.KBA:
        debitAccount = settlement.settlementType === SettlementType.SERVICE_FEE
          ? GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA
          : GL_ACCOUNTS.COMMISSION_PAYABLE_KBA;
        break;
      case PartnerType.ROBS_INSURANCE:
        debitAccount = settlement.settlementType === SettlementType.SERVICE_FEE
          ? GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS
          : GL_ACCOUNTS.COMMISSION_PAYABLE_ROBS;
        break;
      case PartnerType.DEFINITE_ASSURANCE:
        debitAccount = GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE;
        break;
      default:
        throw new BadRequestException(`Unsupported partner type: ${settlement.partnerType}`);
    }

    return { debitAccount, creditAccount };
  }

  /**
   * Generate unique settlement number
   */
  private async generateSettlementNumber(
    partnerType: PartnerType,
    settlementType: SettlementType,
    manager?: ReturnType<DataSource['createEntityManager']>,
  ): Promise<string> {
    const repo = manager
      ? manager.getRepository(PartnerSettlement)
      : this.settlementRepository;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Prefix based on partner and type
    const partnerPrefix = {
      [PartnerType.DEFINITE_ASSURANCE]: 'DEF',
      [PartnerType.KBA]: 'KBA',
      [PartnerType.ROBS_INSURANCE]: 'ROB',
      [PartnerType.ATRONACH]: 'ATR',
    }[partnerType];

    const typePrefix = {
      [SettlementType.SERVICE_FEE]: 'SF',
      [SettlementType.COMMISSION]: 'CM',
      [SettlementType.PREMIUM_REMITTANCE]: 'PR',
      [SettlementType.REVERSAL_FEE]: 'RF',
    }[settlementType];

    // Get count for today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await repo.count({
      where: {
        partnerType,
        settlementType,
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    return `${partnerPrefix}-${typePrefix}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  /**
   * Get settlement by ID
   */
  async getById(settlementId: string): Promise<PartnerSettlement> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
      relations: ['lineItems', 'journalEntry'],
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return settlement;
  }

  /**
   * Get settlements by partner
   */
  async getByPartner(partnerType: PartnerType): Promise<PartnerSettlement[]> {
    return this.settlementRepository.find({
      where: { partnerType },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get settlements by status
   */
  async getByStatus(status: SettlementStatus): Promise<PartnerSettlement[]> {
    return this.settlementRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get pending settlements awaiting approval
   */
  async getPendingSettlements(): Promise<PartnerSettlement[]> {
    return this.getByStatus(SettlementStatus.PENDING);
  }

  /**
   * Get approved settlements ready for processing
   */
  async getApprovedSettlements(): Promise<PartnerSettlement[]> {
    return this.getByStatus(SettlementStatus.APPROVED);
  }

  /**
   * Get settlement summary by partner for a period
   */
  async getPartnerSummary(
    partnerType: PartnerType,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    totalSettled: number;
    totalPending: number;
    settlementCount: number;
    pendingCount: number;
  }> {
    const settlements = await this.settlementRepository.find({
      where: {
        partnerType,
        periodStart: Between(periodStart, periodEnd),
      },
    });

    const completed = settlements.filter((s) => s.status === SettlementStatus.COMPLETED);
    const pending = settlements.filter((s) => s.status !== SettlementStatus.COMPLETED);

    return {
      totalSettled: completed.reduce((sum, s) => sum + Number(s.totalAmount), 0),
      totalPending: pending.reduce((sum, s) => sum + Number(s.totalAmount), 0),
      settlementCount: completed.length,
      pendingCount: pending.length,
    };
  }
}
