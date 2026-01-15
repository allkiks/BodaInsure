/**
 * Chart of Accounts Seed Data
 *
 * Per Accounting_Remediation.md - Epic 1
 * Defines the 15 GL accounts needed for BodaInsure double-entry accounting.
 *
 * Account Code Structure:
 * - 1XXX: Assets
 * - 2XXX: Liabilities
 * - 4XXX: Income
 * - 5XXX: Expenses
 */

import {
  GlAccountType,
  NormalBalance,
} from '../../modules/accounting/entities/gl-account.entity.js';

/**
 * GL Account Seed Configuration
 */
export interface GlAccountSeedConfig {
  code: string;
  name: string;
  type: GlAccountType;
  description?: string;
}

/**
 * Chart of Accounts - 15 GL Accounts
 *
 * Assets (1XXX):
 * - 1001: Cash at Bank - UBA Escrow (M-Pesa settlement account)
 * - 1002: Cash at Bank - Platform Operating
 * - 1101: Accounts Receivable - Definite Commission
 *
 * Liabilities (2XXX):
 * - 2001: Premium Payable to Definite Assurance (underwriter)
 * - 2002: Service Fee Payable to KBA
 * - 2003: Service Fee Payable to Robs Insurance
 * - 2004: Commission Payable to KBA
 * - 2005: Commission Payable to Robs Insurance
 * - 2101: Refund Payable to Riders
 *
 * Income (4XXX):
 * - 4001: Platform Service Fee Income
 * - 4002: Platform Commission Income - O&M
 * - 4003: Platform Commission Income - Profit Share
 * - 4004: Platform Reversal Fee Income
 *
 * Expenses (5XXX):
 * - 5001: Platform Maintenance Costs
 * - 5002: Transaction Costs
 */
export const CHART_OF_ACCOUNTS: GlAccountSeedConfig[] = [
  // ASSETS (1XXX) - Normal Balance: DEBIT
  {
    code: '1001',
    name: 'Cash at Bank - UBA Escrow',
    type: GlAccountType.ASSET,
    description: 'UBA escrow account for M-Pesa settlement. All rider payments land here.',
  },
  {
    code: '1002',
    name: 'Cash at Bank - Platform Operating',
    type: GlAccountType.ASSET,
    description: 'Platform operational account for service fees and commissions.',
  },
  {
    code: '1101',
    name: 'Accounts Receivable - Definite Commission',
    type: GlAccountType.ASSET,
    description: 'Commission receivable from Definite Assurance (15% of premium).',
  },

  // LIABILITIES (2XXX) - Normal Balance: CREDIT
  {
    code: '2001',
    name: 'Premium Payable to Definite Assurance',
    type: GlAccountType.LIABILITY,
    description: 'Net premium collected pending remittance to underwriter.',
  },
  {
    code: '2002',
    name: 'Service Fee Payable to KBA',
    type: GlAccountType.LIABILITY,
    description: 'KBA service fee (KES 1 per transaction) pending settlement.',
  },
  {
    code: '2003',
    name: 'Service Fee Payable to Robs Insurance',
    type: GlAccountType.LIABILITY,
    description: 'Robs Insurance service fee (KES 1 per transaction) pending settlement.',
  },
  {
    code: '2004',
    name: 'Commission Payable to KBA',
    type: GlAccountType.LIABILITY,
    description: 'KBA commission share pending settlement.',
  },
  {
    code: '2005',
    name: 'Commission Payable to Robs Insurance',
    type: GlAccountType.LIABILITY,
    description: 'Robs Insurance commission share pending settlement.',
  },
  {
    code: '2101',
    name: 'Refund Payable to Riders',
    type: GlAccountType.LIABILITY,
    description: 'Refunds due to riders (90% of unused daily payments).',
  },

  // INCOME (4XXX) - Normal Balance: CREDIT
  {
    code: '4001',
    name: 'Platform Service Fee Income',
    type: GlAccountType.INCOME,
    description: 'Platform service fee income (KES 1 per transaction).',
  },
  {
    code: '4002',
    name: 'Platform Commission Income - O&M',
    type: GlAccountType.INCOME,
    description: 'Platform O&M commission share (KES 100 per policy from Definite).',
  },
  {
    code: '4003',
    name: 'Platform Commission Income - Profit Share',
    type: GlAccountType.INCOME,
    description: 'Platform profit share commission (KES 37 per policy from Definite).',
  },
  {
    code: '4004',
    name: 'Platform Reversal Fee Income',
    type: GlAccountType.INCOME,
    description: 'Reversal fee income (70% of 10% reversal fee on refunds).',
  },

  // EXPENSES (5XXX) - Normal Balance: DEBIT
  {
    code: '5001',
    name: 'Platform Maintenance Costs',
    type: GlAccountType.EXPENSE,
    description: 'Platform infrastructure and maintenance expenses.',
  },
  {
    code: '5002',
    name: 'Transaction Costs',
    type: GlAccountType.EXPENSE,
    description: 'M-Pesa and other transaction processing costs.',
  },
];

/**
 * Get normal balance for an account type
 */
export function getNormalBalanceForType(accountType: GlAccountType): NormalBalance {
  return [GlAccountType.ASSET, GlAccountType.EXPENSE].includes(accountType)
    ? NormalBalance.DEBIT
    : NormalBalance.CREDIT;
}

/**
 * Summary statistics for display
 */
export const CHART_OF_ACCOUNTS_SUMMARY = {
  totalAccounts: CHART_OF_ACCOUNTS.length,
  assetAccounts: CHART_OF_ACCOUNTS.filter((a) => a.type === GlAccountType.ASSET).length,
  liabilityAccounts: CHART_OF_ACCOUNTS.filter((a) => a.type === GlAccountType.LIABILITY).length,
  incomeAccounts: CHART_OF_ACCOUNTS.filter((a) => a.type === GlAccountType.INCOME).length,
  expenseAccounts: CHART_OF_ACCOUNTS.filter((a) => a.type === GlAccountType.EXPENSE).length,
};
