# BodaInsure Insurance Admin User Guide

**Last Updated:** December 2024
**Role:** Insurance Administrator (Robs Insurance Agency / Definite Assurance)
**Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Policy Management](#4-policy-management)
5. [Financial Reports](#5-financial-reports)
6. [Compliance & Regulatory](#6-compliance--regulatory)
7. [Underwriter Integration](#7-underwriter-integration)
8. [Commission Tracking](#8-commission-tracking)
9. [Account Settings](#9-account-settings)

---

## 1. Overview

### Your Role as Insurance Admin

As an Insurance Administrator representing Robs Insurance Agency or Definite Assurance, you oversee:

- **Policy Operations**: Monitor policy issuance and lifecycle
- **Financial Oversight**: Track premiums, commissions, and reconciliation
- **Regulatory Compliance**: Ensure IRA compliance and reporting
- **Underwriter Liaison**: Coordinate with Definite Assurance on policy matters
- **Audit Support**: Provide data for internal and external audits

### Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Policy Monitoring | Track policy issuance, renewals, and lapses |
| Premium Reconciliation | Verify payments against policies |
| Compliance Reporting | Generate IRA-required reports |
| Claim Support | Facilitate claim information requests |
| Financial Reporting | Provide revenue and commission data |

### System Access

You have access to:
- All policies across the platform
- Financial and payment data
- Compliance and regulatory reports
- Commission and settlement data

---

## 2. Getting Started

### Logging In

1. Navigate to https://admin.bodainsure.co.ke
2. Enter your username and password
3. Complete two-factor authentication (required)
4. Access the Insurance Admin dashboard

### Interface Navigation

```
Main Menu
├── Dashboard         # Business overview and KPIs
├── Policies         # Policy management and search
├── Payments         # Payment transactions
├── Reports          # Financial and compliance reports
├── Compliance       # IRA regulatory compliance
├── Commissions      # Commission tracking (Phase 2)
├── Reconciliation   # Payment-policy matching
└── Settings         # Account settings
```

### Security Requirements

As you handle sensitive financial data:
- Two-factor authentication is mandatory
- Sessions timeout after 15 minutes
- All actions are logged for audit
- Data exports require additional verification

---

## 3. Dashboard Overview

### Business KPIs

| Metric | Description |
|--------|-------------|
| **Policies Issued (MTD)** | Policies issued this month |
| **Premium Collected (MTD)** | Total premiums this month |
| **Active Policies** | Currently valid policies |
| **Renewal Rate** | Policy renewal percentage |
| **Claims Pending** | Claims awaiting processing |
| **Commission Earned** | Your commission total |

### Policy Performance

View policy metrics:
- New policies (1-month vs 11-month)
- Conversion rate (1-month to 11-month)
- Lapse rate
- Average days to completion

### Financial Summary

Daily/weekly/monthly view of:
- Gross premium collected
- Platform fees
- Net premium to underwriter
- Agent commission

### Alerts

- Unusual transaction patterns
- Reconciliation discrepancies
- Compliance deadlines
- System maintenance notices

---

## 4. Policy Management

### Policy Search

Search for policies by:
- Policy number
- Member phone number
- Member National ID
- Vehicle registration
- Date range

### Policy List View

| Column | Description |
|--------|-------------|
| Policy Number | Unique policy identifier |
| Member | Name and phone |
| Vehicle | Registration number |
| Type | 1-Month or 11-Month |
| Status | Active, Pending, Expired, Lapsed |
| Start Date | Coverage start |
| End Date | Coverage expiry |
| Premium | Premium amount |

### Policy Details

View comprehensive policy information:

**Member Information:**
- Full name
- Phone number
- National ID (masked)
- KYC status

**Vehicle Information:**
- Registration number
- Make and model
- Year of manufacture
- Chassis number

**Policy Information:**
- Policy number
- Type (TPO)
- Coverage amount
- Start and end dates
- Issue timestamp

**Payment Information:**
- Total premium
- Amount paid
- Payment history
- Outstanding balance

### Policy Status Definitions

| Status | Description |
|--------|-------------|
| **PENDING_DEPOSIT** | Registered but no payment |
| **PENDING_ISSUANCE** | Payment received, awaiting policy |
| **ACTIVE** | Valid and in force |
| **EXPIRING** | Within 30 days of expiry |
| **EXPIRED** | Past end date |
| **LAPSED** | Cancelled due to non-payment |
| **CANCELLED** | Manually cancelled |

### Policy Documents

View and download:
- Policy certificate (PDF)
- Cover note
- Terms and conditions
- Member acknowledgment

---

## 5. Financial Reports

### Revenue Reports

**Premium Collection Report:**
- Daily/weekly/monthly premium totals
- Breakdown by policy type
- Breakdown by payment type (deposit vs daily)
- Payment method analysis

**Revenue Trend Analysis:**
- Month-over-month comparison
- Year-over-year growth
- Seasonal patterns
- Projection models

### Transaction Reports

**Payment Transaction Report:**
- All payment transactions
- M-Pesa reference numbers
- Status (completed, failed, pending)
- Timestamps

**Settlement Report:**
- Amounts due to underwriter
- Platform fees deducted
- Commission calculations
- Net settlement amount

### Generating Reports

1. Go to **"Reports"**
2. Select report type
3. Set date range
4. Choose format (PDF, Excel, CSV)
5. Generate and download

### Scheduled Reports

Configure automated delivery:
- Daily transaction summary
- Weekly financial report
- Monthly compliance report
- Quarterly performance analysis

---

## 6. Compliance & Regulatory

### IRA Compliance

The platform maintains compliance with Insurance Regulatory Authority requirements:

- **Two-Policy Limit**: System enforces max 2 TPO policies per vehicle per year
- **30-Day Free Look**: Cancellation with full refund within 30 days
- **Terms Disclosure**: Terms displayed and acknowledged before payment
- **Policy Delivery**: Within 6 hours of payment
- **Record Retention**: All records retained for 7 years

### Compliance Reports

| Report | Frequency | Recipient |
|--------|-----------|-----------|
| **Policy Issuance Report** | Monthly | IRA |
| **Premium Collection Report** | Monthly | IRA |
| **Cancellation Report** | Monthly | IRA |
| **Claims Notification** | As required | IRA |

### Generating IRA Reports

1. Go to **"Compliance"** > **"IRA Reports"**
2. Select report type
3. Choose reporting period
4. Generate in IRA-required format
5. Download for submission

### Audit Trail

All policy and payment actions are logged:
- Who made the action
- What was changed
- When it occurred
- Previous and new values

To access audit logs:
1. Go to **"Compliance"** > **"Audit Logs"**
2. Filter by date, user, or action type
3. Export if needed for auditors

---

## 7. Underwriter Integration

### Policy Flow to Underwriter

```
BodaInsure                       Definite Assurance
────────────                     ────────────────
Payment Received
       │
       ▼
KYC Verified
       │
       ▼
Policy Request ──────────────────▶ Policy Issuance
       │                                  │
       ▼                                  ▼
Policy Number ◀────────────────── Policy Confirmed
       │
       ▼
Member Notified
```

### Pending Underwriter Actions

View policies awaiting underwriter:
1. Go to **"Policies"** > **"Pending Issuance"**
2. See queue of policies awaiting underwriter
3. Expected turnaround time
4. Escalate if delayed

### Underwriter Reports

Reports sent to/from underwriter:
- Daily policy issuance queue
- Settlement reconciliation
- Claims notification
- Policy cancellations

### Escalation Process

If underwriter delay occurs:
1. Flag policy in system
2. Contact underwriter liaison
3. Document communication
4. Track resolution time

---

## 8. Commission Tracking

*Note: Full commission tracking is a Phase 2 feature.*

### Commission Overview

View commission earnings:
- Total earned (MTD/YTD)
- Pending settlement
- Paid to date
- Commission rate applied

### Commission Calculation

```
Commission = Net Premium × Commission Rate

For 1-Month Policy:
- Net Premium: 1,048 KES
- Commission Rate: X%
- Commission: (1,048 × X%)

For 11-Month Policy:
- Net Premium: 2,610 KES (30 × 87)
- Commission Rate: X%
- Commission: (2,610 × X%)
```

### Commission Reports

- Monthly commission statement
- Commission by SACCO/region
- Commission trends
- Payout reconciliation

### Settlement Schedule

Commissions are settled according to agreed schedule:
- Weekly or monthly (as per agreement)
- Net of any adjustments
- Bank transfer to registered account

---

## 9. Account Settings

### Profile Settings

Manage your account:
- Full name
- Email address
- Phone number
- Company affiliation

### Security Settings

- **Password**: Change regularly
- **Two-Factor Auth**: Required, configure backup methods
- **Session History**: Review active sessions
- **API Keys**: Manage integration keys (if applicable)

### Notification Preferences

| Notification | Description |
|--------------|-------------|
| **Transaction Alerts** | Large transaction notifications |
| **Compliance Reminders** | Upcoming report deadlines |
| **System Updates** | Platform changes and maintenance |
| **Financial Reports** | Scheduled report delivery |

### Data Export Settings

Configure export defaults:
- Date format preference
- Currency display
- Report templates
- Download location

---

## Common Workflows

### Daily Reconciliation

1. **Morning**: Review overnight transactions
2. **Check**: Compare M-Pesa settlements with system records
3. **Identify**: Flag any discrepancies
4. **Resolve**: Investigate and correct issues
5. **Document**: Note any manual adjustments

### Monthly Compliance Reporting

1. **Week 1**: Generate draft reports
2. **Week 2**: Review and verify data
3. **Week 3**: Prepare final reports
4. **Week 4**: Submit to IRA before deadline

### Policy Issue Investigation

1. Receive escalation from support
2. Look up policy by number or member
3. Review policy history and timeline
4. Check payment status
5. Verify underwriter status
6. Determine resolution
7. Document and close

---

## Best Practices

### Financial Accuracy

1. **Daily Review**: Check transactions daily
2. **Prompt Reconciliation**: Don't let discrepancies accumulate
3. **Documentation**: Keep records of all adjustments
4. **Audit Ready**: Maintain clean, traceable records

### Compliance Excellence

1. **Know Requirements**: Stay updated on IRA regulations
2. **Proactive Reporting**: Submit reports ahead of deadlines
3. **Complete Records**: Ensure all required data is captured
4. **Regular Audits**: Conduct internal compliance checks

### Security Vigilance

1. **Protect Credentials**: Never share login information
2. **Secure Workstation**: Lock computer when away
3. **Verify Requests**: Confirm unusual requests via separate channel
4. **Report Incidents**: Immediately report any suspicious activity

---

## Support Contacts

**Platform Admin:** admin@bodainsure.co.ke
**Technical Support:** support@bodainsure.co.ke
**Underwriter Liaison:** [Definite Assurance contact]
**IRA Inquiries:** [Regulatory contact]

---

*Ensuring insurance integrity and compliance with BodaInsure.*
