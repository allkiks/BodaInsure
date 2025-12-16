# BodaInsure Platform Admin User Guide

**Last Updated:** December 2024
**Role:** Platform Administrator (Atronach K Ltd)
**Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [System Dashboard](#3-system-dashboard)
4. [User Management](#4-user-management)
5. [Organization Management](#5-organization-management)
6. [System Configuration](#6-system-configuration)
7. [Payment Administration](#7-payment-administration)
8. [Notification Management](#8-notification-management)
9. [Security & Audit](#9-security--audit)
10. [System Monitoring](#10-system-monitoring)
11. [Support Operations](#11-support-operations)
12. [Data Management](#12-data-management)

---

## 1. Overview

### Your Role as Platform Admin

As a Platform Administrator, you have the highest level of system access and are responsible for:

- **System Operations**: Maintain platform health and performance
- **User Administration**: Manage all user accounts and roles
- **Configuration Management**: Configure system settings and features
- **Security Oversight**: Monitor security and handle incidents
- **Support Escalations**: Handle complex support issues
- **Data Management**: Oversee data integrity and compliance

### Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| User Management | Create, modify, and deactivate all user accounts |
| Organization Setup | Configure KBA, SACCOs, and hierarchies |
| System Configuration | Manage feature flags and settings |
| Payment Administration | Handle payment issues and reconciliation |
| Security Monitoring | Monitor for threats and handle incidents |
| Data Protection | Ensure compliance with data regulations |

### Access Level

You have unrestricted access to:
- All system features and data
- All user accounts and roles
- System configuration and settings
- Audit logs and security events
- Database administration tools

---

## 2. Getting Started

### Logging In

1. Navigate to https://admin.bodainsure.co.ke
2. Enter your admin credentials
3. Complete two-factor authentication (required)
4. Access the Platform Admin dashboard

### Admin Interface Navigation

```
Main Menu
├── Dashboard          # System overview and health
├── Users             # All user management
│   ├── Riders
│   ├── SACCO Admins
│   ├── KBA Admins
│   ├── Insurance Admins
│   └── Platform Admins
├── Organizations     # KBA, SACCO management
├── Policies          # Policy administration
├── Payments          # Payment management
├── Notifications     # SMS, WhatsApp, Email config
├── Reports           # All system reports
├── Configuration     # System settings
├── Security          # Security settings and audit
├── Support           # Support tools and tickets
└── System            # Technical administration
```

### Security Requirements

As a Platform Admin:
- Two-factor authentication is mandatory
- Session timeout: 15 minutes of inactivity
- All actions are logged with full audit trail
- Certain actions require additional confirmation
- Access from approved IPs only (if configured)

---

## 3. System Dashboard

### Health Overview

Monitor system health at a glance:

| Indicator | Healthy | Warning | Critical |
|-----------|---------|---------|----------|
| **API Response Time** | <500ms | 500-1000ms | >1000ms |
| **Database Connections** | <70% | 70-90% | >90% |
| **Queue Depth** | <100 | 100-500 | >500 |
| **Error Rate** | <1% | 1-5% | >5% |

### Business Metrics

- Total users (by role)
- Active policies
- Daily/monthly revenue
- Transaction volume
- USSD session count

### Recent Activity

- New registrations
- Policy issuances
- Failed payments
- Security events
- System errors

### Quick Actions

- **User Lookup**: Find any user quickly
- **Transaction Search**: Search payments by reference
- **System Health Check**: Run diagnostics
- **Clear Cache**: Flush Redis cache
- **View Logs**: Access application logs

---

## 4. User Management

### User Search

Search across all users:
- Phone number
- National ID
- Email
- Username
- User ID

### User List by Role

View users filtered by role:

| Role | Description | Management Actions |
|------|-------------|-------------------|
| **Rider** | Bodaboda riders | View, suspend, unlock, data export |
| **SACCO Admin** | SACCO administrators | Create, edit, reset password, suspend |
| **KBA Admin** | KBA administrators | Create, edit, reset password, suspend |
| **Insurance Admin** | Insurance company admins | Create, edit, reset password, suspend |
| **Platform Admin** | System administrators | Create, edit, suspend (restricted) |

### Creating Admin Users

1. Go to **"Users"** > **"Create Admin"**
2. Select role type
3. Enter user details:
   - Full name
   - Phone number (with OTP verification)
   - Email address
   - Username (for admin login)
   - Initial password
4. Set role and permissions
5. Assign to organization (if applicable)
6. Create account

### User Actions

| Action | Description | Required Permission |
|--------|-------------|---------------------|
| **View Profile** | See full user details | All admins |
| **Edit Profile** | Modify user information | Platform Admin |
| **Reset Password** | Send password reset | Platform Admin |
| **Suspend** | Temporarily disable account | Platform Admin |
| **Unlock** | Remove security lock | Platform Admin |
| **Delete** | Soft delete account | Platform Admin + confirmation |
| **Export Data** | GDPR/DPA data export | Platform Admin |
| **Impersonate** | Login as user (audit logged) | Super Admin only |

### Handling Locked Accounts

When a user is locked due to failed login attempts:

1. Search for the user
2. View lock reason and timestamp
3. Verify user identity through secondary channel
4. Click **"Unlock Account"**
5. Advise user on security best practices

### Data Export (DPA Compliance)

For right-of-access requests:

1. Locate user by phone or National ID
2. Click **"Export Data"**
3. Select data categories
4. Generate export package
5. Securely deliver to user

---

## 5. Organization Management

### Organization Hierarchy

```
Kenya Bodaboda Association (KBA)
├── Nairobi Region
│   ├── SACCO A (150 members)
│   ├── SACCO B (200 members)
│   └── SACCO C (175 members)
├── Nakuru Region
│   ├── SACCO D (120 members)
│   └── SACCO E (180 members)
└── Kisumu Region
    ├── SACCO F (90 members)
    └── SACCO G (110 members)
```

### Managing Umbrella Bodies

Create and configure umbrella bodies (like KBA):

1. Go to **"Organizations"** > **"Umbrella Bodies"**
2. Click **"Create"**
3. Enter details:
   - Organization name
   - Registration number
   - Contact information
   - Geographic scope
4. Save

### Managing SACCOs

1. Go to **"Organizations"** > **"SACCOs"**
2. View or create SACCOs
3. Assign to umbrella body
4. Set county/location
5. Assign SACCO Admin

### Member Assignment

Riders are assigned to SACCOs:
- During registration (self-selection)
- By SACCO Admin
- By Platform Admin (bulk)

To reassign a member:
1. Find user profile
2. Click **"Change Organization"**
3. Select new SACCO
4. Confirm change

---

## 6. System Configuration

### Feature Flags

Enable or disable platform features:

| Feature | Description | Default |
|---------|-------------|---------|
| `MPESA_ENABLED` | M-Pesa payment integration | true |
| `SMS_ENABLED` | SMS notifications | true |
| `WHATSAPP_ENABLED` | WhatsApp notifications | true |
| `EMAIL_ENABLED` | Email notifications | true |
| `USSD_ENABLED` | USSD channel | true |
| `SCHEDULER_ENABLED` | Background job scheduler | true |
| `REGISTRATION_OPEN` | Allow new registrations | true |
| `MAINTENANCE_MODE` | Show maintenance page | false |

### Payment Configuration

Configure payment settings:

- **Deposit Amount**: 1,048 KES (locked)
- **Daily Amount**: 87 KES (locked)
- **Grace Period**: 7 days
- **M-Pesa Timeout**: 120 seconds
- **Retry Attempts**: 3

### Notification Settings

Configure notification channels:

**SMS:**
- Primary provider: Africa's Talking
- Fallback provider: AdvantaSMS
- Retry attempts: 3
- Sender ID: BodaInsure

**WhatsApp:**
- Template messages
- Rate limits
- Delivery tracking

**Email:**
- SMTP configuration
- Template management
- Retry settings

### Batch Processing

Configure batch processing schedule:

| Batch | Time (EAT) | Purpose |
|-------|------------|---------|
| Batch 1 | 08:00 | Morning policy processing |
| Batch 2 | 14:00 | Afternoon processing |
| Batch 3 | 20:00 | Evening processing |

---

## 7. Payment Administration

### Payment Search

Find payments by:
- M-Pesa transaction ID
- Phone number
- Date range
- Amount
- Status

### Payment Status Management

| Status | Description | Actions |
|--------|-------------|---------|
| **PENDING** | Awaiting M-Pesa response | Wait or timeout |
| **COMPLETED** | Successfully processed | View details |
| **FAILED** | Payment failed | Retry or refund |
| **CANCELLED** | User cancelled | No action |
| **REFUNDED** | Money returned | View refund details |

### Manual Adjustments

For exceptional cases (e.g., M-Pesa issues):

1. Search for user/transaction
2. Document the issue
3. Create manual adjustment
4. Get supervisor approval (logged)
5. Apply adjustment
6. Notify user

**Warning:** Manual adjustments are heavily audited. Always document thoroughly.

### Reconciliation

Daily reconciliation process:

1. Go to **"Payments"** > **"Reconciliation"**
2. Select date
3. Import M-Pesa statement (if available)
4. Run automated matching
5. Review discrepancies
6. Resolve and document
7. Finalize reconciliation

### Refund Processing

For valid refund requests:

1. Verify refund eligibility (30-day free look)
2. Calculate refund amount
3. Initiate B2C transaction
4. Track refund status
5. Update policy status
6. Notify user

---

## 8. Notification Management

### Template Management

Manage notification templates:

**SMS Templates:**
- OTP message
- Payment confirmation
- Payment reminder
- Policy issuance
- Policy expiry warning

**WhatsApp Templates:**
- Policy document delivery
- Welcome message
- Support responses

### Sending Manual Notifications

For support or announcements:

1. Go to **"Notifications"** > **"Send"**
2. Select channel (SMS/WhatsApp/Email)
3. Select recipients:
   - Individual user
   - SACCO members
   - All users
   - Custom filter
4. Compose or select template
5. Preview
6. Send

### Notification Logs

View delivery status:
- Sent notifications
- Delivery confirmations
- Failed deliveries
- Retry attempts

### Provider Health

Monitor notification provider status:
- API availability
- Delivery rates
- Error rates
- Balance (for prepaid)

---

## 9. Security & Audit

### Security Dashboard

Monitor security status:
- Failed login attempts
- Account lockouts
- Suspicious activity
- API abuse attempts

### Audit Logs

View complete audit trail:

| Logged Data | Example |
|-------------|---------|
| User ID | Who performed action |
| Action | What was done |
| Timestamp | When it occurred |
| IP Address | Where request originated |
| Changes | Before/after values |
| Request ID | For debugging |

### Security Alerts

Configure alerts for:
- Multiple failed logins
- Admin account creation
- Role changes
- Mass data exports
- Unusual API patterns

### Incident Response

When security incident occurs:

1. Identify scope of incident
2. Contain (disable affected accounts if needed)
3. Investigate root cause
4. Remediate
5. Document
6. Report (to management, regulators if required)

### Data Protection

Ensure DPA compliance:
- Data encryption status
- Access control reviews
- Retention policy enforcement
- Breach notification readiness

---

## 10. System Monitoring

### Application Monitoring

Monitor application health:
- Response times
- Error rates
- Memory usage
- CPU utilization

### Infrastructure Status

Check infrastructure components:

| Component | Health Check |
|-----------|--------------|
| **API Server** | `/api/v1/health` |
| **Database** | Connection pool status |
| **Redis** | Ping response |
| **Storage** | S3/MinIO connectivity |
| **Queue** | Job queue depth |

### Background Jobs

Monitor BullMQ job queues:
- Pending jobs
- Active jobs
- Completed jobs
- Failed jobs

**Actions:**
- View job details
- Retry failed jobs
- Clear completed jobs
- Pause/resume queues

### Logs

Access application logs:
- Error logs
- Access logs
- Audit logs
- Debug logs (development only)

### Alerts Configuration

Set up monitoring alerts:
- Email notifications
- SMS for critical issues
- Integration with monitoring tools (Prometheus, Grafana)

---

## 11. Support Operations

### Support Dashboard

Handle support requests:
- Open tickets
- User lookup
- Quick actions
- Knowledge base

### User Lookup

Comprehensive user search:
1. Enter phone, ID, or email
2. View full profile
3. See:
   - Registration history
   - KYC status
   - Payment history
   - Policy status
   - Support history

### Common Support Actions

| Issue | Resolution |
|-------|------------|
| **Can't receive OTP** | Verify phone, check SMS provider, resend |
| **Payment not reflected** | Check M-Pesa, verify transaction, manual credit if needed |
| **KYC rejected** | Review documents, explain rejection, guide resubmission |
| **Policy not received** | Check delivery status, resend via alternate channel |
| **Account locked** | Verify identity, unlock account |
| **Wrong information** | Verify identity, update records |

### Escalation Handling

For complex issues:
1. Document issue thoroughly
2. Research in system
3. Coordinate with relevant team (payments, underwriter, etc.)
4. Resolve and document
5. Follow up with user
6. Close ticket

---

## 12. Data Management

### Database Administration

**Backup Status:**
- Last backup time
- Backup retention (30 days)
- Recovery point objective

**Maintenance Tasks:**
- Index optimization
- Statistics update
- Connection pool tuning

### Data Export

For reporting or analysis:
1. Go to **"System"** > **"Data Export"**
2. Select data type
3. Apply filters
4. Choose format
5. Generate export

**Available Exports:**
- User data (anonymized)
- Transaction data
- Policy data
- Compliance data

### Data Retention

Configure retention policies:

| Data Type | Retention | After Retention |
|-----------|-----------|-----------------|
| User accounts | Lifetime + 7 years | Anonymize |
| KYC documents | Lifetime + 7 years | Delete |
| Transactions | 7 years | Archive |
| Policies | 7 years after expiry | Archive |
| Audit logs | 7 years | Archive |
| Session data | 90 days | Delete |

### Data Deletion

For right-to-deletion requests:

1. Verify user identity
2. Check for legal holds
3. Schedule soft delete
4. After 30-day grace period, anonymize
5. Document compliance

---

## Emergency Procedures

### System Outage

1. Confirm outage scope
2. Activate incident response
3. Notify stakeholders
4. Diagnose root cause
5. Implement fix
6. Verify recovery
7. Post-incident review

### Data Breach Response

1. Contain breach
2. Assess impact
3. Notify management
4. If PII affected, initiate 72-hour notification process
5. Remediate vulnerability
6. Document and report

### Payment System Failure

1. Pause payment processing
2. Contact M-Pesa support
3. Monitor for stuck transactions
4. Resume when resolved
5. Reconcile any discrepancies

---

## Best Practices

### Security

- Use strong, unique passwords
- Enable and secure 2FA
- Log out when away
- Report suspicious activity
- Regular access reviews

### Operations

- Document all manual changes
- Follow change management process
- Test in staging before production
- Monitor after changes
- Keep runbooks updated

### Communication

- Respond promptly to escalations
- Keep stakeholders informed
- Document decisions
- Regular status updates

---

## Support Contacts

**Technical Emergencies:** [On-call rotation]
**Management Escalation:** [Management contacts]
**Vendor Support:**
- M-Pesa: Safaricom Support
- SMS: Africa's Talking Support
- Cloud: AWS/GCP/Azure Support

---

*Maintaining platform excellence with BodaInsure.*
