import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CashFlowReportData,
  CashFlowReportParams,
  CashFlowLineItem,
  CashFlowPeriodResult,
  CashReceiptSummary,
  CashDisbursementSummary,
} from '../interfaces/cash-flow.interface.js';

/**
 * Cash Flow Report Service
 *
 * Generates Statement of Cash Flows reports following standard accounting conventions.
 * Calculates cash receipts (inflows), disbursements (outflows), and balance changes.
 *
 * Note: For MVP, disbursements are not tracked and will show as 0.
 */
@Injectable()
export class CashFlowReportService {
  private readonly logger = new Logger(CashFlowReportService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generate a complete cash flow report
   */
  async generateCashFlowReport(params: CashFlowReportParams): Promise<CashFlowReportData> {
    const { startDate, endDate, organizationId, includePriorPeriod = true } = params;

    this.logger.log(
      `Generating cash flow report: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Calculate current period data
    const currentPeriodResult = await this.calculatePeriodData(
      startDate,
      endDate,
      organizationId,
    );

    // Calculate prior period data if requested
    const priorPeriodDates = this.calculatePriorPeriod(startDate, endDate);
    let priorPeriodResult: CashFlowPeriodResult | null = null;

    if (includePriorPeriod) {
      priorPeriodResult = await this.calculatePeriodData(
        priorPeriodDates.startDate,
        priorPeriodDates.endDate,
        organizationId,
      );
    }

    // Get organization name if filtering by organization
    const organizationName = organizationId
      ? await this.getOrganizationName(organizationId)
      : 'All Organizations';

    // Build the line items structure
    const lineItems = this.buildLineItems(currentPeriodResult, priorPeriodResult);

    return {
      reportTitle: 'Statement of Cash Flows',
      organizationName,
      currentPeriod: {
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
      },
      priorPeriod: {
        startDate: this.formatDate(priorPeriodDates.startDate),
        endDate: this.formatDate(priorPeriodDates.endDate),
      },
      lineItems,
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId,
      },
    };
  }

  /**
   * Calculate all cash flow data for a given period
   */
  private async calculatePeriodData(
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ): Promise<CashFlowPeriodResult> {
    // Calculate beginning balance (sum of all completed transactions before start date)
    const beginningBalance = await this.calculateBeginningBalance(startDate, organizationId);

    // Calculate cash receipts for the period
    const receipts = await this.calculateCashReceipts(startDate, endDate, organizationId);

    // Calculate cash disbursements for the period (MVP: returns zeros)
    const disbursements = await this.calculateCashDisbursements(startDate, endDate, organizationId);

    // Calculate net change
    const netChange = receipts.total - disbursements.total;

    // Calculate ending balance
    const endingBalance = beginningBalance + netChange;

    return {
      beginningBalance,
      receipts,
      disbursements,
      netChange,
      endingBalance,
    };
  }

  /**
   * Calculate beginning cash balance as of a specific date
   * This sums all completed transactions before the start date
   */
  private async calculateBeginningBalance(date: Date, organizationId?: string): Promise<number> {
    let query = `
      SELECT COALESCE(SUM(
        CASE
          WHEN t.type IN ('DEPOSIT', 'DAILY_PAYMENT', 'REFUND') THEN t.amount
          WHEN t.type IN ('REVERSAL') THEN -t.amount
          ELSE 0
        END
      ), 0) / 100.0 as balance
      FROM transactions t
      WHERE t.status = 'COMPLETED'
        AND t.completed_at < $1
    `;

    const params: unknown[] = [date];
    let paramIndex = 2;

    if (organizationId) {
      query += ` AND t.user_id IN (SELECT user_id FROM memberships WHERE organization_id = $${paramIndex++})`;
      params.push(organizationId);
    }

    const result = await this.dataSource.query(query, params);
    return parseFloat(result[0]?.balance || '0');
  }

  /**
   * Calculate cash receipts (inflows) for a period
   */
  private async calculateCashReceipts(
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ): Promise<CashReceiptSummary> {
    let query = `
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'DEPOSIT' THEN t.amount ELSE 0 END), 0) / 100.0 as deposits,
        COALESCE(SUM(CASE WHEN t.type = 'DAILY_PAYMENT' THEN t.amount ELSE 0 END), 0) / 100.0 as daily_payments,
        COALESCE(SUM(CASE WHEN t.type IN ('REFUND', 'ADJUSTMENT') AND t.amount > 0 THEN t.amount ELSE 0 END), 0) / 100.0 as other_receipts
      FROM transactions t
      WHERE t.status = 'COMPLETED'
        AND t.completed_at >= $1
        AND t.completed_at < ($2::date + interval '1 day')
    `;

    const params: unknown[] = [startDate, endDate];
    let paramIndex = 3;

    if (organizationId) {
      query += ` AND t.user_id IN (SELECT user_id FROM memberships WHERE organization_id = $${paramIndex++})`;
      params.push(organizationId);
    }

    const result = await this.dataSource.query(query, params);
    const row = result[0] || { deposits: 0, daily_payments: 0, other_receipts: 0 };

    const deposits = parseFloat(row.deposits || '0');
    const dailyPayments = parseFloat(row.daily_payments || '0');
    const otherReceipts = parseFloat(row.other_receipts || '0');

    return {
      deposits,
      dailyPayments,
      otherReceipts,
      total: deposits + dailyPayments + otherReceipts,
    };
  }

  /**
   * Calculate cash disbursements (outflows) for a period
   * Note: For MVP, disbursements are not tracked - returns zeros
   */
  private async calculateCashDisbursements(
    _startDate: Date,
    _endDate: Date,
    _organizationId?: string,
  ): Promise<CashDisbursementSummary> {
    // MVP: Disbursements are not tracked
    // In future phases, this would query:
    // - Underwriter remittance payments
    // - Platform fee deductions
    // - Agent commission payments
    return {
      underwriterRemittances: 0,
      platformFees: 0,
      commissionPayments: 0,
      otherDisbursements: 0,
      total: 0,
    };
  }

  /**
   * Calculate the prior period dates based on current period
   * Prior period is the same duration immediately preceding the current period
   */
  private calculatePriorPeriod(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
    const durationMs = endDate.getTime() - startDate.getTime();
    const priorEnd = new Date(startDate.getTime() - 1); // Day before current start
    const priorStart = new Date(priorEnd.getTime() - durationMs);

    // Adjust to start of day for prior start
    priorStart.setUTCHours(0, 0, 0, 0);

    return {
      startDate: priorStart,
      endDate: priorEnd,
    };
  }

  /**
   * Get organization name by ID
   */
  private async getOrganizationName(organizationId: string): Promise<string> {
    const result = await this.dataSource.query(
      'SELECT name FROM organizations WHERE id = $1',
      [organizationId],
    );
    return result[0]?.name || 'Unknown Organization';
  }

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Build the line items array for the report
   */
  private buildLineItems(
    current: CashFlowPeriodResult,
    prior: CashFlowPeriodResult | null,
  ): CashFlowLineItem[] {
    const items: CashFlowLineItem[] = [];

    // Helper to create a line item
    const createItem = (
      id: string,
      label: string,
      indent: number,
      isTotal: boolean,
      isBold: boolean,
      currentValue: number | null,
      priorValue: number | null,
    ): CashFlowLineItem => ({
      id,
      label,
      indent,
      isTotal,
      isBold,
      currentPeriod: currentValue,
      priorPeriod: priorValue,
      variance:
        currentValue !== null && priorValue !== null
          ? this.round(currentValue - priorValue)
          : null,
    });

    // Beginning Cash Balance
    items.push(
      createItem(
        'beginning_balance',
        'BEGINNING CASH ON HAND',
        0,
        false,
        true,
        this.round(current.beginningBalance),
        prior ? this.round(prior.beginningBalance) : null,
      ),
    );

    // Empty row for spacing
    items.push(createItem('spacer_1', '', 0, false, false, null, null));

    // Cash Receipts Section Header
    items.push(
      createItem('section_receipts', 'ADD: CASH RECEIPTS', 0, false, true, null, null),
    );

    // Receipt line items
    items.push(
      createItem(
        'deposits',
        'Premium Deposits',
        1,
        false,
        false,
        this.round(current.receipts.deposits),
        prior ? this.round(prior.receipts.deposits) : null,
      ),
    );

    items.push(
      createItem(
        'daily_payments',
        'Daily Payments',
        1,
        false,
        false,
        this.round(current.receipts.dailyPayments),
        prior ? this.round(prior.receipts.dailyPayments) : null,
      ),
    );

    items.push(
      createItem(
        'other_receipts',
        'Other Receipts',
        1,
        false,
        false,
        this.round(current.receipts.otherReceipts),
        prior ? this.round(prior.receipts.otherReceipts) : null,
      ),
    );

    // Total Cash Receipts
    items.push(
      createItem(
        'total_receipts',
        'TOTAL CASH RECEIPTS',
        0,
        true,
        true,
        this.round(current.receipts.total),
        prior ? this.round(prior.receipts.total) : null,
      ),
    );

    // Empty row for spacing
    items.push(createItem('spacer_2', '', 0, false, false, null, null));

    // Cash Disbursements Section Header
    items.push(
      createItem(
        'section_disbursements',
        'LESS: CASH DISBURSEMENTS',
        0,
        false,
        true,
        null,
        null,
      ),
    );

    // Disbursement line items (MVP: placeholder showing not tracked)
    items.push(
      createItem(
        'disbursements_placeholder',
        '(Not tracked in MVP)',
        1,
        false,
        false,
        0,
        prior ? 0 : null,
      ),
    );

    // Total Cash Disbursements
    items.push(
      createItem(
        'total_disbursements',
        'TOTAL CASH DISBURSEMENTS',
        0,
        true,
        true,
        this.round(current.disbursements.total),
        prior ? this.round(prior.disbursements.total) : null,
      ),
    );

    // Empty row for spacing
    items.push(createItem('spacer_3', '', 0, false, false, null, null));

    // Net Increase/Decrease
    items.push(
      createItem(
        'net_change',
        'NET INCREASE (DECREASE) IN CASH',
        0,
        true,
        true,
        this.round(current.netChange),
        prior ? this.round(prior.netChange) : null,
      ),
    );

    // Ending Cash Balance
    items.push(
      createItem(
        'ending_balance',
        'ENDING CASH ON HAND',
        0,
        true,
        true,
        this.round(current.endingBalance),
        prior ? this.round(prior.endingBalance) : null,
      ),
    );

    return items;
  }

  /**
   * Round a number to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Transform CashFlowReportData to flat rows format for export
   * This is used by the export service for CSV/Excel generation
   */
  transformToFlatRows(data: CashFlowReportData): {
    columns: string[];
    rows: Record<string, unknown>[];
  } {
    const columns = [
      'lineItem',
      'currentPeriod',
      'priorPeriod',
      'variance',
    ];

    const rows: Record<string, unknown>[] = [];

    for (const item of data.lineItems) {
      // Skip spacer rows in export
      if (item.label === '') continue;

      const indent = '  '.repeat(item.indent);
      rows.push({
        lineItem: indent + item.label,
        currentPeriod: item.currentPeriod !== null ? item.currentPeriod : '',
        priorPeriod: item.priorPeriod !== null ? item.priorPeriod : '',
        variance: item.variance !== null ? item.variance : '',
      });
    }

    return { columns, rows };
  }
}
