# BodaInsure Platform — Module Architecture

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Document Owner:** Engineering  
**Status:** Draft  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Context](#2-system-context)
3. [Module Definitions](#3-module-definitions)
4. [Service Boundaries & Interactions](#4-service-boundaries--interactions)
5. [Data Architecture](#5-data-architecture)
6. [Integration Architecture](#6-integration-architecture)
7. [Infrastructure Architecture](#7-infrastructure-architecture)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Gaps & Missing Pieces](#9-gaps--missing-pieces)
10. [Related Documents](#10-related-documents)

---

## 1. Architecture Overview

### 1.1 Architecture Style

BodaInsure employs a **modular monolith** architecture for Phase 1, designed for evolution into microservices as scale demands. This approach balances:

- **Development velocity** (single deployable unit)
- **Operational simplicity** (reduced infrastructure complexity)
- **Future scalability** (clear module boundaries enable extraction)

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                  │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────────┤
│   Mobile App    │   Web Portal    │  USSD Gateway   │    Messaging Adapters     │
│  (Android/iOS)  │   (React SPA)   │   (*xxx*xxx#)   │  (WhatsApp/SMS/Email)     │
│                 │                 │                 │                           │
│  • Rider app    │  • Admin portal │  • Menu flows   │  • Inbound webhooks       │
│  • Offline sync │  • SACCO portal │  • Session mgmt │  • Outbound dispatch      │
└────────┬────────┴────────┬────────┴────────┬────────┴─────────────┬─────────────┘
         │                 │                 │                      │
         └─────────────────┴────────┬────────┴──────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Auth      │  │    Rate     │  │   Request   │  │   Logging   │              │
│  │  Middleware │  │   Limiting  │  │   Routing   │  │  & Metrics  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘              │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER (Modules)                             │
│                                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Identity   │  │     KYC      │  │   Payment    │  │    Policy    │          │
│  │   Module     │  │    Module    │  │   Module     │  │    Module    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │Organization  │  │ Notification │  │  Reporting   │  │   Scheduler  │          │
│  │   Module     │  │    Module    │  │   Module     │  │    Module    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                                   │
│  ┌──────────────┐                                                                 │
│  │    Audit     │                                                                 │
│  │   Module     │                                                                 │
│  └──────────────┘                                                                 │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │    Redis     │  │    Object    │  │    Message   │          │
│  │  (Primary)   │  │   (Cache)    │  │   Storage    │  │    Queue     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL INTEGRATIONS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   M-Pesa     │  │  WhatsApp    │  │     SMS      │  │  Underwriter │          │
│  │   Daraja     │  │  Business    │  │   Gateway    │  │     API      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles

| Principle | Application |
|-----------|-------------|
| **Separation of Concerns** | Each module owns its domain logic and data |
| **API-First** | All inter-module communication via well-defined interfaces |
| **Eventual Consistency** | Async processing for non-critical paths |
| **Fail-Safe Defaults** | Graceful degradation when dependencies fail |
| **Audit Everything** | All state changes logged for compliance |

---

## 2. System Context

### 2.1 Context Diagram

```
                                    ┌─────────────────┐
                                    │    Bodaboda     │
                                    │     Riders      │
                                    │   (700,000+)    │
                                    └────────┬────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                          ▼                  ▼                  ▼
                    ┌──────────┐      ┌──────────┐      ┌──────────┐
                    │  Mobile  │      │   USSD   │      │ WhatsApp │
                    │   App    │      │          │      │          │
                    └────┬─────┘      └────┬─────┘      └────┬─────┘
                         │                 │                 │
                         └─────────────────┼─────────────────┘
                                           │
                                           ▼
┌──────────────┐                 ┌───────────────────┐                 ┌──────────────┐
│     KBA      │ ◄─────────────► │                   │ ◄─────────────► │   M-Pesa     │
│   Admins     │   Web Portal    │    BodaInsure     │   Payments      │   Safaricom  │
└──────────────┘                 │     Platform      │                 └──────────────┘
                                 │                   │
┌──────────────┐                 │                   │                 ┌──────────────┐
│    SACCO     │ ◄─────────────► │                   │ ◄─────────────► │   Definite   │
│   Admins     │   Web Portal    │                   │   Policies      │  Assurance   │
└──────────────┘                 └───────────────────┘                 └──────────────┘
                                           │
                                           │
                         ┌─────────────────┼─────────────────┐
                         │                 │                 │
                         ▼                 ▼                 ▼
                  ┌──────────┐      ┌──────────┐      ┌──────────┐
                  │ Platform │      │Insurance │      │   IRA    │
                  │  Admin   │      │  Admin   │      │ Reports  │
                  │(Atronach)│      │  (Robs)  │      │          │
                  └──────────┘      └──────────┘      └──────────┘
```

### 2.2 Actor-System Interactions

| Actor | System Interaction | Primary Channel |
|-------|-------------------|-----------------|
| **Rider** | Register, upload docs, pay, view policy | Mobile App, USSD |
| **SACCO Admin** | Onboard members, track compliance, export reports | Web Portal |
| **KBA Admin** | Regional dashboards, campaign management | Web Portal |
| **Platform Admin** | System config, user support, reconciliation | Web Portal |
| **Insurance Admin** | Policy oversight, commission tracking | Web Portal |
| **M-Pesa** | Payment processing, callbacks | API |
| **Underwriter** | Policy generation, status updates | API/SFTP |

---

## 3. Module Definitions

### 3.1 Identity & Access Management Module

**Purpose**: Manages user authentication, authorization, and session lifecycle.

```
┌─────────────────────────────────────────────────────────────────┐
│                  IDENTITY & ACCESS MODULE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Registration   │  │ Authentication  │  │  Authorization  │ │
│  │    Service      │  │    Service      │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │  Session Mgmt   │  │   OTP Service   │                      │
│  │    Service      │  │                 │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • User accounts (credentials, status)                          │
│  • Roles and permissions                                        │
│  • Sessions and tokens                                          │
│  • OTP records                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • POST /auth/register                                          │
│  • POST /auth/login                                             │
│  • POST /auth/otp/send                                          │
│  • POST /auth/otp/verify                                        │
│  • POST /auth/logout                                            │
│  • GET  /auth/session                                           │
│  • GET  /users/{id}/permissions                                 │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: Notification Module (OTP delivery)                 │
│  • External: SMS Gateway                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Responsibilities**:
- User registration with phone number
- OTP-based mobile verification
- JWT token generation and validation
- Role-based access control (RBAC)
- Session management and timeout
- Password reset flows (for admin users)

**Roles Managed**:

| Role | Scope | Permissions |
|------|-------|-------------|
| `rider` | Own profile | View/edit profile, make payments, view policy |
| `sacco_admin` | SACCO members | View members, track compliance, bulk onboard |
| `kba_admin` | Regional scope | View regional data, generate reports |
| `insurance_admin` | All policies | Policy management, commission view |
| `platform_admin` | System-wide | Full access, configuration |

---

### 3.2 KYC & Document Management Module

**Purpose**: Handles identity verification, document collection, validation, and storage.

```
┌─────────────────────────────────────────────────────────────────┐
│                  KYC & DOCUMENT MODULE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    Document     │  │   Validation    │  │    Storage      │ │
│  │    Upload       │  │    Engine       │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │   KYC Status    │                                           │
│  │    Tracker      │                                           │
│  └─────────────────┘                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Document metadata                                            │
│  • Validation results                                           │
│  • KYC status per user                                          │
│  • Document storage references                                  │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • POST /kyc/documents                                          │
│  • GET  /kyc/documents/{id}                                     │
│  • GET  /kyc/status/{user_id}                                   │
│  • POST /kyc/validate/{user_id}                                 │
│  • GET  /kyc/requirements                                       │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: Identity Module (user context)                     │
│  • External: Object Storage (S3/GCS)                            │
└─────────────────────────────────────────────────────────────────┘
```

**Document Requirements**:

| Document | Validation Rules | Required |
|----------|------------------|----------|
| National ID (front) | Image quality, text extraction | Yes |
| National ID (back) | Image quality | Yes |
| Driver's License | Valid date, category | Yes |
| Motorcycle Logbook | Registration match | Yes |
| KRA PIN Certificate | Format validation | Yes |
| Passport Photo | Face detection | Yes |
| Inspection Certificate | Valid date | Conditional |

**KYC States**:
```
                ┌──────────────┐
                │   PENDING    │
                │  (no docs)   │
                └──────┬───────┘
                       │ Document uploaded
                       ▼
                ┌──────────────┐
                │  IN_REVIEW   │
                │(validating)  │
                └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ APPROVED │ │ REJECTED │ │INCOMPLETE│
   │          │ │(reasons) │ │(missing) │
   └──────────┘ └────┬─────┘ └────┬─────┘
                     │            │
                     └────────────┘
                           │ Resubmit
                           ▼
                    ┌──────────────┐
                    │  IN_REVIEW   │
                    └──────────────┘
```

---

### 3.3 Payment & Wallet Module

**Purpose**: Manages all financial transactions, wallet balances, and M-Pesa integration.

```
┌─────────────────────────────────────────────────────────────────┐
│                  PAYMENT & WALLET MODULE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Payment       │  │    Wallet       │  │   Transaction   │ │
│  │   Processor     │  │    Ledger       │  │    History      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   M-Pesa        │  │   Refund        │  │ Reconciliation  │ │
│  │   Adapter       │  │   Handler       │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Wallets                                                      │
│  • Transactions                                                 │
│  • Payment requests                                             │
│  • Reconciliation records                                       │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • POST /payments/initiate                                      │
│  • POST /payments/callback (M-Pesa webhook)                     │
│  • GET  /payments/{id}                                          │
│  • GET  /wallets/{user_id}                                      │
│  • GET  /wallets/{user_id}/transactions                         │
│  • POST /payments/refund                                        │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: Identity, Policy, Notification, Audit modules      │
│  • External: M-Pesa Daraja API                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Payment Flow**:

```
┌────────┐     ┌────────────┐     ┌────────────┐     ┌────────┐
│  User  │────▶│  Payment   │────▶│   M-Pesa   │────▶│  User  │
│  App   │     │  Module    │     │   Adapter  │     │ Phone  │
└────────┘     └────────────┘     └─────┬──────┘     └───┬────┘
                                        │                │
                                        │   STK Push     │
                                        │◄───────────────┘
                                        │
                                        │   User enters PIN
                                        │
                                        ▼
                                  ┌────────────┐
                                  │  Callback  │
                                  │  Handler   │
                                  └─────┬──────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
             ┌──────────┐        ┌──────────┐        ┌──────────┐
             │  Update  │        │  Notify  │        │  Trigger │
             │  Wallet  │        │   User   │        │  Policy  │
             └──────────┘        └──────────┘        └──────────┘
```

**Transaction Types**:

| Type | Amount | Trigger | Action |
|------|--------|---------|--------|
| `DEPOSIT` | 1,048 KES | User initiates | Credit wallet, trigger Policy 1 |
| `DAILY_PAYMENT` | 87 KES | User initiates | Credit wallet, update count |
| `PREMIUM_DEBIT` | Variable | System (batch) | Debit wallet to underwriter |
| `REFUND` | Variable | Admin action | Credit wallet from escrow |

**Wallet Structure**:
```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "balance": 0,
  "currency": "KES",
  "daily_payments_count": 0,
  "daily_payments_total": 0,
  "deposit_paid": true,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

### 3.4 Policy Management Module

**Purpose**: Manages insurance policy lifecycle from creation to expiry.

```
┌─────────────────────────────────────────────────────────────────┐
│                  POLICY MANAGEMENT MODULE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Policy        │  │    Batch        │  │   Underwriter   │ │
│  │   Engine        │  │   Processor     │  │    Adapter      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   Renewal       │  │    Document     │                      │
│  │   Handler       │  │   Generator     │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Policies                                                     │
│  • Policy documents (PDFs)                                      │
│  • Batch processing records                                     │
│  • Renewal schedules                                            │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • POST /policies (internal - batch creation)                   │
│  • GET  /policies/{id}                                          │
│  • GET  /policies/user/{user_id}                                │
│  • GET  /policies/{id}/document                                 │
│  • POST /policies/batch/process                                 │
│  • GET  /policies/expiring                                      │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: Payment, KYC, Notification, Organization modules   │
│  • External: Underwriter API/SFTP, Object Storage               │
└─────────────────────────────────────────────────────────────────┘
```

**Two-Policy Model**:

```
User Journey:
                                                           
  Day 0          Day 1-30              Day 31           Day 365
    │               │                    │                 │
    ▼               ▼                    ▼                 ▼
┌────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐
│Deposit │    │Daily Payments│    │  11-Month    │    │Renewal │
│1,048KES│    │  87 KES x 30 │    │   Policy     │    │  Due   │
└───┬────┘    └──────┬───────┘    └──────────────┘    └────────┘
    │                │
    ▼                ▼
┌────────────┐  ┌────────────┐
│  1-Month   │  │ Payments   │
│   Policy   │  │ Completed  │
│  Issued    │  │  (2,610)   │
└────────────┘  └─────┬──────┘
                      │
                      ▼
               ┌────────────┐
               │ 11-Month   │
               │  Policy    │
               │  Issued    │
               └────────────┘
```

**Policy States**:

| State | Description | Transitions |
|-------|-------------|-------------|
| `PENDING_DEPOSIT` | Awaiting initial payment | → PENDING_ISSUANCE |
| `PENDING_ISSUANCE` | In batch queue | → ACTIVE |
| `ACTIVE` | Valid coverage | → EXPIRING, LAPSED |
| `EXPIRING` | <30 days to expiry | → EXPIRED, RENEWED |
| `EXPIRED` | Coverage ended | → (terminal) |
| `LAPSED` | Payment default | → REINSTATED, EXPIRED |
| `CANCELLED` | User/admin cancelled | → (terminal) |

**Batch Processing Schedule**:

| Batch | Time | Contents |
|-------|------|----------|
| Batch 1 | 08:00 EAT | Payments received 00:00-07:59 |
| Batch 2 | 14:00 EAT | Payments received 08:00-13:59 |
| Batch 3 | 20:00 EAT | Payments received 14:00-19:59 |

---

### 3.5 Organization Management Module

**Purpose**: Manages hierarchical structure of umbrella bodies, SACCOs, and geographical units.

```
┌─────────────────────────────────────────────────────────────────┐
│                  ORGANIZATION MODULE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Organization   │  │   Membership    │  │   Hierarchy     │ │
│  │    Registry     │  │    Manager      │  │    Navigator    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │     Admin       │                                           │
│  │   Assignment    │                                           │
│  └─────────────────┘                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Organizations (KBA, SACCOs)                                  │
│  • Geographical units                                           │
│  • Membership relationships                                     │
│  • Admin assignments                                            │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • GET  /organizations                                          │
│  • GET  /organizations/{id}                                     │
│  • GET  /organizations/{id}/members                             │
│  • POST /organizations/{id}/members                             │
│  • GET  /organizations/hierarchy/{type}                         │
│  • GET  /geography/counties                                     │
│  • GET  /geography/counties/{id}/subcounties                    │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: Identity Module (admin users)                      │
│  • External: None                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Hierarchy Models**:

```
Model A: Geographical                Model B: Membership
─────────────────────                ───────────────────

     Country                              Umbrella Body
        │                                     (KBA)
        ▼                                      │
     County ────────────────┐                  ▼
        │                   │              Registered
        ▼                   │                SACCO
    Subcounty               │                  │
        │                   │                  ▼
        ▼                   │               Member
      Ward                  │              (Rider)
        │                   │
        ▼                   │
      Stage ◄───────────────┘
        │
        ▼
     Member
     (Rider)
```

**Organization Types**:

| Type | Example | Admin Capabilities |
|------|---------|-------------------|
| `UMBRELLA_BODY` | KBA | National view, all reports |
| `SACCO` | Nakuru Riders SACCO | Member management, SACCO reports |
| `COUNTY` | Nakuru County | County-level aggregation |
| `SUBCOUNTY` | Nakuru North | Subcounty aggregation |
| `WARD` | Lanet Ward | Ward-level view |
| `STAGE` | Lanet Stage | Physical location tracking |

---

### 3.6 Notification Module

**Purpose**: Orchestrates all outbound communications across multiple channels.

```
┌─────────────────────────────────────────────────────────────────┐
│                  NOTIFICATION MODULE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Template      │  │    Delivery     │  │    Channel      │ │
│  │    Engine       │  │  Orchestrator   │  │   Adapters      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   Preference    │  │    Delivery     │                      │
│  │    Manager      │  │    Tracker      │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
│  Channel Adapters:                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │  SMS   │ │WhatsApp│ │ Email  │ │  Push  │ │  USSD  │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Notification templates                                       │
│  • Delivery records                                             │
│  • User preferences                                             │
│  • Channel configurations                                       │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • POST /notifications/send                                     │
│  • POST /notifications/bulk                                     │
│  • GET  /notifications/user/{user_id}                           │
│  • PUT  /notifications/preferences/{user_id}                    │
│  • GET  /notifications/templates                                │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: Identity, Organization modules                     │
│  • External: SMS Gateway, WhatsApp API, Email Service           │
└─────────────────────────────────────────────────────────────────┘
```

**Notification Types**:

| Type | Channels | Trigger |
|------|----------|---------|
| `OTP` | SMS | Registration, login |
| `PAYMENT_REMINDER` | SMS, WhatsApp | Daily (scheduler) |
| `PAYMENT_CONFIRMATION` | SMS | Payment callback |
| `POLICY_ISSUED` | WhatsApp, Email | Batch completion |
| `POLICY_EXPIRING` | SMS, WhatsApp | 30, 15, 7, 3, 1 days before |
| `PAYMENT_FAILED` | SMS | Payment callback (failure) |
| `KYC_STATUS` | SMS | Document validation complete |

**Channel Priority**:
```
1. SMS (universal, mandatory notifications)
2. WhatsApp (policy documents, rich content)
3. Email (policy documents, optional)
4. Push (app users only)
```

---

### 3.7 Reporting & Analytics Module

**Purpose**: Provides dashboards, scheduled reports, and data exports for all stakeholders.

```
┌─────────────────────────────────────────────────────────────────┐
│                  REPORTING MODULE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Dashboard     │  │    Report       │  │     Export      │ │
│  │    Engine       │  │   Generator     │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │  Aggregation    │  │    Scheduler    │                      │
│  │    Service      │  │                 │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Aggregated metrics                                           │
│  • Report definitions                                           │
│  • Generated report files                                       │
│  • Dashboard configurations                                     │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • GET  /reports/dashboard/{type}                               │
│  • GET  /reports/enrollment                                     │
│  • GET  /reports/payments                                       │
│  • GET  /reports/policies                                       │
│  • POST /reports/generate                                       │
│  • GET  /reports/export/{format}                                │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: All modules (read-only access)                     │
│  • External: None                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Dashboard Types**:

| Dashboard | Audience | Key Metrics |
|-----------|----------|-------------|
| **Platform Overview** | Platform Admin | Total users, revenue, system health |
| **Enrollment** | KBA/SACCO Admin | Registrations, KYC completion, deposits |
| **Payments** | Platform/Insurance Admin | Daily collections, compliance rate, defaults |
| **Policies** | Insurance Admin | Active policies, expirations, renewals |
| **Regional** | KBA Admin | County/subcounty breakdown |
| **SACCO** | SACCO Admin | Member status, compliance |

**Scheduled Reports**:

| Report | Frequency | Recipients | Format |
|--------|-----------|------------|--------|
| Daily Reconciliation | Daily 06:00 | Finance team | PDF, CSV |
| Weekly Enrollment | Weekly (Mon) | KBA leadership | PDF |
| Monthly IRA Compliance | Monthly (1st) | Insurance Admin, IRA | PDF |
| Quarterly Performance | Quarterly | All stakeholders | PDF, Excel |

---

### 3.8 Scheduler Module

**Purpose**: Manages time-based job execution for batch processing, reminders, and reports.

```
┌─────────────────────────────────────────────────────────────────┐
│                  SCHEDULER MODULE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Job           │  │    Cron         │  │     Job         │ │
│  │   Registry      │  │   Manager       │  │    Executor     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │   Retry         │                                           │
│  │   Handler       │                                           │
│  └─────────────────┘                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Scheduled Jobs:                                                │
│  • Policy batch processing (3x daily)                           │
│  • Payment reminder dispatch (daily)                            │
│  • Expiry notification (daily)                                  │
│  • Report generation (per schedule)                             │
│  • Reconciliation jobs (daily)                                  │
│  • Data cleanup (weekly)                                        │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • GET  /scheduler/jobs                                         │
│  • POST /scheduler/jobs/{id}/trigger                            │
│  • GET  /scheduler/jobs/{id}/history                            │
│  • PUT  /scheduler/jobs/{id}/pause                              │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: All modules (triggers jobs in each)                │
│  • External: None                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Job Schedule**:

| Job | Schedule | Duration Target |
|-----|----------|-----------------|
| `policy_batch_1` | 08:00 EAT | <30 min |
| `policy_batch_2` | 14:00 EAT | <30 min |
| `policy_batch_3` | 20:00 EAT | <30 min |
| `payment_reminders` | 07:00 EAT | <60 min |
| `expiry_notifications` | 09:00 EAT | <30 min |
| `daily_reconciliation` | 06:00 EAT | <60 min |
| `weekly_reports` | Mon 05:00 EAT | <120 min |

---

### 3.9 Audit Module

**Purpose**: Provides immutable audit trail for compliance, debugging, and forensics.

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUDIT MODULE                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Components:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    Event        │  │    Log          │  │    Query        │ │
│  │   Collector     │  │   Storage       │  │    Interface    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Owned:                                                    │
│  • Audit events                                                 │
│  • State change logs                                            │
│  • API access logs                                              │
│  • Security events                                              │
├─────────────────────────────────────────────────────────────────┤
│  Events Captured:                                               │
│  • All authentication events                                    │
│  • All payment transactions                                     │
│  • Policy state changes                                         │
│  • KYC status changes                                           │
│  • Admin actions                                                │
│  • Configuration changes                                        │
├─────────────────────────────────────────────────────────────────┤
│  Interfaces Exposed:                                            │
│  • GET  /audit/events                                           │
│  • GET  /audit/events/{entity_type}/{entity_id}                 │
│  • GET  /audit/user/{user_id}/activity                          │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  • Internal: All modules (event sources)                        │
│  • External: Log aggregation service (optional)                 │
└─────────────────────────────────────────────────────────────────┘
```

**Audit Event Structure**:
```json
{
  "event_id": "uuid",
  "timestamp": "ISO8601",
  "event_type": "PAYMENT_COMPLETED",
  "actor_id": "user_uuid",
  "actor_type": "RIDER",
  "entity_type": "PAYMENT",
  "entity_id": "payment_uuid",
  "action": "CREATE",
  "previous_state": null,
  "new_state": { "status": "COMPLETED" },
  "metadata": {
    "ip_address": "x.x.x.x",
    "channel": "MOBILE_APP",
    "mpesa_ref": "QWE123456"
  }
}
```

---

## 4. Service Boundaries & Interactions

### 4.1 Module Interaction Map

```
                              ┌─────────────┐
                              │  SCHEDULER  │
                              └──────┬──────┘
                                     │ triggers
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│    POLICY     │◄──────────▶│   PAYMENT     │◄──────────▶│ NOTIFICATION  │
│    MODULE     │            │    MODULE     │            │    MODULE     │
└───────┬───────┘            └───────┬───────┘            └───────┬───────┘
        │                            │                            │
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│  UNDERWRITER  │            │    M-PESA     │            │  SMS/WHATSAPP │
│   (External)  │            │   (External)  │            │   (External)  │
└───────────────┘            └───────────────┘            └───────────────┘

┌───────────────┐            ┌───────────────┐
│   IDENTITY    │◄──────────▶│     KYC       │
│    MODULE     │            │    MODULE     │
└───────┬───────┘            └───────┬───────┘
        │                            │
        │      ┌───────────────┐     │
        └─────▶│ ORGANIZATION  │◄────┘
               │    MODULE     │
               └───────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │   REPORTING   │◄────── reads from all modules
               │    MODULE     │
               └───────────────┘

                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────┐            ┌───────────────┐
│    AUDIT      │            │     ALL       │
│    MODULE     │◄────────── │   MODULES     │
└───────────────┘  events    └───────────────┘
```

### 4.2 Synchronous vs Asynchronous Interactions

| Interaction | Type | Rationale |
|-------------|------|-----------|
| User authentication | Sync | Immediate response required |
| Payment initiation | Sync | User waiting for STK push |
| Payment callback processing | Async | Background processing acceptable |
| Policy batch generation | Async | Scheduled job, no user waiting |
| Notification dispatch | Async | Fire-and-forget with retry |
| Report generation | Async | Long-running, scheduled |
| Audit event logging | Async | Non-blocking |

### 4.3 Inter-Module Communication Patterns

**Pattern 1: Request-Response (Sync)**
```
┌────────┐   HTTP Request    ┌────────┐
│Module A│ ────────────────▶ │Module B│
│        │ ◀──────────────── │        │
└────────┘   HTTP Response   └────────┘
```

**Pattern 2: Event-Driven (Async)**
```
┌────────┐                   ┌─────────┐                   ┌────────┐
│Module A│ ───publish───▶   │  Queue  │ ───subscribe───▶  │Module B│
└────────┘                   └─────────┘                   └────────┘
```

**Pattern 3: Saga (Distributed Transaction)**
```
Payment Saga:

1. Payment Module: Create payment record (PENDING)
2. Payment Module: Call M-Pesa STK Push
3. M-Pesa: Callback received
4. Payment Module: Update payment (COMPLETED)
5. Payment Module: Emit PAYMENT_COMPLETED event
6. Wallet Module: Credit user wallet
7. Policy Module: Check policy eligibility
8. Notification Module: Send confirmation
9. Audit Module: Log all state changes

Compensation on failure at step 4:
- Payment Module: Update payment (FAILED)
- Notification Module: Send failure notification
```

---

## 5. Data Architecture

### 5.1 Data Ownership Matrix

| Module | Primary Tables | Owns |
|--------|---------------|------|
| **Identity** | `users`, `roles`, `sessions`, `otps` | User authentication data |
| **KYC** | `documents`, `kyc_status`, `validations` | Document and verification data |
| **Payment** | `wallets`, `transactions`, `payment_requests` | Financial data |
| **Policy** | `policies`, `policy_documents`, `batches` | Insurance policy data |
| **Organization** | `organizations`, `memberships`, `geography` | Structural data |
| **Notification** | `notifications`, `templates`, `preferences` | Communication data |
| **Reporting** | `report_definitions`, `generated_reports` | Report metadata |
| **Scheduler** | `jobs`, `job_history` | Scheduling data |
| **Audit** | `audit_events` | Immutable logs |

### 5.2 Entity Relationship Overview

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      USER       │       │     WALLET      │       │   TRANSACTION   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │──┐    │ id (PK)         │
│ phone_number    │  │    │ user_id (FK)  ◄─┼──┘    │ wallet_id (FK)◄─┼──┐
│ email           │  │    │ balance         │       │ amount          │  │
│ status          │  │    │ daily_count     │       │ type            │  │
│ kyc_status      │  │    │ created_at      │       │ mpesa_ref       │  │
│ org_id (FK)     │  │    └─────────────────┘       │ status          │  │
└─────────────────┘  │                              │ created_at      │  │
         │           │                              └─────────────────┘  │
         │           │                                                   │
         │           │    ┌─────────────────┐                            │
         │           │    │     POLICY      │                            │
         │           │    ├─────────────────┤                            │
         │           └───▶│ id (PK)         │                            │
         │                │ user_id (FK)    │                            │
         │                │ policy_number   │◄───────────────────────────┘
         │                │ type            │   (policy_id on transaction)
         │                │ start_date      │
         │                │ end_date        │
         │                │ status          │
         │                └─────────────────┘
         │
         │           ┌─────────────────┐       ┌─────────────────┐
         │           │   ORGANIZATION  │       │    DOCUMENT     │
         │           ├─────────────────┤       ├─────────────────┤
         └──────────▶│ id (PK)         │       │ id (PK)         │
                     │ name            │       │ user_id (FK)  ◄─┼── (from USER)
                     │ type            │       │ type            │
                     │ parent_id (FK)  │       │ storage_url     │
                     │ level           │       │ validated       │
                     └─────────────────┘       │ created_at      │
                                               └─────────────────┘
```

### 5.3 Data Flow for Key Operations

**Registration → Policy Issuance Flow**:
```
1. USER created (Identity)
        │
        ▼
2. DOCUMENTS uploaded (KYC)
        │
        ▼
3. KYC_STATUS updated (KYC)
        │
        ▼
4. WALLET created (Payment)
        │
        ▼
5. TRANSACTION recorded - deposit (Payment)
        │
        ▼
6. WALLET.balance updated (Payment)
        │
        ▼
7. POLICY created - PENDING (Policy)
        │
        ▼
8. [Batch Processing]
        │
        ▼
9. POLICY updated - ACTIVE (Policy)
        │
        ▼
10. POLICY_DOCUMENT generated (Policy)
        │
        ▼
11. NOTIFICATION sent (Notification)
        │
        ▼
12. AUDIT_EVENT logged (Audit) - at every step
```

---

## 6. Integration Architecture

### 6.1 External Integration Summary

| System | Integration Type | Direction | Purpose |
|--------|-----------------|-----------|---------|
| **M-Pesa (Daraja)** | REST API | Bidirectional | Payment processing |
| **WhatsApp Business** | REST API | Outbound | Policy delivery, notifications |
| **SMS Gateway** | REST API | Outbound | OTP, alerts |
| **Email Service** | SMTP/API | Outbound | Document delivery |
| **Underwriter** | SFTP/Email (Phase 1), API (Phase 2) | Bidirectional | Policy issuance |
| **USSD Gateway** | Proprietary | Bidirectional | Feature phone access |

### 6.2 M-Pesa Integration Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                    M-PESA INTEGRATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Endpoints Used:                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STK Push (C2B)                                          │   │
│  │ POST /mpesa/stkpush/v1/processrequest                   │   │
│  │ Purpose: Initiate payment from user                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ B2C (Business to Customer)                              │   │
│  │ POST /mpesa/b2c/v1/paymentrequest                       │   │
│  │ Purpose: Refunds to user                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Transaction Status                                      │   │
│  │ POST /mpesa/transactionstatus/v1/query                  │   │
│  │ Purpose: Query pending transactions                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Callback URLs (our system):                                   │
│  • POST /api/v1/payments/mpesa/callback                        │
│  • POST /api/v1/payments/mpesa/timeout                         │
│                                                                 │
│  Security:                                                      │
│  • OAuth 2.0 token authentication                              │
│  • Request signing                                             │
│  • IP whitelisting                                             │
│  • TLS 1.2+                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**M-Pesa Payment Sequence**:
```
┌──────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────┐
│ User │     │   App    │     │ Payment  │     │  M-Pesa  │     │ User │
│      │     │          │     │  Module  │     │  Daraja  │     │Phone │
└──┬───┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └──┬───┘
   │              │                │                │              │
   │  Pay 87 KES  │                │                │              │
   │─────────────▶│                │                │              │
   │              │  POST /pay     │                │              │
   │              │───────────────▶│                │              │
   │              │                │  STK Push      │              │
   │              │                │───────────────▶│              │
   │              │                │                │  Push prompt │
   │              │                │                │─────────────▶│
   │              │   "Check phone"│                │              │
   │              │◀───────────────│                │              │
   │              │                │                │   Enter PIN  │
   │              │                │                │◀─────────────│
   │              │                │   Callback     │              │
   │              │                │◀───────────────│              │
   │              │   Success      │                │              │
   │              │◀───────────────│                │              │
   │   Receipt    │                │                │              │
   │◀─────────────│                │                │              │
   │              │                │                │              │
```

### 6.3 Underwriter Integration Detail

**Phase 1: Batch File Exchange**
```
┌─────────────────────────────────────────────────────────────────┐
│                 UNDERWRITER INTEGRATION (Phase 1)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Outbound (BodaInsure → Definite Assurance):                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ File: policy_request_YYYYMMDD_HHMMSS.xlsx               │   │
│  │ Delivery: SFTP / Encrypted Email                        │   │
│  │ Schedule: 3x daily (after batch processing)             │   │
│  │ Contents:                                               │   │
│  │   • Rider details (name, ID, phone)                     │   │
│  │   • Motorcycle details (reg, make, model)               │   │
│  │   • Policy type (1-month / 11-month)                    │   │
│  │   • Payment confirmation                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Inbound (Definite Assurance → BodaInsure):                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ File: policy_issued_YYYYMMDD_HHMMSS.xlsx                │   │
│  │ Delivery: SFTP / Encrypted Email                        │   │
│  │ Contents:                                               │   │
│  │   • Policy numbers                                      │   │
│  │   • Policy start/end dates                              │   │
│  │   • PDF document URLs or attachments                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 2: API Integration** (Future)
```
POST /api/v1/policies/bulk
GET  /api/v1/policies/{policy_number}
POST /api/v1/claims (future)
```

### 6.4 USSD Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                      USSD INTEGRATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Shortcode: *xxx*xxx#                                          │
│  Provider: Africa's Talking / Safaricom Direct                 │
│                                                                 │
│  Session Flow:                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ *xxx*xxx#                                               │   │
│  │     │                                                   │   │
│  │     ▼                                                   │   │
│  │ [Welcome to BodaInsure]                                 │   │
│  │ 1. Check Balance                                        │   │
│  │ 2. Make Payment                                         │   │
│  │ 3. Policy Status                                        │   │
│  │ 4. Get Help                                             │   │
│  │     │                                                   │   │
│  │     ├──▶ [1] Balance: 174 KES                           │   │
│  │     │        Daily payments: 2/30                       │   │
│  │     │                                                   │   │
│  │     ├──▶ [2] Enter amount: ___                          │   │
│  │     │        │                                          │   │
│  │     │        ▼                                          │   │
│  │     │    [M-Pesa prompt sent to 0712...]                │   │
│  │     │                                                   │   │
│  │     ├──▶ [3] Policy: ACTIVE                             │   │
│  │     │        Expires: 15 Dec 2025                       │   │
│  │     │                                                   │   │
│  │     └──▶ [4] Call 0800-XXX-XXX                          │   │
│  │             or SMS HELP to 12345                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Technical:                                                     │
│  • Session timeout: 180 seconds                                │
│  • Max menu depth: 4 levels                                    │
│  • Response time SLA: <2 seconds                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Infrastructure Architecture

### 7.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD INFRASTRUCTURE                              │
│                        (AWS / GCP / Azure - Kenya Region)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        LOAD BALANCER (L7)                           │   │
│  │                    (SSL Termination, WAF)                           │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                         │
│         ┌────────────────────────┼────────────────────────┐                │
│         │                        │                        │                │
│         ▼                        ▼                        ▼                │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │   API Pod   │          │   API Pod   │          │   API Pod   │        │
│  │  (App + All │          │  (App + All │          │  (App + All │        │
│  │   Modules)  │          │   Modules)  │          │   Modules)  │        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│         │                        │                        │                │
│         └────────────────────────┼────────────────────────┘                │
│                                  │                                         │
│                                  ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         INTERNAL NETWORK                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                        │                        │                │
│         ▼                        ▼                        ▼                │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │ PostgreSQL  │          │    Redis    │          │   Object    │        │
│  │  Primary    │          │   Cluster   │          │   Storage   │        │
│  │     +       │          │             │          │   (S3/GCS)  │        │
│  │  Replica    │          │             │          │             │        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│                                                                             │
│  ┌─────────────┐          ┌─────────────┐                                  │
│  │   Worker    │          │   Worker    │   (Background job processors)   │
│  │    Pod      │          │    Pod      │                                  │
│  └─────────────┘          └─────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Technology Stack Summary

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Runtime** | Node.js 20 LTS / Python 3.11 | Async I/O, ecosystem |
| **Framework** | NestJS / FastAPI | Type safety, OpenAPI |
| **Database** | PostgreSQL 15 | ACID, JSON support |
| **Cache** | Redis 7 | Sessions, rate limiting |
| **Queue** | Redis Streams / BullMQ | Job processing |
| **Storage** | S3-compatible | Documents, policies |
| **Container** | Docker | Standardized builds |
| **Orchestration** | Kubernetes (managed) | Scaling, resilience |
| **CI/CD** | GitHub Actions | Automation |
| **Monitoring** | Prometheus + Grafana | Metrics |
| **Logging** | ELK / CloudWatch | Centralized logs |
| **APM** | Sentry | Error tracking |

### 7.3 Environment Strategy

| Environment | Purpose | Data | Scale |
|-------------|---------|------|-------|
| **Development** | Feature development | Synthetic | 1 pod |
| **Staging** | Integration testing | Anonymized prod subset | 2 pods |
| **UAT** | User acceptance | Anonymized prod subset | 2 pods |
| **Production** | Live system | Real | 3+ pods (auto-scale) |

---

## 8. Cross-Cutting Concerns

### 8.1 Security

| Concern | Implementation |
|---------|---------------|
| **Authentication** | JWT with RS256 signing |
| **Authorization** | RBAC with permission checks |
| **Encryption at Rest** | AES-256 (database, storage) |
| **Encryption in Transit** | TLS 1.3 |
| **API Security** | Rate limiting, request validation |
| **Secrets Management** | Vault / Cloud KMS |
| **PII Handling** | Field-level encryption, access logging |

### 8.2 Observability

| Pillar | Tools | Key Metrics |
|--------|-------|-------------|
| **Metrics** | Prometheus, Grafana | Request rate, latency, errors |
| **Logging** | ELK Stack | Structured JSON logs |
| **Tracing** | Jaeger / OpenTelemetry | Request flow tracing |
| **Alerting** | PagerDuty / Grafana Alerts | SLA breaches |

### 8.3 Resilience

| Pattern | Implementation |
|---------|---------------|
| **Circuit Breaker** | On external API calls (M-Pesa, SMS) |
| **Retry with Backoff** | Payment callbacks, notifications |
| **Timeout** | All HTTP calls (configurable) |
| **Bulkhead** | Separate pools for critical paths |
| **Graceful Degradation** | Fallback to SMS when WhatsApp fails |

### 8.4 Multi-Language Support

| Language | Code | Coverage |
|----------|------|----------|
| English | `en` | Full (default) |
| Swahili | `sw` | Full (Phase 1) |

**Implementation**: i18n resource files, user preference stored in profile.

---

## 9. Gaps & Missing Pieces

### 9.1 Information Not in Source Document

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **Claims Processing Flow** | Cannot design claims module | Clarify with Definite Assurance |
| **Specific USSD Shortcode** | Integration cannot be tested | Confirm allocation with telco |
| **M-Pesa Paybill/Till Number** | Payment integration blocked | Confirm with Safaricom |
| **Underwriter API Specification** | Cannot design Phase 2 integration | Request API docs from Definite |
| **Commission Split Details** | Cannot build commission tracking | Clarify business terms |
| **Grace Period Rules** | Cannot implement lapse logic | Define business rules |
| **Refund Policy** | Cannot implement refund flow | Define with legal/compliance |
| **Data Retention Policy** | Cannot implement cleanup jobs | Define with DPO |
| **Disaster Recovery Site** | Cannot design DR | Select secondary region |
| **Support Ticketing System** | No integration designed | Select/build system |

### 9.2 Assumptions Made

| # | Assumption | Validation Required |
|---|------------|---------------------|
| 1 | Modular monolith is acceptable for Phase 1 | Architecture review |
| 2 | PostgreSQL meets performance requirements | Load testing |
| 3 | 3x daily batch processing meets SLA | Business confirmation |
| 4 | Redis Streams sufficient for job queuing | Performance testing |
| 5 | Single cloud region acceptable | Compliance review |

### 9.3 Recommended Follow-Up Documents

- API Specification (OpenAPI/Swagger)
- Data Dictionary with field-level definitions
- Disaster Recovery Plan
- Security Architecture Document
- Performance Testing Plan
- Integration Test Plan

---

## 10. Related Documents

| Document | Description | Link |
|----------|-------------|------|
| Product Description | Business context and requirements | [product_description.md](product_description.md) |
| Requirements Specification | Detailed requirements | [requirements_specification.md](requirements_specification.md) |
| Feature Specification | Feature-level details | [feature_specification.md](feature_specification.md) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Engineering Team | Initial draft |

---

*End of Document*
