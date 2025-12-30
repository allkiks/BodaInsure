/**
 * Cash Flow Statement Interfaces
 *
 * Defines data structures for generating Statement of Cash Flows reports
 * following standard accounting conventions.
 */

/**
 * Represents a single line item in the cash flow statement
 */
export interface CashFlowLineItem {
  /** Unique identifier for the line item */
  id: string;

  /** Display label for the line item */
  label: string;

  /** Indentation level: 0=section header, 1=line item, 2=sub-item */
  indent: number;

  /** Whether this is a total/subtotal row */
  isTotal: boolean;

  /** Whether to render in bold */
  isBold: boolean;

  /** Value for current reporting period (null for section headers) */
  currentPeriod: number | null;

  /** Value for prior comparison period (null for section headers) */
  priorPeriod: number | null;

  /** Variance: currentPeriod - priorPeriod (null for section headers) */
  variance: number | null;
}

/**
 * Date range for a reporting period
 */
export interface CashFlowPeriod {
  startDate: string;
  endDate: string;
}

/**
 * Complete cash flow report data structure
 */
export interface CashFlowReportData {
  /** Report title */
  reportTitle: string;

  /** Organization name for the report header */
  organizationName: string;

  /** Current reporting period date range */
  currentPeriod: CashFlowPeriod;

  /** Prior comparison period date range */
  priorPeriod: CashFlowPeriod;

  /** All line items in display order */
  lineItems: CashFlowLineItem[];

  /** Metadata about the report generation */
  metadata?: {
    generatedAt: string;
    generatedBy?: string;
    organizationId?: string;
  };
}

/**
 * Parameters for generating a cash flow report
 */
export interface CashFlowReportParams {
  /** Start date for the current period */
  startDate: Date;

  /** End date for the current period */
  endDate: Date;

  /** Optional organization ID for filtering */
  organizationId?: string;

  /** Whether to include prior period comparison (default: true) */
  includePriorPeriod?: boolean;
}

/**
 * Internal structure for cash receipt aggregation
 */
export interface CashReceiptSummary {
  /** Total deposit payments received */
  deposits: number;

  /** Total daily payments received */
  dailyPayments: number;

  /** Other receipts (refunds, adjustments) */
  otherReceipts: number;

  /** Grand total of all receipts */
  total: number;
}

/**
 * Internal structure for cash disbursement aggregation
 * Note: For MVP, disbursements are not tracked and will show as 0
 */
export interface CashDisbursementSummary {
  /** Underwriter remittances (not tracked in MVP) */
  underwriterRemittances: number;

  /** Platform fees (not tracked in MVP) */
  platformFees: number;

  /** Commission payments (not tracked in MVP) */
  commissionPayments: number;

  /** Other disbursements (not tracked in MVP) */
  otherDisbursements: number;

  /** Grand total of all disbursements */
  total: number;
}

/**
 * Complete period calculation result
 */
export interface CashFlowPeriodResult {
  /** Beginning cash balance for the period */
  beginningBalance: number;

  /** Cash receipts summary */
  receipts: CashReceiptSummary;

  /** Cash disbursements summary */
  disbursements: CashDisbursementSummary;

  /** Net change in cash (receipts - disbursements) */
  netChange: number;

  /** Ending cash balance (beginning + netChange) */
  endingBalance: number;
}
