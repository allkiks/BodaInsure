# BodaInsure KBA Admin User Guide

**Last Updated:** December 2024
**Role:** Kenya Bodaboda Association Administrator
**Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [SACCO Management](#4-sacco-management)
5. [Regional Compliance](#5-regional-compliance)
6. [Reporting & Analytics](#6-reporting--analytics)
7. [User Management](#7-user-management)
8. [Campaign Management](#8-campaign-management)
9. [Account Settings](#9-account-settings)

---

## 1. Overview

### Your Role as KBA Admin

As a KBA Administrator, you oversee insurance compliance across multiple SACCOs in your region or county. Your responsibilities include:

- **SACCO Oversight**: Monitor performance of all SACCOs under KBA
- **Regional Compliance**: Track and improve insurance uptake across your area
- **Administrator Management**: Create and manage SACCO Admin accounts
- **Strategic Reporting**: Provide compliance data to KBA national office
- **Performance Analysis**: Identify trends and areas for improvement

### Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| SACCO Monitoring | Track enrollment and compliance per SACCO |
| Admin Management | Create/manage SACCO administrator accounts |
| Regional Reporting | Generate county/regional compliance reports |
| Compliance Campaigns | Coordinate insurance drive initiatives |
| Escalation Handling | Resolve issues escalated from SACCOs |

### Access Level

You have access to:
- All SACCOs under your region/county
- All members within those SACCOs (read-only)
- SACCO Admin account management
- Regional analytics and reports

---

## 2. Getting Started

### Logging In

1. Navigate to https://admin.bodainsure.co.ke
2. Enter your username and password
3. Complete two-factor authentication
4. Access your KBA Admin dashboard

### Interface Navigation

```
Main Menu
├── Dashboard         # Regional overview and KPIs
├── SACCOs           # SACCO list and management
├── Members          # All members in your region
├── Compliance       # Regional compliance tracking
├── Reports          # Analytics and exports
├── Users            # SACCO Admin management
├── Campaigns        # Enrollment campaigns
└── Settings         # Account settings
```

### Session Management

- Sessions timeout after 30 minutes
- Multi-device login is allowed but discouraged
- Activity is logged for audit purposes

---

## 3. Dashboard Overview

### Regional Key Performance Indicators

| KPI | Description |
|-----|-------------|
| **Total SACCOs** | Number of SACCOs in your region |
| **Total Members** | All registered riders |
| **Active Policies** | Members with valid insurance |
| **Regional Compliance %** | Overall compliance rate |
| **This Month Enrollments** | New registrations this month |
| **Revenue Collected** | Total payments processed |

### SACCO Performance Summary

View SACCOs ranked by:
- Compliance rate
- Member count
- Monthly enrollments
- Payment completion rate

### Alerts & Notifications

The dashboard highlights:
- SACCOs with declining compliance
- Bulk KYC rejection alerts
- Campaign progress updates
- System notifications

### Quick Actions

- **Create SACCO Admin**: Set up new administrator
- **View Low Performers**: SACCOs below compliance threshold
- **Generate Regional Report**: Quick compliance summary
- **Launch Campaign**: Start enrollment drive

---

## 4. SACCO Management

### Viewing SACCOs

1. Click **"SACCOs"** in the main menu
2. View list with:
   - SACCO name and registration number
   - County/location
   - Member count
   - Compliance rate
   - Admin contact

### SACCO Filters

| Filter | Options |
|--------|---------|
| **County** | Filter by county |
| **Compliance** | High (>80%), Medium (50-80%), Low (<50%) |
| **Size** | Small (<50), Medium (50-200), Large (>200) |
| **Status** | Active, Inactive |

### SACCO Details

Click on a SACCO to view:
- Organization information
- Administrator details
- Member statistics
- Payment history
- Compliance trends
- Recent activity

### Adding New SACCO

1. Go to **"SACCOs"** > **"Add SACCO"**
2. Enter details:
   - SACCO name
   - Registration number
   - County and location
   - Contact information
3. Create SACCO Admin account (or assign existing)
4. Save

### Editing SACCO Information

1. Go to SACCO details
2. Click **"Edit"**
3. Update information
4. Save changes

---

## 5. Regional Compliance

### Compliance Dashboard

View regional compliance broken down by:

```
Regional Compliance Summary
────────────────────────────────────────
County: Nakuru

Total SACCOs:      25
Total Members:     3,450

Compliance Breakdown:
├── Fully Compliant:    2,415 (70%)
├── Partial:              518 (15%)
├── In Grace:             173 (5%)
└── Non-Compliant:        344 (10%)
────────────────────────────────────────
```

### County-Level View

If managing multiple counties:

1. Go to **"Compliance"** > **"By County"**
2. View county comparison
3. Drill down into specific counties
4. Identify underperforming areas

### SACCO Comparison

Compare SACCOs side-by-side:

1. Select SACCOs to compare
2. View metrics comparison:
   - Compliance rates
   - Growth trends
   - Payment patterns
   - KYC completion rates

### Compliance Alerts

Configure alerts for:
- SACCO drops below threshold (e.g., 50%)
- Bulk member lapses
- Unusual payment patterns
- KYC rejection spikes

---

## 6. Reporting & Analytics

### Available Reports

| Report | Frequency | Audience |
|--------|-----------|----------|
| **Daily Summary** | Daily | Internal |
| **Weekly Performance** | Weekly | KBA Management |
| **Monthly Compliance** | Monthly | KBA National |
| **SACCO Ranking** | Monthly | Internal |
| **Revenue Report** | Monthly | Finance |
| **Quarterly Analysis** | Quarterly | Stakeholders |

### Generating Reports

1. Go to **"Reports"**
2. Select report type
3. Configure parameters:
   - Date range
   - Counties/SACCOs to include
   - Metrics to display
   - Grouping (by SACCO, county, month)
4. Generate and export

### Export Formats

- **PDF**: For formal submissions
- **Excel**: For data analysis
- **CSV**: For data processing
- **Dashboard Link**: For live viewing

### Scheduled Reports

Automate report delivery:

1. Go to **"Reports"** > **"Scheduled"**
2. Configure schedule:
   - Report type
   - Frequency
   - Recipients (email)
   - Format
3. Activate schedule

### Analytics Features

- **Trend Analysis**: View compliance over time
- **Predictive Insights**: Identify at-risk members
- **Cohort Analysis**: Compare enrollment groups
- **Geographic Heatmap**: Visualize compliance by area

---

## 7. User Management

### Managing SACCO Admins

View all SACCO administrators:

1. Go to **"Users"**
2. See list of SACCO Admins with:
   - Name and contact
   - SACCO assigned
   - Account status
   - Last login

### Creating SACCO Admin

1. Go to **"Users"** > **"Create Admin"**
2. Enter details:
   - Full name
   - Phone number
   - Email address
   - Username
   - Temporary password
3. Assign to SACCO
4. Set permissions
5. Create account

The new admin receives:
- Email with login credentials
- SMS notification
- Welcome guide

### Account Actions

| Action | Description |
|--------|-------------|
| **Reset Password** | Send password reset link |
| **Suspend** | Temporarily disable access |
| **Reactivate** | Restore suspended account |
| **Delete** | Permanently remove (requires reassignment) |
| **Transfer** | Move to different SACCO |

### Permission Levels

SACCO Admins have standard permissions:
- View own SACCO members only
- Manage member registrations
- Generate SACCO reports
- Send communications to members

---

## 8. Campaign Management

### What are Campaigns?

Campaigns are coordinated enrollment drives to increase insurance uptake.

### Creating a Campaign

1. Go to **"Campaigns"** > **"New Campaign"**
2. Configure:
   - Campaign name
   - Target SACCOs or region
   - Start and end date
   - Enrollment target
   - Messaging templates
3. Launch campaign

### Campaign Dashboard

Track campaign progress:
- Enrollments vs target
- Daily sign-up trends
- SACCO participation
- Conversion rates

### Campaign Actions

- **SMS Blast**: Send promotional messages
- **Progress Update**: Notify SACCOs of status
- **Leaderboard**: Share SACCO rankings
- **Extend/Close**: Modify campaign dates

### Post-Campaign Analysis

After campaign ends:
1. Go to campaign details
2. View final metrics
3. Generate campaign report
4. Archive for records

---

## 9. Account Settings

### Profile Management

Update your information:

1. Go to **"Settings"** > **"Profile"**
2. Edit:
   - Display name
   - Email address
   - Phone number
   - Profile photo

### Security Settings

- **Change Password**: Use strong, unique password
- **Two-Factor Auth**: Enable for additional security
- **Session Management**: View and end active sessions
- **Audit Log**: View your recent activity

### Notification Preferences

| Notification Type | Options |
|-------------------|---------|
| **Daily Digest** | Email summary of regional stats |
| **Alert Emails** | Immediate compliance alerts |
| **Campaign Updates** | Campaign progress notifications |
| **System Updates** | Platform maintenance notices |

### Regional Settings

Configure your regional defaults:
- Default date format
- Currency display
- Language preference
- Timezone

---

## Workflow Examples

### Weekly SACCO Review

1. **Monday**: Review weekend compliance changes
2. **Tuesday-Wednesday**: Contact underperforming SACCOs
3. **Thursday**: Generate mid-week report
4. **Friday**: Send weekly summary to KBA national

### New SACCO Onboarding

1. Create SACCO record with details
2. Create SACCO Admin account
3. Schedule onboarding call
4. Provide training materials
5. Monitor initial enrollment progress
6. Follow up after 2 weeks

### Compliance Issue Escalation

1. SACCO Admin reports issue
2. Review in KBA dashboard
3. Contact relevant SACCO Admin
4. Escalate to Platform Admin if technical
5. Document resolution
6. Follow up on improvement

---

## Best Practices

### Regional Management

1. **Regular Check-ins**: Weekly calls with SACCO Admins
2. **Performance Reviews**: Monthly SACCO assessments
3. **Peer Learning**: Connect high-performing SACCOs with struggling ones
4. **Documentation**: Keep records of interventions and outcomes

### Data-Driven Decisions

1. **Use Analytics**: Base decisions on data, not assumptions
2. **Track Trends**: Monitor changes over time, not just snapshots
3. **Benchmark**: Compare against regional averages
4. **Set Goals**: Use specific, measurable targets

### Communication

1. **Clear Expectations**: Communicate compliance targets clearly
2. **Regular Updates**: Keep SACCOs informed of their status
3. **Celebrate Success**: Recognize high-performing SACCOs
4. **Support Struggles**: Offer help to underperformers

---

## Support & Escalation

### Technical Issues
Contact Platform Admin: admin@bodainsure.co.ke

### Policy Questions
Contact KBA National Office

### Member Escalations
Coordinate with relevant SACCO Admin

---

*Leading regional compliance excellence with BodaInsure.*
