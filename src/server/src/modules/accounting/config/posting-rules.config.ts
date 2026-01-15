import { JournalEntryType } from '../entities/journal-entry.entity.js';

/**
 * Account codes from Chart of Accounts
 * Per Accounting_Remediation.md
 */
export const GL_ACCOUNTS = {
  // Assets (1XXX)
  CASH_UBA_ESCROW: '1001',
  CASH_PLATFORM_OPERATING: '1002',
  RECEIVABLE_DEFINITE_COMMISSION: '1101',

  // Liabilities (2XXX)
  PREMIUM_PAYABLE_DEFINITE: '2001',
  SERVICE_FEE_PAYABLE_KBA: '2002',
  SERVICE_FEE_PAYABLE_ROBS: '2003',
  COMMISSION_PAYABLE_KBA: '2004',
  COMMISSION_PAYABLE_ROBS: '2005',
  REFUND_PAYABLE_RIDERS: '2101',

  // Income (4XXX)
  SERVICE_FEE_INCOME_PLATFORM: '4001',
  COMMISSION_INCOME_OM: '4002',
  COMMISSION_INCOME_PROFIT: '4003',
  REVERSAL_FEE_INCOME: '4004',

  // Expenses (5XXX)
  PLATFORM_MAINTENANCE: '5001',
  TRANSACTION_COSTS: '5002',
} as const;

/**
 * Payment amounts from business model (all in cents)
 * Per Accounting_Remediation.md
 */
export const PAYMENT_AMOUNTS = {
  // Day 1 deposit breakdown
  DAY1_TOTAL: 104800, // KES 1,048.00
  DAY1_PREMIUM: 104500, // KES 1,045.00
  DAY1_SERVICE_FEE: 300, // KES 3.00 (KES 1 each to Platform, KBA, Robs)

  // Daily payment breakdown
  DAILY_TOTAL: 8700, // KES 87.00
  DAILY_PREMIUM: 8400, // KES 84.00
  DAILY_SERVICE_FEE: 300, // KES 3.00 (KES 1 each)

  // Service fee distribution
  SERVICE_FEE_PLATFORM: 100, // KES 1.00
  SERVICE_FEE_KBA: 100, // KES 1.00
  SERVICE_FEE_ROBS: 100, // KES 1.00

  // Refund percentages
  REFUND_RIDER_PERCENT: 90,
  REFUND_REVERSAL_FEE_PERCENT: 10,
  REVERSAL_FEE_PLATFORM_PERCENT: 70,
  REVERSAL_FEE_KBA_PERCENT: 15,
  REVERSAL_FEE_ROBS_PERCENT: 15,
} as const;

/**
 * Journal entry line input type
 */
export interface PostingLine {
  accountCode: string;
  debitAmount?: number;
  creditAmount?: number;
  description: string;
}

/**
 * Get posting lines for Day 1 payment receipt
 *
 * Debit:  1001 Cash at Bank - UBA Escrow         1,048.00
 * Credit: 2001 Premium Payable to Definite       1,045.00
 * Credit: 2002 Service Fee Payable to KBA            1.00
 * Credit: 2003 Service Fee Payable to Robs           1.00
 * Credit: 4001 Platform Service Fee Income           1.00
 */
export function getDay1PaymentPostingLines(amountCents: number): PostingLine[] {
  if (amountCents !== PAYMENT_AMOUNTS.DAY1_TOTAL) {
    throw new Error(
      `Invalid Day 1 amount: expected ${PAYMENT_AMOUNTS.DAY1_TOTAL}, got ${amountCents}`,
    );
  }

  return [
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      debitAmount: PAYMENT_AMOUNTS.DAY1_TOTAL,
      description: 'Day 1 payment received',
    },
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      creditAmount: PAYMENT_AMOUNTS.DAY1_PREMIUM,
      description: 'Premium payable to Definite Assurance',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA,
      creditAmount: PAYMENT_AMOUNTS.SERVICE_FEE_KBA,
      description: 'Service fee payable to KBA',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS,
      creditAmount: PAYMENT_AMOUNTS.SERVICE_FEE_ROBS,
      description: 'Service fee payable to Robs Insurance',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_INCOME_PLATFORM,
      creditAmount: PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM,
      description: 'Service fee income - Platform',
    },
  ];
}

/**
 * Get posting lines for daily payment receipt
 *
 * Debit:  1001 Cash at Bank - UBA Escrow            87.00
 * Credit: 2001 Premium Payable to Definite          84.00
 * Credit: 2002 Service Fee Payable to KBA            1.00
 * Credit: 2003 Service Fee Payable to Robs           1.00
 * Credit: 4001 Platform Service Fee Income           1.00
 */
export function getDailyPaymentPostingLines(
  amountCents: number,
  daysCount: number = 1,
): PostingLine[] {
  const expectedAmount = PAYMENT_AMOUNTS.DAILY_TOTAL * daysCount;
  if (amountCents !== expectedAmount) {
    throw new Error(
      `Invalid daily payment amount: expected ${expectedAmount}, got ${amountCents}`,
    );
  }

  const premiumAmount = PAYMENT_AMOUNTS.DAILY_PREMIUM * daysCount;
  const serviceFeeKba = PAYMENT_AMOUNTS.SERVICE_FEE_KBA * daysCount;
  const serviceFeeRobs = PAYMENT_AMOUNTS.SERVICE_FEE_ROBS * daysCount;
  const serviceFeePlatform = PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM * daysCount;

  return [
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      debitAmount: amountCents,
      description: `Daily payment received (${daysCount} day${daysCount > 1 ? 's' : ''})`,
    },
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      creditAmount: premiumAmount,
      description: 'Premium payable to Definite Assurance',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA,
      creditAmount: serviceFeeKba,
      description: 'Service fee payable to KBA',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS,
      creditAmount: serviceFeeRobs,
      description: 'Service fee payable to Robs Insurance',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_INCOME_PLATFORM,
      creditAmount: serviceFeePlatform,
      description: 'Service fee income - Platform',
    },
  ];
}

/**
 * Get posting lines for Day 1 premium remittance to Definite
 *
 * Debit:  2001 Premium Payable to Definite       1,045.00
 * Credit: 1001 Cash at Bank - UBA Escrow         1,045.00
 */
export function getDay1RemittancePostingLines(amountCents: number): PostingLine[] {
  return [
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      debitAmount: amountCents,
      description: 'Premium remitted to Definite Assurance',
    },
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      creditAmount: amountCents,
      description: 'Payment to Definite Assurance',
    },
  ];
}

/**
 * Get posting lines for bulk premium remittance (Policy 2)
 *
 * Debit:  2001 Premium Payable to Definite       2,520.00
 * Credit: 1001 Cash at Bank - UBA Escrow         2,520.00
 */
export function getBulkRemittancePostingLines(amountCents: number): PostingLine[] {
  return [
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      debitAmount: amountCents,
      description: 'Bulk premium remitted to Definite Assurance (Policy 2)',
    },
    {
      accountCode: GL_ACCOUNTS.CASH_UBA_ESCROW,
      creditAmount: amountCents,
      description: 'Payment to Definite Assurance',
    },
  ];
}

/**
 * Get posting lines for refund initiation
 *
 * Example: 870 KES refund (10 days × 87 KES)
 * Reversal fee: 87 KES (10%)
 * Rider refund: 783 KES (90%)
 *
 * Debit:  2001 Premium Payable to Definite         840.00
 * Debit:  2002 Service Fee Payable to KBA           10.00
 * Debit:  2003 Service Fee Payable to Robs          10.00
 * Debit:  4001 Platform Service Fee Income          10.00
 * Credit: 2101 Refund Payable to Riders            783.00
 * Credit: 4004 Reversal Fee Income - Platform       60.90
 * Credit: 2002 Service Fee Payable to KBA           13.05
 * Credit: 2003 Service Fee Payable to Robs          13.05
 */
export function getRefundPostingLines(
  amountCents: number,
  daysCount: number,
): PostingLine[] {
  const riderRefund = Math.floor(
    (amountCents * PAYMENT_AMOUNTS.REFUND_RIDER_PERCENT) / 100,
  );
  const reversalFee = amountCents - riderRefund;
  const reversalFeePlatform = Math.floor(
    (reversalFee * PAYMENT_AMOUNTS.REVERSAL_FEE_PLATFORM_PERCENT) / 100,
  );
  const reversalFeeKba = Math.floor(
    (reversalFee * PAYMENT_AMOUNTS.REVERSAL_FEE_KBA_PERCENT) / 100,
  );
  const reversalFeeRobs = reversalFee - reversalFeePlatform - reversalFeeKba;

  const premiumRefund = PAYMENT_AMOUNTS.DAILY_PREMIUM * daysCount;
  const serviceFeeKbaRefund = PAYMENT_AMOUNTS.SERVICE_FEE_KBA * daysCount;
  const serviceFeeRobsRefund = PAYMENT_AMOUNTS.SERVICE_FEE_ROBS * daysCount;
  const serviceFeePlatformRefund = PAYMENT_AMOUNTS.SERVICE_FEE_PLATFORM * daysCount;

  return [
    // Reverse the original allocations
    {
      accountCode: GL_ACCOUNTS.PREMIUM_PAYABLE_DEFINITE,
      debitAmount: premiumRefund,
      description: 'Reverse premium payable for refund',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA,
      debitAmount: serviceFeeKbaRefund,
      description: 'Reverse service fee payable to KBA',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS,
      debitAmount: serviceFeeRobsRefund,
      description: 'Reverse service fee payable to Robs',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_INCOME_PLATFORM,
      debitAmount: serviceFeePlatformRefund,
      description: 'Reverse service fee income - Platform',
    },
    // Record refund payable to rider
    {
      accountCode: GL_ACCOUNTS.REFUND_PAYABLE_RIDERS,
      creditAmount: riderRefund,
      description: 'Refund payable to rider (90%)',
    },
    // Record reversal fee distribution
    {
      accountCode: GL_ACCOUNTS.REVERSAL_FEE_INCOME,
      creditAmount: reversalFeePlatform,
      description: 'Reversal fee income - Platform (70%)',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_KBA,
      creditAmount: reversalFeeKba,
      description: 'Reversal fee payable to KBA (15%)',
    },
    {
      accountCode: GL_ACCOUNTS.SERVICE_FEE_PAYABLE_ROBS,
      creditAmount: reversalFeeRobs,
      description: 'Reversal fee payable to Robs (15%)',
    },
  ];
}

/**
 * Get posting lines for refund payout to rider
 *
 * When the refund is actually paid out to the rider (M-Pesa B2C):
 * Debit:  2101 Refund Payable to Riders (reduce liability)
 * Credit: 1002 Cash at Bank - Platform Operating (cash leaves)
 *
 * @param refundAmountCents - The 90% amount going to rider
 */
export function getRefundPayoutPostingLines(refundAmountCents: number): PostingLine[] {
  return [
    {
      accountCode: GL_ACCOUNTS.REFUND_PAYABLE_RIDERS,
      debitAmount: refundAmountCents,
      description: 'Refund paid to rider - clearing liability',
    },
    {
      accountCode: GL_ACCOUNTS.CASH_PLATFORM_OPERATING,
      creditAmount: refundAmountCents,
      description: 'Cash paid out for rider refund',
    },
  ];
}

/**
 * Get the journal entry type for a payment type
 */
export function getJournalEntryTypeForPayment(
  paymentType: 'DEPOSIT' | 'DAILY_PAYMENT',
): JournalEntryType {
  return paymentType === 'DEPOSIT'
    ? JournalEntryType.PAYMENT_RECEIPT_DAY1
    : JournalEntryType.PAYMENT_RECEIPT_DAILY;
}
