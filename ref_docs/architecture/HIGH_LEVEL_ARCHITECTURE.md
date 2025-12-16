# BodaInsure High-Level Architecture

**Document Version:** 1.0
**Last Updated:** December 2024
**Purpose:** Comprehensive high-level architecture documentation for the BodaInsure platform

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Objectives](#2-core-objectives)
3. [Major Components](#3-major-components)
4. [Component Responsibilities and Interactions](#4-component-responsibilities-and-interactions)
5. [Data Flow](#5-data-flow)
6. [Security, Authentication, and Authorization](#6-security-authentication-and-authorization)
7. [Deployment Topology](#7-deployment-topology)
8. [Technology Stack](#8-technology-stack)

---

## 1. System Overview

BodaInsure is a digital insurance distribution platform enabling Kenya's 700,000+ bodaboda (motorcycle taxi) riders to access mandatory Third-Party Only (TPO) insurance through an affordable micropayment model.

### 1.1 Business Model

```
Traditional Model:
┌──────────────────────────────────────────────────────────┐
│  Annual lump sum: 3,500 KES (unaffordable for most)      │
└──────────────────────────────────────────────────────────┘

BodaInsure Two-Policy Model:
┌──────────────────────────────────────────────────────────┐
│  Policy 1 (1-month):                                      │
│  ├─ Initial Deposit: 1,048 KES                           │
│  └─ Triggers: Immediate 1-month TPO coverage             │
│                                                          │
│  Policy 2 (11-month):                                     │
│  ├─ Daily Payments: 87 KES × 30 days = 2,610 KES         │
│  └─ Triggers: 11-month extended TPO coverage             │
│                                                          │
│  Total Annual: 3,658 KES (full 12-month coverage)        │
└──────────────────────────────────────────────────────────┘
```

### 1.2 High-Level System Diagram

```
                              ┌─────────────────────┐
                              │    Bodaboda Riders  │
                              │   (End Users)       │
                              └─────────┬───────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
           ▼                            ▼                            ▼
   ┌───────────────┐          ┌─────────────────┐          ┌─────────────────┐
   │  Mobile App   │          │  USSD (*123#)   │          │  Admin Portal   │
   │  (Future)     │          │  (Feature Phone)│          │  (React/Vite)   │
   └───────┬───────┘          └────────┬────────┘          └────────┬────────┘
           │                           │                            │
           └───────────────────────────┼────────────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │     Nginx Reverse Proxy      │
                        │   (SSL Termination, Rate     │
                        │    Limiting, Load Balancing) │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BodaInsure Backend API                              │
│                           (NestJS Modular Monolith)                         │
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Identity   │ │   Payment   │ │   Policy    │ │   Notification      │   │
│  │  Module     │ │   Module    │ │   Module    │ │   Module            │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │    KYC      │ │Organization │ │  Reporting  │ │      USSD           │   │
│  │   Module    │ │   Module    │ │   Module    │ │     Module          │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Scheduler  │ │   Queue     │ │   Audit     │ │     Storage         │   │
│  │   Module    │ │   Module    │ │   Module    │ │     Module          │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  PostgreSQL   │         │     Redis     │         │  MinIO/S3     │
│  (Primary DB) │         │(Cache/Queues) │         │(Object Store) │
└───────────────┘         └───────────────┘         └───────────────┘

                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│    M-Pesa     │         │ SMS Gateways  │         │   WhatsApp    │
│ (Safaricom)   │         │ (AT, AdvantaSMS)│       │  Business API │
└───────────────┘         └───────────────┘         └───────────────┘
```

---

## 2. Core Objectives

### 2.1 Business Objectives

| Objective | Target | Implementation |
|-----------|--------|----------------|
| **Enrollment** | 700,000 users in Year 1 | Multi-channel access (App, USSD, Web) |
| **Policy Delivery** | Within 6 hours of payment | 3x daily batch processing (08:00, 14:00, 20:00 EAT) |
| **System Uptime** | 99.5% availability | Health checks, auto-restart, load balancing |
| **Compliance** | 100% IRA and DPA adherence | Audit trails, 72-hour breach notification, data encryption |

### 2.2 Technical Objectives

1. **Scalability**: Support 10,000+ concurrent users
2. **Reliability**: Fault-tolerant architecture with automatic recovery
3. **Security**: End-to-end encryption, PII protection, immutable audit logs
4. **Maintainability**: Modular monolith allowing future microservices extraction
5. **Accessibility**: USSD support for feature phones (low-literacy users)

---

## 3. Major Components

### 3.1 Client Applications

#### Admin Portal (React/Vite)
```
Location: src/client/
Framework: React 19 + Vite 6 + TypeScript
State Management: Zustand (auth) + React Query (server state)
UI Components: Shadcn/ui + Radix UI + Tailwind CSS
```

**Key Features:**
- Dashboard with enrollment, payment, and policy metrics
- User search and management
- KYC document review with image zoom/rotate
- Organization (KBA/SACCO) management
- Report generation and export (CSV, Excel, PDF)
- Real-time statistics and time-series charts

#### USSD Interface
```
Location: src/server/src/modules/ussd/
Providers: Africa's Talking, AdvantaSMS
Session Timeout: 180 seconds
Languages: English, Swahili
```

**Menu Structure:**
```
*123# Main Menu
├── [1] Check Balance
│   └── Shows: Total Paid, Days Completed, Remaining
├── [2] Make Payment
│   ├── Deposit (1,048 KES) if not completed
│   └── Daily Payment (87 KES × 1/7/all days)
├── [3] Policy Status
│   └── Shows: Policy Number, Status, Expiry
└── [4] Help
    └── Support contacts
```

### 3.2 Backend Services (NestJS Modular Monolith)

```
Location: src/server/
Framework: NestJS 10+ with TypeScript
Architecture: Modular Monolith (12 feature modules)
API Style: RESTful with OpenAPI documentation
```

#### Module Inventory

| Module | Responsibility | Key Entities |
|--------|---------------|--------------|
| **Identity** | Authentication, authorization, user management | User, OTP, Session |
| **Payment** | M-Pesa integration, wallet management, transactions | Wallet, Transaction, PaymentRequest |
| **Policy** | Policy lifecycle, batch processing, PDF generation | Policy, PolicyDocument, PolicyBatch, PolicyTerms |
| **Notification** | SMS, WhatsApp, Email delivery with failover | Notification, NotificationTemplate, NotificationPreference |
| **KYC** | Document upload, validation, review workflow | Document, KycValidation |
| **Organization** | KBA/SACCO hierarchy, membership management | Organization, Membership, Geography |
| **Reporting** | Dashboards, report generation, exports | ReportDefinition, GeneratedReport |
| **Scheduler** | Job scheduling, batch triggers, cron management | Job, JobHistory |
| **Queue** | Async job processing with BullMQ | NotificationProcessor, PolicyProcessor, ReportProcessor |
| **Audit** | Immutable event logging, breach management | AuditEvent, BreachIncident |
| **Storage** | Multi-provider object storage abstraction | AWS S3, GCP, Azure, Local providers |
| **USSD** | USSD session management, menu navigation | UssdSession (in-memory) |

### 3.3 Data Stores

#### PostgreSQL (Primary Database)
```
Version: 15-alpine
Extensions: uuid-ossp, pgcrypto
Connection Pool: 10 (dev), configurable (prod)
SSL: Optional in dev, required in prod
```

**Key Tables (32 total):**
- Identity: `users`, `otps`, `sessions`
- Organization: `organizations`, `memberships`, `geography`
- KYC: `documents`, `kyc_validations`
- Payment: `wallets`, `transactions`, `payment_requests`
- Policy: `policies`, `policy_documents`, `policy_batches`, `policy_terms`, `policy_terms_acknowledgments`
- Notification: `notification_templates`, `notifications`, `notification_preferences`
- Reporting: `report_definitions`, `generated_reports`
- Scheduler: `jobs`, `job_history`
- Audit: `audit_events`, `breach_incidents`

#### Redis (Cache & Queues)
```
Version: 7-alpine
Persistence: AOF (Append-Only File)
Use Cases: Sessions, rate limiting, BullMQ job queues
```

**Queue Configuration:**
| Queue | Concurrency | Retries | Backoff |
|-------|-------------|---------|---------|
| notification | 5 | 5 | 1000ms exponential |
| policy | 3 | 3 | 5000ms exponential |
| report | 2 | 2 | 10000ms exponential |

#### MinIO/S3 (Object Storage)
```
Development: MinIO (S3-compatible)
Production: AWS S3, GCP Storage, or Azure Blob
```

**Buckets:**
- `kyc-documents` - KYC document images (National ID, License, etc.)
- `policy-documents` - Generated policy certificate PDFs
- `claim-documents` - Claim-related documents

### 3.4 External Integrations

#### M-Pesa (Safaricom Daraja API)
```
Environment: Sandbox (dev), Production (prod)
Features: STK Push, B2C (refunds), Callback processing
Timeout: 120 seconds for STK Push
```

**Endpoints Used:**
- `/oauth/v1/generate` - OAuth token
- `/mpesa/stkpush/v1/processrequest` - Initiate payment
- `/mpesa/stkpushquery/v1/query` - Check payment status
- `/mpesa/b2c/v3/paymentrequest` - Refunds/disbursements

#### SMS Providers
```
Primary: Africa's Talking
Fallback: AdvantaSMS
Failover: Automatic with health monitoring
Rate Limit: 100 messages/minute
```

#### WhatsApp Business API
```
Provider: Meta Graph API (v18.0)
Use Cases: Policy delivery, payment confirmations, reminders
Templates: Pre-approved message templates
```

### 3.5 Infrastructure

#### Development Environment
```yaml
Services:
  - PostgreSQL 15
  - Redis 7
  - MinIO (S3-compatible)
  - MailHog (email testing)
  - Optional: pgAdmin, Redis Commander

Hot Reload: Enabled for both server and client
Volumes: Bind mounts for source code
```

#### Production Environment
```yaml
Services:
  - PostgreSQL 15 (localhost only)
  - Redis 7 (localhost only, with password)
  - MinIO/S3 (localhost only)
  - Nginx (SSL termination, rate limiting)
  - API (multi-stage Docker build, non-root user)

Security:
  - All internal services bind to 127.0.0.1
  - External access only through Nginx
  - TLS 1.2+ with modern ciphers
  - HSTS enabled (2-year max-age)
```

---

## 4. Component Responsibilities and Interactions

### 4.1 Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CommonModule (Global)                          │
│  HttpExceptionFilter, LoggingInterceptor, TransformInterceptor,         │
│  EncryptionService                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Identity    │◄────────│   Payment     │────────►│    Policy     │
│   Module      │         │   Module      │         │    Module     │
│               │         │               │         │               │
│ - Auth        │         │ - M-Pesa      │         │ - Batch Proc  │
│ - OTP         │         │ - Wallet      │         │ - PDF Gen     │
│ - Session     │         │ - Transaction │         │ - Terms       │
│ - User        │         │               │         │               │
└───────┬───────┘         └───────┬───────┘         └───────┬───────┘
        │                         │                         │
        │         ┌───────────────┼───────────────┐         │
        │         │               │               │         │
        ▼         ▼               ▼               ▼         ▼
┌───────────────────────────────────────────────────────────────┐
│                     Notification Module                        │
│  SMS (Africa's Talking, AdvantaSMS), WhatsApp, Email           │
│  Multi-provider failover, templates, user preferences          │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                        Queue Module                            │
│  BullMQ processors for async: notifications, policies, reports │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                       Scheduler Module                         │
│  Cron jobs: 3x daily batch, reminders, cleanup, health checks  │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                        Audit Module                            │
│  Immutable event log, breach detection, DPA compliance         │
└───────────────────────────────────────────────────────────────┘

Supporting Modules:
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    KYC      │  │Organization │  │  Reporting  │  │   Storage   │
│   Module    │  │   Module    │  │   Module    │  │   Module    │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### 4.2 Key Inter-Module Interactions

#### Authentication Flow (Identity Module)
```
User                 AuthController          AuthService          OtpService           SmsService
  │                       │                      │                    │                    │
  │  POST /auth/login     │                      │                    │                    │
  │──────────────────────►│                      │                    │                    │
  │                       │  login(phone)        │                    │                    │
  │                       │─────────────────────►│                    │                    │
  │                       │                      │  generateOtp()     │                    │
  │                       │                      │───────────────────►│                    │
  │                       │                      │                    │  send(OTP)         │
  │                       │                      │                    │───────────────────►│
  │                       │                      │◄───────────────────│                    │
  │◄──────────────────────│◄─────────────────────│                    │                    │
  │  {status: OTP_SENT}   │                      │                    │                    │
```

#### Payment Flow (Payment → Policy Integration)
```
User              PaymentController    PaymentService      MpesaService     PolicyService
  │                    │                    │                  │                 │
  │  POST /deposit     │                    │                  │                 │
  │───────────────────►│                    │                  │                 │
  │                    │  initiatePayment() │                  │                 │
  │                    │───────────────────►│                  │                 │
  │                    │                    │  stkPush()       │                 │
  │                    │                    │─────────────────►│                 │
  │                    │                    │◄─────────────────│                 │
  │◄───────────────────│◄───────────────────│                  │                 │
  │  {checkoutRequestId}                    │                  │                 │
  │                    │                    │                  │                 │
  │  (User enters PIN on phone)             │                  │                 │
  │                    │                    │                  │                 │
  │  M-Pesa Callback   │                    │                  │                 │
  │───────────────────►│                    │                  │                 │
  │                    │  processCallback() │                  │                 │
  │                    │───────────────────►│                  │                 │
  │                    │                    │  updateWallet()  │                 │
  │                    │                    │──────────────────┤                 │
  │                    │                    │                  │                 │
  │                    │                    │  queuePolicy()   │                 │
  │                    │                    │─────────────────────────────────────►│
  │◄───────────────────│◄───────────────────│                  │                 │
  │  {triggeredPolicy: POLICY_1}            │                  │                 │
```

#### Batch Processing Flow (Scheduler → Policy → Notification)
```
Cron Trigger         BatchScheduler      PolicyBatchService     NotificationService
     │                    │                     │                       │
     │  08:00 EAT         │                     │                       │
     │───────────────────►│                     │                       │
     │                    │  handleBatch1()     │                       │
     │                    │────────────────────►│                       │
     │                    │                     │  processBatch()       │
     │                    │                     │───────────────────────┤
     │                    │                     │  For each policy:     │
     │                    │                     │  - Generate PDF       │
     │                    │                     │  - Update status      │
     │                    │                     │                       │
     │                    │                     │  sendPolicyIssued()   │
     │                    │                     │──────────────────────►│
     │                    │                     │                       │ SMS/WhatsApp
     │                    │◄────────────────────│                       │
     │◄───────────────────│                     │                       │
     │  Batch complete    │                     │                       │
```

---

## 5. Data Flow

### 5.1 User Registration & KYC Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    USER REGISTRATION & KYC FLOW                       │
└──────────────────────────────────────────────────────────────────────┘

1. REGISTRATION
   ┌────────┐     POST /auth/register      ┌──────────┐
   │  User  │ ─────────────────────────────► Identity │
   │        │  {phone, termsAccepted}      │  Module  │
   └────────┘                              └────┬─────┘
                                                │
                                           Creates User (PENDING)
                                           Generates OTP
                                                │
                                                ▼
                                          ┌──────────────┐
                                          │ Notification │──► SMS with OTP
                                          │    Module    │
                                          └──────────────┘

2. OTP VERIFICATION
   ┌────────┐    POST /auth/otp/verify     ┌──────────┐
   │  User  │ ─────────────────────────────► Identity │
   │        │   {phone, otp}               │  Module  │
   └────────┘                              └────┬─────┘
                                                │
                                           Validates OTP
                                           Activates User
                                           Creates Session
                                                │
                                                ▼
                                          Returns JWT + Refresh Token

3. KYC DOCUMENT UPLOAD (6 documents required)
   ┌────────┐    POST /kyc/documents       ┌──────────┐     ┌──────────┐
   │  User  │ ─────────────────────────────►   KYC    │────► Storage  │
   │        │   {file, documentType}       │  Module  │     │  Module  │
   └────────┘                              └────┬─────┘     └──────────┘
                                                │              │
                                           Validates file   Stores in S3
                                           Creates record   Returns URL
                                                │
                                                ▼
                                          KYC Status: IN_REVIEW

4. KYC ADMIN REVIEW
   ┌────────┐   PATCH /kyc/admin/:id/review  ┌──────────┐
   │ Admin  │ ───────────────────────────────►   KYC    │
   │        │   {status: APPROVED/REJECTED}  │  Module  │
   └────────┘                                └────┬─────┘
                                                  │
                                             Updates Document
                                             Updates User KYC Status
                                                  │
                                                  ▼
                                            KYC Status: APPROVED
                                            (User can now make payments)
```

### 5.2 Payment & Policy Issuance Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PAYMENT & POLICY ISSUANCE FLOW                     │
└──────────────────────────────────────────────────────────────────────┘

1. DEPOSIT PAYMENT (Policy 1 Trigger)
   ┌────────┐    POST /payments/deposit    ┌──────────┐     ┌──────────┐
   │  User  │ ─────────────────────────────► Payment  │────►  M-Pesa  │
   │        │   {phone, idempotencyKey}    │  Module  │     │  (STK)   │
   └────────┘                              └────┬─────┘     └──────────┘
                                                │
   ┌────────┐                              User enters PIN
   │ Phone  │◄──── M-Pesa STK Push ────────────│
   └────────┘                                   │
                                                ▼
                                          M-Pesa Callback
                                                │
                                                ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  PaymentService.processCallback()                              │
   │  ├─ Lock wallet (pessimistic write)                           │
   │  ├─ Create Transaction (COMPLETED)                             │
   │  ├─ Update Wallet (balance += 1,048 KES, depositCompleted)    │
   │  ├─ Trigger POLICY_1 creation                                  │
   │  └─ Queue notification                                         │
   └────────────────────────────────────────────────────────────────┘

2. BATCH PROCESSING (3x Daily: 08:00, 14:00, 20:00 EAT)
   ┌────────────┐                           ┌──────────┐
   │ Scheduler  │ ───── CRON Trigger ──────► Policy   │
   │  Module    │                           │  Module  │
   └────────────┘                           └────┬─────┘
                                                 │
   ┌────────────────────────────────────────────────────────────────┐
   │  BatchProcessingService.processBatch()                         │
   │  ├─ Find PENDING_ISSUANCE policies in payment window          │
   │  ├─ For each policy:                                           │
   │  │   ├─ Generate policy number (BDA-YYMM-NNNNNN)              │
   │  │   ├─ Calculate coverage dates                               │
   │  │   ├─ Generate PDF certificate                               │
   │  │   ├─ Store PDF in S3                                        │
   │  │   ├─ Update status to ACTIVE                                │
   │  │   └─ Queue notification (SMS/WhatsApp with PDF)             │
   │  └─ Update batch statistics                                    │
   └────────────────────────────────────────────────────────────────┘

3. DAILY PAYMENTS (Policy 2 Trigger after 30 payments)
   ┌────────┐     POST /payments/daily     ┌──────────┐
   │  User  │ ─────────────────────────────► Payment  │
   │        │   {phone, daysCount: 1-30}   │  Module  │
   └────────┘                              └────┬─────┘
                                                │
                                          Same M-Pesa flow
                                                │
   ┌────────────────────────────────────────────────────────────────┐
   │  On 30th Daily Payment:                                        │
   │  ├─ dailyPaymentsCompleted = true                             │
   │  ├─ Trigger POLICY_2 creation (11-month)                      │
   │  └─ Total coverage: 12 months                                  │
   └────────────────────────────────────────────────────────────────┘
```

### 5.3 Notification Delivery Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION DELIVERY FLOW                         │
└──────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │ NotificationService│
                        │     .send()       │
                        └────────┬─────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
    ┌───────────┐         ┌───────────┐         ┌───────────┐
    │    SMS    │         │ WhatsApp  │         │   Email   │
    │  Channel  │         │  Channel  │         │  Channel  │
    └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│SmsOrchestrator  │     │WhatsAppService│     │ EmailService  │
│   Service       │     │               │     │               │
└────────┬────────┘     └───────┬───────┘     └───────┬───────┘
         │                      │                     │
    ┌────┴────┐                 │                     │
    │         │                 │                     │
    ▼         ▼                 ▼                     ▼
┌────────┐ ┌────────┐    ┌──────────┐          ┌──────────┐
│Africa's│ │Advanta │    │Meta Graph│          │   SMTP   │
│Talking │ │  SMS   │    │   API    │          │ (MailHog)│
│ (Primary)│(Fallback)│   │          │          │          │
└────────┘ └────────┘    └──────────┘          └──────────┘

Failover Strategy:
┌─────────────────────────────────────────────────────────────┐
│ 1. Try Primary Provider (Africa's Talking)                  │
│ 2. On failure: Retry with exponential backoff (3 attempts)  │
│ 3. Still failing: Switch to Fallback (AdvantaSMS)           │
│ 4. Health check every minute; auto-swap if primary unhealthy│
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Security, Authentication, and Authorization

### 6.1 Authentication Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION MECHANISMS                          │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  RIDERS (End Users)                                                 │
│  ─────────────────                                                  │
│  Method: OTP-based (phone + 6-digit code)                           │
│  Token: JWT with RS256/HS256 signing                                │
│  Session: 30 days (mobile), 30 minutes idle (web)                   │
│  Rate Limit: 3 OTP requests/hour, 5 verification attempts/OTP      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ADMINISTRATORS                                                     │
│  ──────────────                                                     │
│  Method: Username + Password (bcrypt hashed)                        │
│  Token: JWT with RS256/HS256 signing                                │
│  Session: 30 minutes idle timeout                                   │
│  Lockout: 5 failed attempts → 30-minute lock                        │
│  Roles: PLATFORM_ADMIN, INSURANCE_ADMIN, KBA_ADMIN, SACCO_ADMIN    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  USSD SESSIONS                                                      │
│  ─────────────                                                      │
│  Method: Phone number verification via USSD gateway                 │
│  Session: 180 seconds (3 minutes) - in-memory storage              │
│  State Machine: Menu-driven navigation                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Authorization (RBAC)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ROLE HIERARCHY                                │
└──────────────────────────────────────────────────────────────────────┘

PLATFORM_ADMIN (Highest)
    │
    ├── Full system access
    ├── User management
    ├── Organization management
    ├── KYC review
    ├── Report generation
    ├── Settings management
    ├── Breach management
    │
    ▼
INSURANCE_ADMIN
    │
    ├── KYC review
    ├── Policy management
    ├── Report generation
    ├── User lookup
    │
    ▼
KBA_ADMIN (Umbrella Body)
    │
    ├── Organization management (own umbrella)
    ├── Member management
    ├── Reports (scoped to umbrella)
    │
    ▼
SACCO_ADMIN
    │
    ├── Member management (own SACCO)
    ├── Reports (scoped to SACCO)
    │
    ▼
RIDER (Lowest)
    │
    ├── Profile management
    ├── Payment operations
    ├── Policy viewing
    └── KYC document upload
```

### 6.3 Data Protection & PII Handling

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PII CLASSIFICATION & HANDLING                      │
└──────────────────────────────────────────────────────────────────────┘

HIGH Classification (Encrypted at rest, masked in logs):
├── national_id: Shows last 4 only (***1234)
├── kra_pin: Shows last 4 only
└── Encryption: AES-256 via EncryptedColumnTransformer

MEDIUM Classification (Encrypted at rest, partially masked):
├── phone: Shows first 4 + last 3 (0712***678)
├── email: Shows first 3 + domain
├── full_name: First name + initial
└── date_of_birth: Year only in logs

LOW Classification (No special handling):
├── policy_number
├── transaction_id
└── organization_code

┌──────────────────────────────────────────────────────────────────────┐
│  AUDIT TRAIL REQUIREMENTS (Kenya DPA 2019)                           │
├──────────────────────────────────────────────────────────────────────┤
│  • All authentication events logged                                  │
│  • All payment transactions logged                                   │
│  • All PII access logged                                             │
│  • Logs immutable (audit_events table has no UPDATE/DELETE)         │
│  • Retention: 7 years                                                │
│  • Breach notification: 72 hours to Data Commissioner               │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 Security Controls

```
┌──────────────────────────────────────────────────────────────────────┐
│                       SECURITY CONTROLS                               │
└──────────────────────────────────────────────────────────────────────┘

TRANSPORT SECURITY
├── TLS 1.2+ required (1.3 preferred)
├── Modern cipher suites (ECDHE-based)
├── HSTS enabled (2-year max-age)
├── HTTP → HTTPS redirect

API SECURITY
├── Rate limiting: 100 req/s general, 10 req/min auth endpoints
├── Request validation: class-validator + Zod
├── SQL injection: TypeORM parameterized queries
├── XSS: Content-Security-Policy headers
├── CORS: Whitelist-based origin control

PAYMENT SECURITY
├── Idempotency keys for all payment operations
├── Pessimistic database locking for wallet updates
├── M-Pesa callback signature validation
├── No card numbers stored (M-Pesa only)

SESSION SECURITY
├── Refresh tokens: SHA-256 hashed before storage
├── OTP codes: SHA-256 hashed before storage
├── Session revocation support (per-session and all-sessions)
├── Idle timeout enforcement for web sessions
```

---

## 7. Deployment Topology

### 7.1 Development Environment

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT ENVIRONMENT                            │
│                    (docker/dev/docker-compose.yml)                    │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Host (Developer Machine)              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   bodainsure-dev-network                      │   │
│  │                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │ PostgreSQL  │  │    Redis    │  │       MinIO         │   │   │
│  │  │   :5432     │  │    :6379    │  │  :9000 (S3)         │   │   │
│  │  │             │  │             │  │  :9001 (Console)    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │   │
│  │                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │   Server    │  │   Client    │  │      MailHog        │   │   │
│  │  │   :3000     │  │   :5173     │  │  :1025 (SMTP)       │   │   │
│  │  │ (Hot Reload)│  │ (Hot Reload)│  │  :8025 (UI)         │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │   │
│  │                                                                │   │
│  │  Optional (--profile tools):                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐                             │   │
│  │  │  pgAdmin    │  │Redis Cmdr  │                              │   │
│  │  │   :8080     │  │   :8081     │                             │   │
│  │  └─────────────┘  └─────────────┘                             │   │
│  │                                                                │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Host Volume Mounts (Hot Reload):                                    │
│  ├── src/server/src → /app/src                                       │
│  ├── src/client/src → /app/src                                       │
│  └── Named volumes for node_modules (isolated)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Access URLs:
├── API:         http://localhost:3000/api/v1
├── Admin Portal: http://localhost:5173
├── MinIO Console: http://localhost:9001
├── MailHog:      http://localhost:8025
├── pgAdmin:      http://localhost:8080 (optional)
└── Redis Cmdr:   http://localhost:8081 (optional)
```

### 7.2 Production Environment

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                             │
│                    (docker/prod/docker-compose.yml)                   │
└──────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │    Internet     │
                              │  (Users/Admin)  │
                              └────────┬────────┘
                                       │
                            Port 80 (redirect)
                            Port 443 (HTTPS)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Production Host                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                         Nginx                                   │ │
│  │              (bodainsure-nginx-prod:80,443)                     │ │
│  │                                                                  │ │
│  │  Features:                                                       │ │
│  │  ├── SSL Termination (TLS 1.2+)                                │ │
│  │  ├── Rate Limiting (100 r/s API, 10 r/min auth)                │ │
│  │  ├── Security Headers (HSTS, X-Frame-Options, etc.)            │ │
│  │  ├── Gzip Compression                                          │ │
│  │  └── Logging with timing metrics                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                       │                              │
│                              127.0.0.1:3000                          │
│                                       │                              │
│  ┌────────────────────────────────────▼─────────────────────────────┐│
│  │                   bodainsure-prod-network                        ││
│  │                                                                   ││
│  │  ┌─────────────────────────────────────────────────────────────┐ ││
│  │  │                     API Server                               │ ││
│  │  │            (bodainsure-api-prod:3000)                        │ ││
│  │  │                                                               │ ││
│  │  │  ├── Multi-stage Docker build (optimized)                   │ ││
│  │  │  ├── Non-root user (nestjs:1001)                            │ ││
│  │  │  ├── Health check: /api/v1/health                           │ ││
│  │  │  └── Resource limits: 2 CPU, 2GB RAM                        │ ││
│  │  └─────────────────────────────────────────────────────────────┘ ││
│  │                             │                                     ││
│  │         ┌───────────────────┼───────────────────┐                ││
│  │         │                   │                   │                ││
│  │         ▼                   ▼                   ▼                ││
│  │  ┌─────────────┐   ┌─────────────┐    ┌─────────────────┐       ││
│  │  │ PostgreSQL  │   │    Redis    │    │      MinIO      │       ││
│  │  │127.0.0.1:5432│  │127.0.0.1:6379│   │127.0.0.1:9000   │       ││
│  │  │             │   │ (password)  │    │                 │       ││
│  │  │ 2 CPU, 4GB  │   │ 1 CPU, 1GB  │    │ 1 CPU, 2GB      │       ││
│  │  └─────────────┘   └─────────────┘    └─────────────────┘       ││
│  │                                                                   ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  Firewall Rules:                                                     │
│  ├── Allow: 80, 443 (Nginx only)                                    │
│  └── Deny: All other inbound traffic                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Production Access:
├── API:          https://api.bodainsure.co.ke/api/v1
├── Admin Portal: https://admin.bodainsure.co.ke (separate deployment)
└── Internal:     Only via localhost binding
```

### 7.3 Resource Allocation

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION RESOURCE LIMITS                         │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────┬─────────────────┬─────────────────┬───────────────┐
│    Service      │   CPU Limit     │  Memory Limit   │  Reserved     │
├─────────────────┼─────────────────┼─────────────────┼───────────────┤
│ PostgreSQL      │      2 cores    │      4 GB       │ 1 CPU, 2 GB   │
│ Redis           │      1 core     │      1 GB       │ 0.5 CPU, 512MB│
│ API Server      │      2 cores    │      2 GB       │ 1 CPU, 1 GB   │
│ MinIO           │      1 core     │      2 GB       │ 0.5 CPU, 512MB│
│ Nginx           │      1 core     │    512 MB       │ 0.25 CPU,256MB│
├─────────────────┼─────────────────┼─────────────────┼───────────────┤
│ TOTAL           │    7 cores      │    9.5 GB       │ 3.25 CPU, 4GB │
└─────────────────┴─────────────────┴─────────────────┴───────────────┘

Recommended Host: 8 CPU cores, 16 GB RAM minimum
```

---

## 8. Technology Stack

### 8.1 Backend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime |
| **Framework** | NestJS | 10+ | Backend framework |
| **Language** | TypeScript | 5.7+ | Type safety |
| **ORM** | TypeORM | Latest | Database ORM |
| **Validation** | class-validator | Latest | DTO validation |
| **Queue** | BullMQ | Latest | Job processing |
| **PDF** | PDFKit | Latest | PDF generation |
| **HTTP** | Axios | 1.7+ | External API calls |

### 8.2 Frontend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | React | 19 | UI library |
| **Build Tool** | Vite | 6 | Development server & bundler |
| **Language** | TypeScript | 5.7+ | Type safety |
| **Routing** | React Router | 7 | Client-side routing |
| **State** | Zustand | 5 | Global state (auth) |
| **Server State** | React Query | 5 | Data fetching & caching |
| **Forms** | React Hook Form | 7 | Form management |
| **Validation** | Zod | 3 | Schema validation |
| **UI Components** | Shadcn/ui | Latest | Component library |
| **Styling** | Tailwind CSS | 3 | Utility-first CSS |
| **Charts** | Recharts | 2 | Data visualization |
| **Icons** | Lucide React | Latest | Icon library |

### 8.3 Infrastructure Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Database** | PostgreSQL | 15 | Primary data store |
| **Cache** | Redis | 7 | Sessions, queues, rate limiting |
| **Object Storage** | MinIO/S3 | Latest | Document storage |
| **Reverse Proxy** | Nginx | Alpine | SSL, rate limiting, load balancing |
| **Container** | Docker | Latest | Containerization |
| **Orchestration** | Docker Compose | 3.8 | Service orchestration |

### 8.4 External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| **Payments** | M-Pesa (Safaricom) | Mobile money payments |
| **SMS Primary** | Africa's Talking | SMS delivery |
| **SMS Fallback** | AdvantaSMS | SMS failover |
| **WhatsApp** | Meta Business API | WhatsApp messaging |
| **Email (Dev)** | MailHog | Email testing |
| **Email (Prod)** | SMTP Provider | Production email |

---

## Appendix A: Key Configuration Files

| File | Purpose |
|------|---------|
| `src/server/src/app.module.ts` | Main application module |
| `src/server/src/config/app.config.ts` | Application configuration |
| `src/server/src/config/database.config.ts` | Database configuration |
| `src/server/src/config/redis.config.ts` | Redis configuration |
| `docker/dev/docker-compose.yml` | Development environment |
| `docker/prod/docker-compose.yml` | Production environment |
| `docker/prod/nginx/nginx.conf` | Nginx configuration |
| `CLAUDE.md` | Project governance rules |

---

## Appendix B: API Endpoints Overview

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - Rider login (OTP)
- `POST /api/v1/auth/admin/login` - Admin login (password)
- `POST /api/v1/auth/otp/verify` - OTP verification
- `POST /api/v1/auth/token/refresh` - Token refresh
- `POST /api/v1/auth/logout` - Logout

### Payments
- `POST /api/v1/payments/deposit` - Initiate deposit
- `POST /api/v1/payments/daily` - Initiate daily payment
- `GET /api/v1/payments/status/:id` - Payment status
- `POST /api/v1/mpesa/callback` - M-Pesa callback

### Policies
- `GET /api/v1/policies` - User policies
- `GET /api/v1/policies/:id` - Policy details
- `GET /api/v1/policies/:id/document` - Download PDF

### KYC
- `POST /api/v1/kyc/documents` - Upload document
- `GET /api/v1/kyc/status` - KYC status
- `PATCH /api/v1/kyc/admin/:id/review` - Admin review

### Organizations
- `GET /api/v1/organizations` - List organizations
- `GET /api/v1/organizations/:id` - Organization details
- `GET /api/v1/memberships` - Memberships

### Reports
- `GET /api/v1/dashboard` - Dashboard metrics
- `POST /api/v1/reports/generate` - Generate report
- `GET /api/v1/reports/:id/download` - Download report

### USSD
- `POST /api/v1/ussd/africastalking` - Africa's Talking USSD
- `GET /api/v1/ussd/advantasms` - AdvantaSMS USSD

---

*This document provides a high-level architectural view of the BodaInsure platform. For detailed module-specific documentation, refer to the individual module architecture documents in this directory.*
