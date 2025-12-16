# BodaInsure SACCO Admin User Guide

**Last Updated:** December 2024
**Role:** SACCO Administrator
**Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Member Management](#4-member-management)
5. [Compliance Tracking](#5-compliance-tracking)
6. [Bulk Operations](#6-bulk-operations)
7. [Reports](#7-reports)
8. [Account Settings](#8-account-settings)
9. [Best Practices](#9-best-practices)

---

## 1. Overview

### Your Role as SACCO Admin

As a SACCO Administrator, you are responsible for:

- **Member Oversight**: Track and manage your SACCO's riders
- **Compliance Monitoring**: Ensure members maintain valid insurance
- **Support Facilitation**: Help members with onboarding and issues
- **Reporting**: Generate reports for KBA and other stakeholders

### Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Member Registration | Assist members in signing up for BodaInsure |
| Document Verification | Review member KYC submissions |
| Payment Monitoring | Track member payment compliance |
| Compliance Reporting | Report to KBA on member insurance status |
| Issue Resolution | Handle member queries and escalations |

### System Access

You access BodaInsure through:
- **Web Portal**: https://admin.bodainsure.co.ke
- **Credentials**: Username/password provided by Platform Admin

---

## 2. Getting Started

### First-Time Login

1. Navigate to https://admin.bodainsure.co.ke
2. Enter your username and password
3. Complete two-factor authentication (if enabled)
4. You will be directed to your SACCO dashboard

### Navigation

```
Main Menu
├── Dashboard          # Overview and key metrics
├── Members           # Member list and management
├── Compliance        # Insurance compliance tracking
├── Reports           # Generate and export reports
├── Bulk Operations   # Import members, bulk actions
└── Settings          # Account and notification settings
```

### Session Security

- Sessions expire after 30 minutes of inactivity
- Always log out when finished
- Do not share your credentials
- Report suspicious activity immediately

---

## 3. Dashboard Overview

### Key Metrics

Your dashboard displays:

| Metric | Description |
|--------|-------------|
| **Total Members** | Number of riders in your SACCO |
| **Active Policies** | Members with valid insurance |
| **Pending KYC** | Members awaiting document approval |
| **Payment Due** | Members with outstanding payments |
| **Compliance Rate** | Percentage of compliant members |

### Quick Actions

- **Add Member**: Register a new rider
- **View Non-Compliant**: See members needing attention
- **Generate Report**: Create compliance report
- **Send Reminder**: Bulk SMS to members

### Recent Activity

View recent actions in your SACCO:
- New registrations
- KYC approvals/rejections
- Payments received
- Policy activations

---

## 4. Member Management

### Viewing Members

1. Click **"Members"** in the main menu
2. View the member list with:
   - Name and phone number
   - KYC status
   - Policy status
   - Days paid
   - Last payment date

### Member Filters

| Filter | Options |
|--------|---------|
| **KYC Status** | All, Pending, Approved, Rejected |
| **Policy Status** | All, Active, Pending, Expired, Lapsed |
| **Payment Status** | Up to date, Behind, Grace period |
| **Search** | By name, phone, or National ID |

### Member Details

Click on any member to view:
- Full profile information
- KYC document status
- Payment history
- Policy details
- Activity log

### Adding New Members

You can assist members who have difficulty self-registering:

1. Click **"Add Member"**
2. Enter member's phone number
3. Enter basic details (name, National ID)
4. The member will receive an OTP to complete registration

**Note:** Members must still verify their own phone and complete KYC.

### Assisting with KYC

For members having document issues:

1. Go to member's profile
2. View rejected documents
3. See rejection reason
4. Advise member on required corrections
5. Member re-uploads through their app

---

## 5. Compliance Tracking

### Compliance Dashboard

The compliance view shows your SACCO's insurance status at a glance:

```
Compliance Overview
──────────────────────────────────────
Total Members:        150
Fully Compliant:      120 (80%)
Partial (1-mo only):   15 (10%)
Non-Compliant:         15 (10%)
──────────────────────────────────────
```

### Compliance Statuses

| Status | Definition |
|--------|------------|
| **Fully Compliant** | Has active policy covering current date |
| **Partial** | Has 1-month policy only, daily payments in progress |
| **In Grace Period** | Payment missed but within 7-day grace |
| **Non-Compliant** | No active policy or policy lapsed |
| **Pending** | Registered but KYC/payment not complete |

### Non-Compliant Members

1. Go to **"Compliance"** > **"Non-Compliant"**
2. View list of members needing action
3. See reason for non-compliance:
   - KYC incomplete
   - Initial deposit not paid
   - Daily payments lapsed
4. Take action:
   - Send reminder (individual or bulk)
   - View member details
   - Contact member directly

### Setting Up Alerts

Configure automatic alerts:

1. Go to **"Settings"** > **"Alerts"**
2. Enable:
   - Daily compliance summary email
   - Instant alerts for policy lapses
   - Weekly performance report

---

## 6. Bulk Operations

### Bulk Member Import (Phase 2)

Import multiple members from a spreadsheet:

1. Go to **"Bulk Operations"** > **"Import Members"**
2. Download the template CSV
3. Fill in member details
4. Upload the completed file
5. Review import preview
6. Confirm import

**Template Columns:**
- Phone Number (required)
- Full Name (required)
- National ID (required)
- Date of Birth
- Email

### Bulk SMS Reminders

Send payment reminders to multiple members:

1. Go to **"Bulk Operations"** > **"Send Reminders"**
2. Select recipients:
   - All members
   - Non-compliant only
   - Specific payment status
3. Choose message template
4. Preview and send

### Export Member Data

1. Go to **"Members"**
2. Apply desired filters
3. Click **"Export"**
4. Choose format (CSV or Excel)
5. Download file

---

## 7. Reports

### Available Reports

| Report | Description |
|--------|-------------|
| **Enrollment Report** | New registrations over time |
| **Compliance Report** | Member insurance status summary |
| **Payment Report** | Payment transactions and amounts |
| **KYC Report** | Document submission and approval stats |
| **Member Directory** | Full member list with details |

### Generating Reports

1. Go to **"Reports"**
2. Select report type
3. Set parameters:
   - Date range
   - Status filters
   - Grouping options
4. Click **"Generate"**
5. View on screen or export

### Scheduled Reports

Set up automatic report delivery:

1. Go to **"Reports"** > **"Scheduled"**
2. Click **"New Schedule"**
3. Select report type
4. Set frequency (daily, weekly, monthly)
5. Choose delivery method (email, download)
6. Save schedule

### KBA Compliance Reports

Generate reports for KBA submission:

1. Go to **"Reports"** > **"KBA Compliance"**
2. Select reporting period
3. Generate report
4. Download in required format
5. Submit to KBA as instructed

---

## 8. Account Settings

### Profile Settings

Update your information:

1. Go to **"Settings"** > **"Profile"**
2. Update:
   - Display name
   - Email address
   - Phone number
   - Language preference

### Password Management

Change your password:

1. Go to **"Settings"** > **"Security"**
2. Enter current password
3. Enter new password (min 8 characters, mixed case, numbers)
4. Confirm new password
5. Save

### Notification Preferences

Configure how you receive notifications:

| Notification | Options |
|--------------|---------|
| **Email Alerts** | Enable/disable, frequency |
| **SMS Alerts** | Enable/disable |
| **Browser Notifications** | Enable/disable |
| **Daily Digest** | Enable/disable, time |

### SACCO Information

View your SACCO details:
- SACCO name
- Registration number
- KBA affiliation
- Contact information
- Member count

To update SACCO information, contact your KBA Admin.

---

## 9. Best Practices

### Member Onboarding

1. **Educate First**: Explain the payment model and benefits
2. **Assist Registration**: Help members with smartphone issues
3. **Guide KYC**: Demonstrate proper document photography
4. **Follow Up**: Check registration completion

### Maintaining Compliance

1. **Daily Review**: Check dashboard for new non-compliant members
2. **Early Intervention**: Contact members at first missed payment
3. **Use Grace Period**: Encourage catch-up payments within 7 days
4. **Document Issues**: Note common problems for KBA feedback

### Communication

1. **Regular Updates**: Inform members of deadlines and changes
2. **Group Messaging**: Use bulk SMS for announcements
3. **Personal Touch**: Call members with repeated issues
4. **Feedback Loop**: Report member concerns to KBA

### Record Keeping

1. **Export Regularly**: Download member lists monthly
2. **Save Reports**: Archive compliance reports
3. **Document Actions**: Keep notes on member interactions
4. **Audit Trail**: The system logs all your actions

### Security

1. **Strong Password**: Use unique, complex password
2. **Log Out**: Always log out after use
3. **Shared Devices**: Never save password on shared computers
4. **Report Breaches**: Immediately report any suspicious activity

---

## Common Tasks Quick Reference

### Check Member Payment Status

1. Go to **Members** > Search for member
2. View payment history
3. Note days paid and last payment date

### Help Member with Rejected KYC

1. Go to member profile > **KYC Documents**
2. View rejection reason
3. Advise member on corrections
4. Member re-uploads via app

### Send Payment Reminder

1. Go to **Members** > Select member
2. Click **"Send Reminder"**
3. Choose message type
4. Confirm send

### Generate Compliance Report

1. Go to **Reports** > **Compliance Report**
2. Set date range (e.g., this month)
3. Click **Generate**
4. Export as PDF for KBA

---

## Troubleshooting

### Cannot Log In

- Verify username and password
- Check Caps Lock
- Clear browser cache
- Try a different browser
- Contact Platform Admin if locked out

### Member Not Showing

- Check if member completed registration
- Verify member is assigned to your SACCO
- Try different search criteria
- Contact support if member is missing

### Report Not Generating

- Check date range is valid
- Ensure you have data for selected period
- Try a shorter date range
- Contact support if issue persists

---

## Support Contacts

**Technical Support:** support@bodainsure.co.ke
**KBA Admin Hotline:** [Contact your KBA representative]
**Platform Admin:** admin@bodainsure.co.ke

---

*Empowering SACCOs to serve riders better with BodaInsure.*
