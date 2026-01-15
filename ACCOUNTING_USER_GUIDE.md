# BodaInsure Accounting Module - User Guide

**Version:** 1.0
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Chart of Accounts](#chart-of-accounts)
4. [Journal Entries](#journal-entries)
5. [Partner Settlements](#partner-settlements)
6. [Reconciliations](#reconciliations)
7. [Financial Reports](#financial-reports)
8. [Exports](#exports)
9. [Audit Log](#audit-log)
10. [Scheduled Jobs](#scheduled-jobs)
11. [Troubleshooting](#troubleshooting)

---

## 1. Overview

The BodaInsure Accounting Module provides comprehensive financial management capabilities for the insurance platform. It implements double-entry bookkeeping, automated journal entry posting, partner settlements, and financial reporting.

### Key Features

- **Double-Entry Bookkeeping**: All financial transactions are recorded with balanced debits and credits
- **Automated Posting**: Payment transactions automatically create journal entries
- **Partner Settlements**: Track and process payments to partners (KBA, Robs Insurance, Definite Assurance)
- **Bank Reconciliation**: Match bank statements with system transactions
- **Financial Reports**: Balance Sheet, Income Statement, Trial Balance, Partner Statements
- **Export Functionality**: Download reports in CSV or Excel format
- **Audit Trail**: Complete history of all financial transactions

### Access Requirements

The accounting module is available to users with the following roles:
- **Platform Admin**: Full access to all features
- **Insurance Admin**: Full access to all features

---

## 2. Getting Started

### Accessing the Accounting Module

1. Log in to the BodaInsure Admin Portal
2. Navigate to **Accounting** in the left sidebar
3. You'll see the Accounting Dashboard with key metrics

### Dashboard Overview

The Accounting Dashboard displays:

| Metric | Description |
|--------|-------------|
| **Total Assets** | Sum of all asset account balances |
| **Total Liabilities** | Sum of all liability account balances |
| **Net Income** | Revenue minus expenses |
| **Cash Balance** | Current balance in bank/escrow accounts |
| **Premium Payable** | Outstanding premiums to remit to underwriter |
| **Service Fees Payable** | Outstanding service fees to distribute |

---

## 3. Chart of Accounts

The Chart of Accounts is the foundation of the accounting system. It lists all GL (General Ledger) accounts used for recording transactions.

### Navigating to Chart of Accounts

1. Go to **Accounting > Chart of Accounts**
2. View all accounts organized by type

### Account Types

| Type | Description | Normal Balance |
|------|-------------|----------------|
| **ASSET** | Resources owned (cash, receivables) | Debit |
| **LIABILITY** | Amounts owed (payables) | Credit |
| **EQUITY** | Owner's interest | Credit |
| **INCOME** | Revenue earned | Credit |
| **EXPENSE** | Costs incurred | Debit |

### BodaInsure Account Structure

| Code | Name | Type |
|------|------|------|
| 1001 | Cash at Bank - UBA Escrow | ASSET |
| 1002 | Cash at Bank - Platform Operating | ASSET |
| 1101 | Accounts Receivable - Definite Commission | ASSET |
| 2001 | Premium Payable - Definite Assurance | LIABILITY |
| 2002 | Service Fee Payable - KBA | LIABILITY |
| 2003 | Service Fee Payable - Robs Insurance | LIABILITY |
| 2004 | Service Fee Payable - Atronach Platform | LIABILITY |
| 2005 | Commission Payable - Definite | LIABILITY |
| 2101 | Refund Payable to Riders | LIABILITY |
| 4001 | Premium Income - Collected | INCOME |
| 4002 | Platform Service Fee Income | INCOME |
| 4003 | Commission Income - Definite | INCOME |
| 4004 | Reversal Fee Income | INCOME |
| 5001 | Payment Processing Fees | EXPENSE |
| 5002 | Refunds Processed | EXPENSE |

### Viewing Account Details

Click on any account to view:
- Account balance
- Recent transactions
- Account activity over time

---

## 4. Journal Entries

Journal entries record all financial transactions using double-entry bookkeeping.

### Journal Entry Types

| Type | Description | Trigger |
|------|-------------|---------|
| PAYMENT_RECEIPT_DAY1 | Initial rider deposit (KES 1,048) | M-Pesa payment callback |
| PAYMENT_RECEIPT_DAILY | Daily payment (KES 87) | M-Pesa payment callback |
| PREMIUM_REMITTANCE_DAY1 | Premium sent to underwriter | Settlement processed |
| PREMIUM_REMITTANCE_BULK | Bulk premium remittance | Settlement processed |
| SERVICE_FEE_DISTRIBUTION | Partner service fee payments | Settlement processed |
| REFUND_INITIATION | Refund approved | Manual trigger |
| REFUND_EXECUTION | Refund paid to rider | M-Pesa callback |

### Journal Entry Status

| Status | Description |
|--------|-------------|
| DRAFT | Entry created but not finalized |
| PENDING_APPROVAL | Awaiting approval (manual entries only) |
| APPROVED | Approved and ready to post |
| POSTED | Posted to GL accounts |
| REVERSED | Entry has been reversed |

### Viewing Journal Entries

1. Go to **Accounting > Journal Entries** (via reports or dashboard)
2. Filter by date range, type, or status
3. Click an entry to view details including all debit/credit lines

### Example: Day 1 Payment Entry

When a rider pays the initial KES 1,048 deposit:

| Account | Debit | Credit |
|---------|-------|--------|
| 1001 Cash at Bank - UBA Escrow | 1,048.00 | |
| 2001 Premium Payable - Definite | | 820.00 |
| 2002 Service Fee Payable - KBA | | 100.00 |
| 2003 Service Fee Payable - Robs | | 80.00 |
| 4001 Premium Income - Collected | | 48.00 |
| **Total** | **1,048.00** | **1,048.00** |

---

## 5. Partner Settlements

Partner settlements manage the disbursement of funds to stakeholders.

### Partners

| Partner | Settlement Type | Description |
|---------|----------------|-------------|
| **Definite Assurance** | Premium Remittance | Net premium after service fees |
| **KBA** | Service Fee | Association service fee portion |
| **Robs Insurance** | Commission | Agent commission |
| **Atronach** | Platform Fee | Platform revenue |

### Settlement Workflow

```
PENDING → APPROVED → PROCESSING → COMPLETED
              ↓
           FAILED (retry possible)
```

### Creating Settlements

Settlements are automatically generated by the daily job. To create manually:

1. Go to **Accounting > Settlements**
2. Click **Generate Settlement**
3. Select partner and date range
4. Review and submit

### Approving Settlements

1. Navigate to pending settlements
2. Review settlement details and line items
3. Click **Approve**
4. Settlement moves to APPROVED status

### Processing Settlements

Once approved:

1. Settlement moves to PROCESSING
2. Enter bank reference after payment
3. Click **Mark as Completed**
4. System creates disbursement journal entry

### Settlement Notifications

Email notifications are sent for:
- New settlement created (to admins)
- Settlement approved (to partner and admins)
- Settlement processed (to partner)

---

## 6. Reconciliations

Bank reconciliation matches bank statements with system records.

### Creating a Reconciliation

1. Go to **Accounting > Reconciliations**
2. Click **New Reconciliation**
3. Enter:
   - Bank account (GL account code)
   - Statement date
   - Statement ending balance

### Uploading Bank Statement

1. Open the reconciliation
2. Click **Upload Statement**
3. Select CSV file with transactions
4. System will auto-match transactions

### Matching Transactions

For each bank transaction:
- **Matched**: System found corresponding entry
- **Unmatched**: No match found (review manually)

To manually match:
1. Click on unmatched transaction
2. Select the corresponding system entry
3. Confirm match

### Reconciliation Status

| Status | Description |
|--------|-------------|
| DRAFT | In progress, not finalized |
| IN_PROGRESS | Matching in progress |
| COMPLETED | All items matched, balanced |
| FAILED | Reconciliation has discrepancies |

### Completing Reconciliation

1. Ensure all items are matched
2. Verify the difference is zero
3. Click **Complete Reconciliation**

---

## 7. Financial Reports

### Available Reports

| Report | Description |
|--------|-------------|
| **Balance Sheet** | Financial position at a point in time |
| **Income Statement** | Revenue and expenses for a period |
| **Trial Balance** | List of all accounts with balances |
| **Partner Statement** | Transactions with specific partner |
| **Account Activity** | Detailed activity for one account |

### Generating Reports

1. Go to **Accounting > Financial Reports**
2. Select report type
3. Enter date/period parameters
4. Click **Generate**

### Balance Sheet

Shows assets, liabilities, and equity at a specific date.

Formula: `Assets = Liabilities + Equity`

### Income Statement

Shows revenue and expenses for a period.

Formula: `Net Income = Total Income - Total Expenses`

### Trial Balance

Lists all accounts with debit and credit balances.

Validation: `Total Debits = Total Credits`

### Partner Statement

Shows all transactions with a specific partner including:
- Opening balance
- All debits and credits
- Running balance
- Closing balance

---

## 8. Exports

Export accounting data to CSV or Excel format.

### Available Exports

| Export | Formats |
|--------|---------|
| Chart of Accounts | CSV, Excel |
| Trial Balance | CSV, Excel |
| Journal Entries | CSV, Excel |
| Settlements | CSV, Excel |
| Balance Sheet | CSV, Excel |
| Income Statement | CSV, Excel |

### Exporting Data

1. Navigate to the relevant section (e.g., Settlements)
2. Click the **Export** button
3. Choose format (CSV or Excel)
4. File downloads automatically

### Export Endpoints (API)

For automated exports:

```
GET /api/v1/accounting/export/chart-of-accounts/csv
GET /api/v1/accounting/export/chart-of-accounts/excel
GET /api/v1/accounting/export/trial-balance/csv
GET /api/v1/accounting/export/trial-balance/excel
GET /api/v1/accounting/export/journal-entries/csv?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET /api/v1/accounting/export/settlements/csv?partnerType=DEFINITE_ASSURANCE
GET /api/v1/accounting/export/balance-sheet/csv?asOf=YYYY-MM-DD
GET /api/v1/accounting/export/income-statement/csv?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

---

## 9. Audit Log

The audit log provides a complete trail of all accounting activities.

### Accessing Audit Log

1. Go to **Audit Log** in the sidebar
2. View all events with filters

### Event Categories

| Category | Events |
|----------|--------|
| **Authentication** | Login, logout, OTP verification |
| **Payment** | Payment initiated, completed, failed |
| **Accounting** | Journal posted, settlement approved |
| **KYC** | Document uploaded, status changed |
| **Policy** | Policy created, activated |
| **System** | Configuration changes |

### Filtering Events

Filter by:
- Event type
- User ID
- Date range
- Outcome (success/failure)

### Event Details

Click any event to view:
- Full event details
- Associated entity (user, transaction, etc.)
- Timestamp
- Outcome and description

---

## 10. Scheduled Jobs

The accounting module runs automated jobs for routine tasks.

### Daily Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| **Daily Settlement Generation** | 6:00 AM EAT | Creates settlements for previous day |
| **Daily Summary Email** | 7:00 AM EAT | Sends settlement summary to admins |
| **Escrow Balance Check** | 8:00 AM EAT | Alerts if balance is low/high |

### Escrow Balance Alerts

Alerts are triggered when:
- **Low Balance**: Below KES 100,000 (configurable)
- **High Balance**: Above KES 5,000,000 (configurable)

### Job Monitoring

Job status is logged in the system. Contact IT support if jobs fail to run.

---

## 11. Troubleshooting

### Common Issues

#### "Trial balance doesn't balance"

**Cause**: Unbalanced journal entry was posted.

**Solution**:
1. Generate trial balance
2. Identify discrepancy
3. Review recent journal entries
4. Create correcting entry if needed

#### "Settlement amount doesn't match expected"

**Cause**: Payments may have been processed differently.

**Solution**:
1. Review settlement line items
2. Check original payment transactions
3. Verify fee calculations
4. Contact IT if discrepancy persists

#### "Can't approve settlement"

**Cause**: Settlement may already be processed or user lacks permission.

**Solution**:
1. Verify settlement status is PENDING
2. Confirm you have PLATFORM_ADMIN or INSURANCE_ADMIN role
3. Check for any validation errors

#### "Export file is empty"

**Cause**: No data matches the filter criteria.

**Solution**:
1. Verify date range parameters
2. Check that data exists for the period
3. Try a broader date range

### Getting Help

For technical issues:
1. Check this guide first
2. Contact IT support at support@bodainsure.co.ke
3. Include screenshots and error messages

---

## Appendix A: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save changes |
| `Ctrl + E` | Export current view |
| `Esc` | Close dialog |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **GL Account** | General Ledger account used to categorize transactions |
| **Journal Entry** | A record of a financial transaction with debits and credits |
| **Settlement** | A batch of payments due to a partner |
| **Reconciliation** | Process of matching bank records with system records |
| **Trial Balance** | Report showing all account balances |
| **Double-Entry** | Accounting method where every transaction has equal debits and credits |

---

## Appendix C: API Reference

All accounting APIs require authentication with JWT token.

### Base URL
```
https://api.bodainsure.co.ke/api/v1/accounting
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /gl-accounts | List all GL accounts |
| GET | /gl-accounts/:id | Get account details |
| GET | /trial-balance | Get trial balance |
| GET | /journal-entries | List journal entries |
| GET | /settlements | List settlements |
| POST | /settlements/:id/approve | Approve a settlement |
| POST | /settlements/:id/process | Process a settlement |
| GET | /reconciliations | List reconciliations |
| POST | /reconciliations | Create reconciliation |
| GET | /reports/balance-sheet | Generate balance sheet |
| GET | /reports/income-statement | Generate income statement |

See Swagger documentation at `/api/docs` for full API reference.

---

*This document is maintained by the BodaInsure Engineering Team. For updates or corrections, contact engineering@bodainsure.co.ke*
