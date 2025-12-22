# BodaInsure Role-Based Access Control & Decision Mapping

**Document Version:** 1.1
**Last Updated:** December 2024
**Purpose:** Define roles, permissions, UI access, and workflow responsibilities

---

## Table of Contents

1. [Role Definitions](#1-role-definitions)
2. [Permission Matrix](#2-permission-matrix)
3. [UI Navigation by Role](#3-ui-navigation-by-role)
4. [Key Workflows](#4-key-workflows)
5. [API Endpoints by Role](#5-api-endpoints-by-role)
6. [Authentication Methods](#6-authentication-methods)
7. [Role Hierarchy](#7-role-hierarchy)

---

## 1. Role Definitions

### Primary Roles

| Role | Code | Description | Organization |
|------|------|-------------|--------------|
| **Rider** | `rider` | Bodaboda driver - end user of the platform | Belongs to a SACCO |
| **SACCO Admin** | `sacco_admin` | Administrator of a local Savings and Credit Cooperative | Manages one SACCO |
| **KBA Admin** | `kba_admin` | Kenya Bodaboda Association administrator | Oversees all SACCOs under KBA |
| **Insurance Admin** | `insurance_admin` | Definite Assurance Company representative | Insurance underwriter staff |
| **Platform Admin** | `platform_admin` | Atronach K Ltd system administrator | Platform owner/developer |

### Specialized Roles (Compliance)

| Role | Code | Description |
|------|------|-------------|
| **Data Protection Officer** | `dpo` | Handles data breach notifications |
| **Security** | `security` | Security incident management |
| **Compliance** | `compliance` | Regulatory compliance oversight |

---

## 2. Permission Matrix

### Feature Access by Role

| Feature | Rider | SACCO Admin | KBA Admin | Insurance Admin | Platform Admin |
|---------|:-----:|:-----------:|:---------:|:---------------:|:--------------:|
| **KYC Upload** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **KYC Approval** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Make Payments** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **View Own Policies** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **User Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Organization CRUD** | ❌ | Own only | ✅ | ❌ | ✅ |
| **Organization Verify** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Member Management** | ❌ | Own SACCO | All SACCOs | ❌ | ✅ |
| **Member Approve** | ❌ | Own SACCO | All SACCOs | ❌ | ✅ |
| **Member Suspend/Reactivate** | ❌ | Own SACCO | All SACCOs | ❌ | ✅ |
| **Member Role Edit** | ❌ | Own SACCO | All SACCOs | ❌ | ✅ |
| **Member Revoke** | ❌ | Own SACCO | All SACCOs | ❌ | ✅ |
| **Policy Terms Management** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Dashboard - All Data** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Dashboard - KBA Filtered** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Dashboard - SACCO Filtered** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Reports** | ❌ | Own SACCO | KBA-wide | ✅ | ✅ |
| **User Search** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **System Settings** | ❌ | ❌ | ❌ | ❌ | ✅ |

### KYC Document Approval Authority

> **WHO CAN APPROVE KYC DOCUMENTS?**
>
> Only **Insurance Admin** and **Platform Admin** can approve or reject KYC documents.
>
> - SACCO Admin: ❌ Cannot approve KYC
> - KBA Admin: ❌ Cannot approve KYC
> - Insurance Admin: ✅ **Primary KYC reviewer**
> - Platform Admin: ✅ Can approve KYC (full system access)

---

## 3. UI Navigation by Role

### Rider (`/my/*` routes)

```
├── /my/wallet        → View wallet balance and payment status
├── /my/payment       → Make deposit or daily payments
├── /my/policies      → View all policies
├── /my/policies/:id  → View policy details
├── /my/kyc           → Upload and track KYC documents
└── /my/profile       → Update profile information
```

### SACCO Admin

```
├── /dashboard              → SACCO-level dashboard
│   ├── /enrollment         → SACCO enrollment metrics
│   ├── /payments           → SACCO payment metrics
│   └── /policies           → SACCO policy metrics
├── /organizations          → View SACCO details
│   └── /:id                → View organization with member management ⭐
│       ├── Add Member      → Add existing user to SACCO
│       ├── Approve Member  → Approve pending memberships
│       ├── Suspend Member  → Suspend active members
│       ├── Reactivate      → Reactivate suspended members
│       ├── Edit Role       → Change member role
│       └── Revoke Member   → Remove member from SACCO
└── /reports                → View SACCO reports
```

### KBA Admin

```
├── /dashboard              → KBA-level dashboard
│   ├── /enrollment         → KBA enrollment metrics
│   ├── /payments           → KBA payment metrics
│   └── /policies           → KBA policy metrics
├── /organizations          → View/manage all organizations
│   ├── /new                → Create new organization
│   ├── /:id/edit           → Edit organization
│   └── /:id                → View organization with member management ⭐
│       ├── Add Member      → Add existing user to any SACCO
│       ├── Approve Member  → Approve pending memberships
│       ├── Suspend Member  → Suspend active members
│       ├── Reactivate      → Reactivate suspended members
│       ├── Edit Role       → Change member role
│       └── Revoke Member   → Remove member from SACCO
└── /reports                → View KBA-wide reports
```

### Insurance Admin

```
├── /dashboard              → Full dashboard overview
│   ├── /enrollment         → Enrollment metrics
│   ├── /payments           → Payment metrics
│   └── /policies           → Policy metrics
├── /kyc                    → KYC review queue ⭐
│   └── /:id                → Review & approve documents ⭐
├── /reports                → View/generate reports
└── /settings
    └── /policy-terms       → Manage policy terms
```

### Platform Admin (Full Access)

```
├── /dashboard              → Full dashboard overview
│   ├── /enrollment         → Enrollment metrics
│   ├── /payments           → Payment metrics
│   └── /policies           → Policy metrics
├── /users                  → User search and management ⭐
│   └── /:id                → User details (activate/deactivate/reset)
├── /admin/users            → Admin user management
├── /organizations          → Organization management
│   ├── /new                → Create organization
│   └── /:id/edit           → Edit organization
├── /kyc                    → KYC review queue ⭐
│   └── /:id                → Review & approve documents ⭐
├── /reports                → All reports
├── /settings               → System settings
│   └── /policy-terms       → Manage policy terms
└── /my/*                   → Can access rider features
```

---

## 4. Key Workflows

### 4.1 KYC Document Approval Workflow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   RIDER     │     │  System Auto     │     │  INSURANCE_ADMIN    │
│             │     │  Processing      │     │  or PLATFORM_ADMIN  │
└─────┬───────┘     └────────┬─────────┘     └──────────┬──────────┘
      │                      │                          │
      │ 1. Upload document   │                          │
      │─────────────────────►│                          │
      │                      │                          │
      │                      │ 2. Validate format       │
      │                      │    (auto-processing)     │
      │                      │                          │
      │                      │ 3. Queue for review      │
      │                      │─────────────────────────►│
      │                      │                          │
      │                      │                          │ 4. View in /kyc queue
      │                      │                          │
      │                      │                          │ 5. Review document
      │                      │                          │    at /kyc/:id
      │                      │                          │
      │                      │     6. APPROVE/REJECT    │
      │                      │◄─────────────────────────│
      │                      │                          │
      │ 7. Notification      │                          │
      │◄─────────────────────│                          │
      │                      │                          │
      │ 8. If REJECTED,      │                          │
      │    re-upload         │                          │
      │─────────────────────►│                          │
```

**Document Status Flow:**
```
PENDING → PROCESSING → IN_REVIEW → APPROVED
                              ↓
                          REJECTED → (re-upload) → PENDING
```

**Required Documents (6 total):**
1. `ID_FRONT` - National ID (Front)
2. `ID_BACK` - National ID (Back)
3. `LICENSE` - Driving License
4. `LOGBOOK` - Vehicle Logbook
5. `KRA_PIN` - KRA PIN Certificate
6. `PHOTO` - Passport Photo

### 4.2 Rider Registration & Payment Flow

```
1. RIDER registers via phone         POST /auth/register (public)
         ↓
2. Verify OTP                        POST /auth/otp/verify (public)
         ↓
3. Upload KYC documents              POST /kyc/documents (RIDER)
         ↓
4. Submit KYC for review             POST /kyc/submit (RIDER)
         ↓
5. INSURANCE_ADMIN approves          PATCH /kyc/admin/documents/:id/review
         ↓
6. Make deposit payment (KES 1,048)  POST /payments/deposit (RIDER)
         ↓
7. System generates 1-month policy   (Batch processing - 3x daily)
         ↓
8. Make daily payments (KES 87)      POST /payments/daily (RIDER)
         ↓
9. After 30 payments,                (Batch processing)
   11-month policy issued
```

### 4.3 Organization Management Flow

```
PLATFORM_ADMIN                    KBA_ADMIN                    SACCO_ADMIN
      │                              │                              │
      │ Can create any org           │ Can create SACCOs            │ Can only edit
      │ Can delete orgs              │ Can verify SACCOs            │ own SACCO
      │ Can verify all               │ Cannot delete                │ Cannot create
      │                              │                              │
      ├──────────────────────────────┼──────────────────────────────┤
      │                              │                              │
      │         KBA (Umbrella Body)  │                              │
      │              │               │                              │
      │    ┌─────────┼─────────┐     │                              │
      │    │         │         │     │                              │
      │  SACCO1   SACCO2    SACCO3   │                              │
      │    │                         │                              │
      │  Members                     │                              │
```

### 4.4 Member Approval Flow

```
1. RIDER registers and joins platform
         ↓
2. SACCO_ADMIN adds user to SACCO    POST /memberships
         ↓
3. SACCO_ADMIN approves membership   POST /memberships/:id/approve
         ↓
4. User affiliated with SACCO
         ↓
5. KBA_ADMIN can view member         GET /memberships/organization/:id
   across all SACCOs
```

### 4.5 Member Management Workflow (CRUD)

**Member Lifecycle States:**
```
PENDING → ACTIVE → SUSPENDED → ACTIVE (reactivate)
    ↓         ↓          ↓
    └────────────────────┴────→ REVOKED (removed from org)
```

**Member Actions by Admin:**

| Action | Starting Status | Ending Status | Who Can Do It |
|--------|----------------|---------------|---------------|
| **Add Member** | (new) | PENDING | SACCO Admin, KBA Admin, Platform Admin |
| **Approve** | PENDING | ACTIVE | SACCO Admin, KBA Admin, Platform Admin |
| **Suspend** | ACTIVE | SUSPENDED | SACCO Admin, KBA Admin, Platform Admin |
| **Reactivate** | SUSPENDED | ACTIVE | SACCO Admin, KBA Admin, Platform Admin |
| **Edit Role** | Any | (unchanged) | SACCO Admin, KBA Admin, Platform Admin |
| **Revoke** | Any | REVOKED | SACCO Admin, KBA Admin, Platform Admin |

**Member Roles:**
| Role | Code | Description |
|------|------|-------------|
| Member | `MEMBER` | Regular SACCO member |
| Official | `OFFICIAL` | SACCO official |
| Admin | `ADMIN` | SACCO administrator |
| Chairperson | `CHAIRPERSON` | SACCO chairperson |
| Secretary | `SECRETARY` | SACCO secretary |
| Treasurer | `TREASURER` | SACCO treasurer |

**UI Flow:**
```
Organization Detail Page (/organizations/:id)
         │
         ├── Members Section
         │       │
         │       ├── [Add Member] button
         │       │       └── Search user by phone → Select role → Add
         │       │
         │       └── Member Row
         │               ├── Name, Phone, Status Badge, Role Badge
         │               └── [...] Action Menu
         │                       ├── Approve (if PENDING)
         │                       ├── Edit Role
         │                       ├── Suspend (if ACTIVE)
         │                       ├── Reactivate (if SUSPENDED)
         │                       └── Revoke Membership
         │
         └── Dialogs
                 ├── AddMemberDialog
                 ├── ApproveMemberDialog
                 ├── SuspendMemberDialog (with reason input)
                 ├── ReactivateMemberDialog
                 ├── RevokeMemberDialog
                 └── EditMemberRoleDialog
```

---

## 5. API Endpoints by Role

### Rider Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with phone |
| POST | `/auth/otp/verify` | Verify OTP |
| POST | `/auth/login` | Login |
| GET | `/kyc/status` | Check KYC status |
| POST | `/kyc/documents` | Upload document |
| GET | `/kyc/documents` | View own documents |
| POST | `/kyc/submit` | Submit for review |
| POST | `/payments/deposit` | Make deposit |
| POST | `/payments/daily` | Make daily payment |
| GET | `/wallet` | View wallet |
| GET | `/wallet/balance` | Check balance |
| GET | `/wallet/transactions` | Transaction history |
| GET | `/policies` | View policies |
| GET | `/policies/active` | Active policy |

### SACCO Admin / KBA Admin Endpoints (Member Management)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/memberships` | **Add member to organization** |
| GET | `/memberships/:id` | Get membership details |
| PUT | `/memberships/:id` | Update membership (role, etc.) |
| POST | `/memberships/:id/approve` | **Approve pending membership** |
| POST | `/memberships/:id/suspend` | **Suspend active membership** |
| POST | `/memberships/:id/reactivate` | **Reactivate suspended membership** |
| DELETE | `/memberships/:id` | **Revoke membership** |
| GET | `/memberships/user/:userId` | Get user's memberships |
| GET | `/memberships/user/:userId/primary` | Get user's primary membership |
| POST | `/memberships/user/:userId/primary/:membershipId` | Set primary membership |
| GET | `/memberships/check/:userId/:organizationId` | Check if user is member |
| POST | `/memberships/organization/:orgId/bulk` | Bulk add members |
| GET | `/memberships/organization/:orgId/count` | Get member count |
| GET | `/organizations/:id/members` | List organization members |

### Insurance Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/kyc/admin/pending` | **KYC queue** |
| GET | `/kyc/admin/pending/stats` | Queue statistics |
| PATCH | `/kyc/admin/documents/:id/review` | **Approve/Reject KYC** |
| GET | `/kyc/admin/documents/:id` | View document |
| GET | `/kyc/admin/documents/:id/download` | Download document |
| POST | `/policy-terms` | Create policy terms |
| PUT | `/policy-terms/:id` | Update policy terms |
| GET | `/dashboard/*` | All dashboard endpoints |
| GET | `/reports` | View reports |

### Platform Admin Endpoints (All of above plus)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users/search` | Search users |
| GET | `/admin/users/:id` | User details |
| POST | `/admin/users/:id/reset-kyc` | Reset KYC |
| PUT | `/admin/users/:id/activate` | Activate user |
| PUT | `/admin/users/:id/deactivate` | Deactivate user |
| POST | `/organizations` | Create organization |
| DELETE | `/organizations/:id` | Delete organization |
| GET | `/admin/stats` | Platform statistics |

---

## 6. Authentication Methods

### Rider Authentication
- **Method:** Phone + OTP
- **OTP Details:**
  - 6-digit code
  - 5-minute expiry
  - Max 5 verification attempts
  - Max 3 OTP requests per hour
- **Token Expiry:** 30 days (mobile), 30 minutes (web)

### Admin Authentication
- **Method:** Username/Password
- **Password:** Bcrypt hashed
- **Token Expiry:** 30 days (mobile), 30 minutes (web)

### Test Credentials (Development)

| Role | Phone | Username | Password |
|------|-------|----------|----------|
| Platform Admin | +254000000000 | SUPERUSER | ChangeMe123! |
| Rider | +254722000000 | 0722000000 | ChangeMe123! |
| SACCO Admin | +254722000001 | 0722000001 | ChangeMe123! |
| KBA Admin | +254722000002 | 0722000002 | ChangeMe123! |
| Insurance Admin | +254722000003 | 0722000003 | ChangeMe123! |
| Platform Admin | +254722000004 | 0722000004 | ChangeMe123! |

---

## 7. Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     PLATFORM_ADMIN                          │
│                   (Full System Access)                      │
│  • All permissions                                          │
│  • User management                                          │
│  • System configuration                                     │
│  • KYC approval                                             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│ INSURANCE_    │   │    KBA_ADMIN    │   │  SACCO_ADMIN  │
│    ADMIN      │   │                 │   │               │
├───────────────┤   ├─────────────────┤   ├───────────────┤
│ • KYC         │   │ • Organization  │   │ • Own SACCO   │
│   approval    │   │   management    │   │   management  │
│ • Policy      │   │ • SACCO         │   │ • Member      │
│   terms       │   │   verification  │   │   management  │
│ • Dashboards  │   │ • KBA-wide      │   │ • SACCO       │
│ • Reports     │   │   dashboards    │   │   dashboards  │
└───────────────┘   └─────────────────┘   └───────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │     RIDER       │
                    │                 │
                    ├─────────────────┤
                    │ • KYC upload    │
                    │ • Payments      │
                    │ • View policies │
                    │ • Wallet        │
                    └─────────────────┘
```

---

## Summary: Who Does What?

| Question | Answer |
|----------|--------|
| **Who approves KYC documents?** | Insurance Admin or Platform Admin |
| **Who manages SACCOs?** | KBA Admin (all) or SACCO Admin (own) |
| **Who can create organizations?** | Platform Admin or KBA Admin |
| **Who manages users?** | Platform Admin only |
| **Who manages members?** | SACCO Admin (own SACCO), KBA Admin (all SACCOs), Platform Admin (all) |
| **Who can add/approve/suspend members?** | SACCO Admin, KBA Admin, Platform Admin |
| **Who sets policy terms?** | Insurance Admin or Platform Admin |
| **Who makes payments?** | Riders only |
| **Who sees all data?** | Platform Admin and Insurance Admin |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2024 | Initial version |
| 1.1 | December 2024 | Added Member Management CRUD (Section 4.5), expanded permission matrix, added membership API endpoints |

---

*This document should be updated when roles, permissions, or workflows change.*
