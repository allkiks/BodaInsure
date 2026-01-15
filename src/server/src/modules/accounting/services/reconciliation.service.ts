import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import {
  ReconciliationRecord,
  ReconciliationType,
  ReconciliationStatus,
} from '../entities/reconciliation-record.entity.js';
import { ReconciliationItem, MatchType } from '../entities/reconciliation-item.entity.js';
import {
  Transaction,
  TransactionStatus,
} from '../../payment/entities/transaction.entity.js';

/**
 * Statement item from external source
 */
export interface StatementItem {
  reference: string;
  amount: number; // in cents
  date: Date;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  success: boolean;
  reconciliationId: string;
  totalItems: number;
  matchedCount: number;
  unmatchedCount: number;
  autoMatchedCount: number;
  sourceBalance: number;
  ledgerBalance: number;
  variance: number;
  status: ReconciliationStatus;
}

/**
 * Match result for an item
 */
export interface ItemMatchResult {
  itemId: string;
  matchType: MatchType;
  confidence: number;
  ledgerTransactionId?: string;
  ledgerAmount?: number;
  variance: number;
}

/**
 * Reconciliation Service
 *
 * Manages reconciliation between external statements and internal ledger.
 *
 * Per Accounting_Remediation.md - Epic 8
 *
 * Supported reconciliation types:
 * - DAILY_MPESA: M-Pesa statement reconciliation
 * - MONTHLY_BANK: Bank statement reconciliation
 * - PARTNER_SETTLEMENT: Partner settlement verification
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  // Match confidence thresholds
  private readonly EXACT_MATCH_CONFIDENCE = 100;
  private readonly AMOUNT_MATCH_CONFIDENCE = 80;
  private readonly REFERENCE_MATCH_CONFIDENCE = 70;
  private readonly FUZZY_MATCH_CONFIDENCE = 60;

  constructor(
    @InjectRepository(ReconciliationRecord)
    private readonly recordRepository: Repository<ReconciliationRecord>,
    @InjectRepository(ReconciliationItem)
    private readonly itemRepository: Repository<ReconciliationItem>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new reconciliation from M-Pesa statement items
   *
   * @param reconciliationDate - Date being reconciled
   * @param statementItems - Items from M-Pesa statement
   * @param createdBy - User creating reconciliation
   */
  async createMpesaReconciliation(
    reconciliationDate: Date,
    statementItems: StatementItem[],
    createdBy?: string,
  ): Promise<ReconciliationResult> {
    return this.createReconciliation(
      ReconciliationType.DAILY_MPESA,
      reconciliationDate,
      'M-Pesa Statement',
      statementItems,
      createdBy,
    );
  }

  /**
   * Create a new reconciliation from bank statement items
   */
  async createBankReconciliation(
    reconciliationDate: Date,
    statementItems: StatementItem[],
    sourceName: string,
    createdBy?: string,
  ): Promise<ReconciliationResult> {
    return this.createReconciliation(
      ReconciliationType.MONTHLY_BANK,
      reconciliationDate,
      sourceName,
      statementItems,
      createdBy,
    );
  }

  /**
   * Create reconciliation with auto-matching
   */
  private async createReconciliation(
    type: ReconciliationType,
    reconciliationDate: Date,
    sourceName: string,
    statementItems: StatementItem[],
    createdBy?: string,
  ): Promise<ReconciliationResult> {
    return this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(ReconciliationRecord);
      const itemRepo = manager.getRepository(ReconciliationItem);

      // Calculate source balance
      const sourceBalance = statementItems.reduce((sum, item) => sum + item.amount, 0);

      // Get ledger transactions for the date
      const ledgerTransactions = await this.getLedgerTransactionsForDate(
        reconciliationDate,
        type,
      );

      // Calculate ledger balance
      const ledgerBalance = ledgerTransactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0,
      );

      // Create reconciliation record
      const record = recordRepo.create({
        reconciliationType: type,
        reconciliationDate,
        sourceName,
        sourceBalance,
        ledgerBalance,
        variance: sourceBalance - ledgerBalance,
        status: ReconciliationStatus.IN_PROGRESS,
        totalItems: statementItems.length,
        createdBy,
      });

      const savedRecord = await recordRepo.save(record);

      // Create and auto-match items
      let matchedCount = 0;
      let autoMatchedCount = 0;

      for (let i = 0; i < statementItems.length; i++) {
        const stmt = statementItems[i]!;

        // Try to find matching ledger transaction
        const match = this.findBestMatch(stmt, ledgerTransactions);

        const item = itemRepo.create({
          reconciliationId: savedRecord.id,
          lineNumber: i + 1,
          sourceReference: stmt.reference,
          sourceAmount: stmt.amount,
          sourceDate: stmt.date,
          sourceDescription: stmt.description,
          metadata: stmt.metadata,
        });

        if (match) {
          item.ledgerTransactionId = match.transactionId;
          item.ledgerAmount = match.amount;
          item.ledgerDate = match.date;
          item.ledgerDescription = match.description;
          item.matchType = match.matchType;
          item.matchConfidence = match.confidence;
          item.variance = stmt.amount - match.amount;

          if (match.confidence >= this.FUZZY_MATCH_CONFIDENCE) {
            item.status = ReconciliationStatus.MATCHED;
            matchedCount++;
            autoMatchedCount++;

            // Remove matched transaction from pool
            const idx = ledgerTransactions.findIndex((t) => t.id === match.transactionId);
            if (idx !== -1) {
              ledgerTransactions.splice(idx, 1);
            }
          } else {
            item.status = ReconciliationStatus.PENDING;
          }
        } else {
          item.status = ReconciliationStatus.UNMATCHED;
          item.variance = stmt.amount;
        }

        await itemRepo.save(item);
      }

      // Create items for unmatched ledger transactions (orphans in ledger)
      let lineNumber = statementItems.length;
      for (const tx of ledgerTransactions) {
        lineNumber++;
        await itemRepo.save({
          reconciliationId: savedRecord.id,
          lineNumber,
          ledgerTransactionId: tx.id,
          ledgerAmount: Number(tx.amount),
          ledgerDate: tx.date,
          ledgerDescription: tx.description,
          status: ReconciliationStatus.UNMATCHED,
          variance: -Number(tx.amount), // Negative because only in ledger
        });
      }

      // Update record with counts
      const unmatchedCount = savedRecord.totalItems + ledgerTransactions.length - matchedCount;
      savedRecord.totalItems = lineNumber;
      savedRecord.matchedCount = matchedCount;
      savedRecord.unmatchedCount = unmatchedCount;
      savedRecord.autoMatchedCount = autoMatchedCount;
      savedRecord.status = unmatchedCount === 0
        ? ReconciliationStatus.MATCHED
        : ReconciliationStatus.UNMATCHED;

      await recordRepo.save(savedRecord);

      this.logger.log(
        `Created reconciliation for ${reconciliationDate.toISOString().slice(0, 10)}: ` +
        `${matchedCount}/${lineNumber} matched, variance=${(sourceBalance - ledgerBalance) / 100} KES`,
      );

      return {
        success: true,
        reconciliationId: savedRecord.id,
        totalItems: lineNumber,
        matchedCount,
        unmatchedCount,
        autoMatchedCount,
        sourceBalance,
        ledgerBalance,
        variance: sourceBalance - ledgerBalance,
        status: savedRecord.status,
      };
    });
  }

  /**
   * Get ledger transactions for a reconciliation date
   */
  private async getLedgerTransactionsForDate(
    date: Date,
    _type: ReconciliationType, // Reserved for future type-specific filtering
  ): Promise<Array<{ id: string; amount: number; reference: string; description?: string; date: Date }>> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await this.transactionRepository.find({
      where: {
        status: TransactionStatus.COMPLETED,
        completedAt: Between(startOfDay, endOfDay),
      },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      amount: Number(tx.amount),
      reference: tx.mpesaReceiptNumber || tx.id.slice(0, 8),
      description: tx.description,
      date: tx.completedAt || tx.createdAt,
    }));
  }

  /**
   * Find best matching ledger transaction for a statement item
   */
  private findBestMatch(
    stmt: StatementItem,
    ledgerTransactions: Array<{ id: string; amount: number; reference: string; description?: string; date: Date }>,
  ): { transactionId: string; amount: number; date: Date; description?: string; matchType: MatchType; confidence: number } | null {
    let bestMatch: ReturnType<typeof this.findBestMatch> = null;
    let bestConfidence = 0;

    for (const tx of ledgerTransactions) {
      let matchType: MatchType | null = null;
      let confidence = 0;

      // Check for exact match (reference and amount)
      if (stmt.reference === tx.reference && stmt.amount === tx.amount) {
        matchType = MatchType.EXACT;
        confidence = this.EXACT_MATCH_CONFIDENCE;
      }
      // Check for amount-only match
      else if (stmt.amount === tx.amount) {
        matchType = MatchType.AMOUNT_ONLY;
        confidence = this.AMOUNT_MATCH_CONFIDENCE;
      }
      // Check for reference-only match
      else if (stmt.reference === tx.reference) {
        matchType = MatchType.REFERENCE_ONLY;
        confidence = this.REFERENCE_MATCH_CONFIDENCE;
      }
      // Check for fuzzy match (partial reference or close amount)
      else if (
        stmt.reference.includes(tx.reference) ||
        tx.reference.includes(stmt.reference) ||
        Math.abs(stmt.amount - tx.amount) <= 100 // Within 1 KES
      ) {
        matchType = MatchType.FUZZY;
        confidence = this.FUZZY_MATCH_CONFIDENCE;
      }

      if (matchType && confidence > bestConfidence) {
        bestMatch = {
          transactionId: tx.id,
          amount: tx.amount,
          date: tx.date,
          description: tx.description,
          matchType,
          confidence,
        };
        bestConfidence = confidence;
      }

      // Early exit on exact match
      if (confidence === this.EXACT_MATCH_CONFIDENCE) break;
    }

    return bestMatch;
  }

  /**
   * Manually match a reconciliation item
   */
  async manualMatch(
    itemId: string,
    ledgerTransactionId: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<ReconciliationItem> {
    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ReconciliationItem);
      const recordRepo = manager.getRepository(ReconciliationRecord);

      const item = await itemRepo.findOne({
        where: { id: itemId },
      });

      if (!item) {
        throw new NotFoundException('Reconciliation item not found');
      }

      // Get ledger transaction
      const tx = await this.transactionRepository.findOne({
        where: { id: ledgerTransactionId },
      });

      if (!tx) {
        throw new NotFoundException('Ledger transaction not found');
      }

      // Update item
      item.ledgerTransactionId = tx.id;
      item.ledgerAmount = Number(tx.amount);
      item.ledgerDate = tx.completedAt || tx.createdAt;
      item.ledgerDescription = tx.description;
      item.matchType = MatchType.MANUAL;
      item.matchConfidence = 100;
      item.variance = (item.sourceAmount || 0) - Number(tx.amount);
      item.status = ReconciliationStatus.MATCHED;
      item.resolvedBy = resolvedBy;
      item.resolvedAt = new Date();
      item.resolutionNotes = notes;

      await itemRepo.save(item);

      // Update record counts
      const record = await recordRepo.findOne({
        where: { id: item.reconciliationId },
      });

      if (record) {
        record.matchedCount++;
        record.unmatchedCount--;
        record.manualMatchedCount++;

        if (record.unmatchedCount === 0) {
          record.status = ReconciliationStatus.MATCHED;
        }

        await recordRepo.save(record);
      }

      this.logger.log(`Manually matched item ${itemId} to transaction ${ledgerTransactionId}`);

      return item;
    });
  }

  /**
   * Resolve an unmatched item (write off or acknowledge)
   */
  async resolveItem(
    itemId: string,
    resolvedBy: string,
    notes: string,
  ): Promise<ReconciliationItem> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Reconciliation item not found');
    }

    item.status = ReconciliationStatus.RESOLVED;
    item.resolvedBy = resolvedBy;
    item.resolvedAt = new Date();
    item.resolutionNotes = notes;

    await this.itemRepository.save(item);

    // Update record
    const record = await this.recordRepository.findOne({
      where: { id: item.reconciliationId },
    });

    if (record) {
      record.unmatchedCount--;
      if (record.unmatchedCount === 0) {
        record.status = ReconciliationStatus.RESOLVED;
      }
      await this.recordRepository.save(record);
    }

    this.logger.log(`Resolved reconciliation item ${itemId}: ${notes}`);

    return item;
  }

  /**
   * Get reconciliation record by ID
   */
  async getById(recordId: string): Promise<ReconciliationRecord> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: ['items'],
    });

    if (!record) {
      throw new NotFoundException('Reconciliation record not found');
    }

    return record;
  }

  /**
   * Get reconciliation records by date range
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<ReconciliationRecord[]> {
    return this.recordRepository.find({
      where: {
        reconciliationDate: Between(startDate, endDate),
      },
      order: { reconciliationDate: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get unmatched items for a reconciliation
   */
  async getUnmatchedItems(recordId: string): Promise<ReconciliationItem[]> {
    return this.itemRepository.find({
      where: {
        reconciliationId: recordId,
        status: In([ReconciliationStatus.UNMATCHED, ReconciliationStatus.PENDING]),
      },
      order: { lineNumber: 'ASC' },
    });
  }

  /**
   * Get reconciliation summary statistics
   */
  async getSummaryStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalReconciliations: number;
    fullyMatched: number;
    withUnmatched: number;
    totalVariance: number;
    averageMatchRate: number;
  }> {
    const records = await this.getByDateRange(startDate, endDate);

    const fullyMatched = records.filter(
      (r) => r.status === ReconciliationStatus.MATCHED || r.status === ReconciliationStatus.RESOLVED,
    ).length;

    const withUnmatched = records.filter(
      (r) => r.status === ReconciliationStatus.UNMATCHED || r.status === ReconciliationStatus.IN_PROGRESS,
    ).length;

    const totalVariance = records.reduce((sum, r) => sum + Math.abs(Number(r.variance)), 0);

    const totalMatchRate = records.reduce((sum, r) => sum + r.getMatchPercentage(), 0);
    const averageMatchRate = records.length > 0 ? totalMatchRate / records.length : 0;

    return {
      totalReconciliations: records.length,
      fullyMatched,
      withUnmatched,
      totalVariance,
      averageMatchRate: Math.round(averageMatchRate),
    };
  }
}
