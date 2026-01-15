import { Injectable, Logger } from '@nestjs/common';
import { JournalEntryService } from './journal-entry.service.js';
import { JournalEntryType } from '../entities/journal-entry.entity.js';
import {
  PAYMENT_AMOUNTS,
  getDay1PaymentPostingLines,
  getDailyPaymentPostingLines,
  getDay1RemittancePostingLines,
  getBulkRemittancePostingLines,
  getRefundPostingLines,
  getJournalEntryTypeForPayment,
} from '../config/posting-rules.config.js';

/**
 * Payment posting input
 */
export interface PaymentPostingInput {
  transactionId: string;
  userId: string;
  paymentType: 'DEPOSIT' | 'DAILY_PAYMENT';
  amountCents: number;
  daysCount?: number;
  mpesaReceiptNumber?: string;
  description?: string;
}

/**
 * Remittance posting input
 */
export interface RemittancePostingInput {
  transactionId: string;
  amountCents: number;
  remittanceType: 'DAY1' | 'BULK';
  description?: string;
  createdBy?: string;
}

/**
 * Refund posting input
 */
export interface RefundPostingInput {
  transactionId: string;
  userId: string;
  amountCents: number;
  daysCount: number;
  description?: string;
  createdBy?: string;
}

/**
 * Posting result
 */
export interface PostingResult {
  success: boolean;
  journalEntryId?: string;
  entryNumber?: string;
  message: string;
  alreadyPosted?: boolean;
}

/**
 * Posting Engine Service
 *
 * Automates journal entry creation for payment transactions.
 * Implements idempotency - safe to call multiple times for the same transaction.
 *
 * Per Accounting_Remediation.md - Epic 3
 */
@Injectable()
export class PostingEngineService {
  private readonly logger = new Logger(PostingEngineService.name);

  constructor(private readonly journalEntryService: JournalEntryService) {}

  /**
   * Post a payment receipt (deposit or daily payment)
   *
   * Idempotent: Checks if journal entry already exists for this transaction.
   * Safe to call from both M-Pesa callback and UI refresh/retry.
   *
   * @param input - Payment details
   * @returns Posting result with journal entry ID
   */
  async postPaymentReceipt(input: PaymentPostingInput): Promise<PostingResult> {
    const { transactionId, userId, paymentType, amountCents, daysCount = 1 } = input;

    // Check if already posted (idempotency)
    const existingEntries = await this.journalEntryService.getBySourceTransactionId(transactionId);
    const existing = existingEntries[0];
    if (existing) {
      this.logger.debug(
        `Journal entry already exists for transaction ${transactionId.slice(0, 8)}...: ${existing.entryNumber}`,
      );
      return {
        success: true,
        journalEntryId: existing.id,
        entryNumber: existing.entryNumber,
        message: 'Journal entry already posted',
        alreadyPosted: true,
      };
    }

    try {
      // Get posting lines based on payment type
      const lines = paymentType === 'DEPOSIT'
        ? getDay1PaymentPostingLines(amountCents)
        : getDailyPaymentPostingLines(amountCents, daysCount);

      const entryType = getJournalEntryTypeForPayment(paymentType);
      const description = paymentType === 'DEPOSIT'
        ? `Day 1 deposit payment received${input.mpesaReceiptNumber ? ` (${input.mpesaReceiptNumber})` : ''}`
        : `Daily payment received (${daysCount} day${daysCount > 1 ? 's' : ''})${input.mpesaReceiptNumber ? ` (${input.mpesaReceiptNumber})` : ''}`;

      // Create and auto-post journal entry
      const journalEntry = await this.journalEntryService.create({
        entryType,
        entryDate: new Date(),
        description: input.description || description,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description,
        })),
        sourceTransactionId: transactionId,
        sourceEntityType: 'Transaction',
        sourceEntityId: transactionId,
        riderId: userId,
        autoPost: true,
        metadata: {
          paymentType,
          amountCents,
          daysCount,
          mpesaReceiptNumber: input.mpesaReceiptNumber,
        },
      });

      this.logger.log(
        `Posted ${paymentType} receipt: txn=${transactionId.slice(0, 8)}... entry=${journalEntry.entryNumber} amount=${amountCents / 100} KES`,
      );

      return {
        success: true,
        journalEntryId: journalEntry.id,
        entryNumber: journalEntry.entryNumber,
        message: `Journal entry ${journalEntry.entryNumber} created and posted`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to post payment receipt for transaction ${transactionId.slice(0, 8)}...`,
        error,
      );
      return {
        success: false,
        message: `Posting failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Post a premium remittance to underwriter
   *
   * @param input - Remittance details
   * @returns Posting result
   */
  async postRemittance(input: RemittancePostingInput): Promise<PostingResult> {
    const { transactionId, amountCents, remittanceType } = input;

    // Check if already posted (idempotency)
    const existingEntries = await this.journalEntryService.getBySourceTransactionId(transactionId);
    const existing = existingEntries[0];
    if (existing) {
      return {
        success: true,
        journalEntryId: existing.id,
        entryNumber: existing.entryNumber,
        message: 'Journal entry already posted',
        alreadyPosted: true,
      };
    }

    try {
      const lines = remittanceType === 'DAY1'
        ? getDay1RemittancePostingLines(amountCents)
        : getBulkRemittancePostingLines(amountCents);

      const entryType = remittanceType === 'DAY1'
        ? JournalEntryType.PREMIUM_REMITTANCE_DAY1
        : JournalEntryType.PREMIUM_REMITTANCE_BULK;

      const description = input.description ||
        `Premium remittance to Definite Assurance (${remittanceType === 'DAY1' ? 'Day 1' : 'Bulk'})`;

      const journalEntry = await this.journalEntryService.create({
        entryType,
        entryDate: new Date(),
        description,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description,
        })),
        sourceTransactionId: transactionId,
        sourceEntityType: 'Remittance',
        sourceEntityId: transactionId,
        createdBy: input.createdBy,
        autoPost: true,
        metadata: {
          remittanceType,
          amountCents,
        },
      });

      this.logger.log(
        `Posted ${remittanceType} remittance: entry=${journalEntry.entryNumber} amount=${amountCents / 100} KES`,
      );

      return {
        success: true,
        journalEntryId: journalEntry.id,
        entryNumber: journalEntry.entryNumber,
        message: `Journal entry ${journalEntry.entryNumber} created and posted`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to post remittance`, error);
      return {
        success: false,
        message: `Posting failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Post a refund transaction
   *
   * @param input - Refund details
   * @returns Posting result
   */
  async postRefund(input: RefundPostingInput): Promise<PostingResult> {
    const { transactionId, userId, amountCents, daysCount } = input;

    // Check if already posted (idempotency)
    const existingEntries = await this.journalEntryService.getBySourceTransactionId(transactionId);
    const existing = existingEntries[0];
    if (existing) {
      return {
        success: true,
        journalEntryId: existing.id,
        entryNumber: existing.entryNumber,
        message: 'Journal entry already posted',
        alreadyPosted: true,
      };
    }

    try {
      const lines = getRefundPostingLines(amountCents, daysCount);

      const riderRefund = Math.floor((amountCents * PAYMENT_AMOUNTS.REFUND_RIDER_PERCENT) / 100);
      const description = input.description ||
        `Refund initiated: ${amountCents / 100} KES (${daysCount} days), rider receives ${riderRefund / 100} KES`;

      const journalEntry = await this.journalEntryService.create({
        entryType: JournalEntryType.REFUND_INITIATION,
        entryDate: new Date(),
        description,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description,
        })),
        sourceTransactionId: transactionId,
        sourceEntityType: 'Refund',
        sourceEntityId: transactionId,
        riderId: userId,
        createdBy: input.createdBy,
        autoPost: true,
        metadata: {
          amountCents,
          daysCount,
          riderRefund,
          reversalFee: amountCents - riderRefund,
        },
      });

      this.logger.log(
        `Posted refund: txn=${transactionId.slice(0, 8)}... entry=${journalEntry.entryNumber} amount=${amountCents / 100} KES`,
      );

      return {
        success: true,
        journalEntryId: journalEntry.id,
        entryNumber: journalEntry.entryNumber,
        message: `Journal entry ${journalEntry.entryNumber} created and posted`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to post refund for transaction ${transactionId.slice(0, 8)}...`,
        error,
      );
      return {
        success: false,
        message: `Posting failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if a transaction has been posted
   *
   * @param transactionId - Transaction ID to check
   * @returns True if journal entry exists for this transaction
   */
  async isTransactionPosted(transactionId: string): Promise<boolean> {
    const entries = await this.journalEntryService.getBySourceTransactionId(transactionId);
    return entries.length > 0;
  }

  /**
   * Get journal entries for a transaction
   *
   * @param transactionId - Transaction ID
   * @returns Journal entries for this transaction
   */
  async getEntriesForTransaction(transactionId: string) {
    return this.journalEntryService.getBySourceTransactionId(transactionId);
  }
}
