# CLAUDE.md — BodaInsure Implementation Governance

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Purpose:** Governance rules and guidelines for AI-assisted implementation of the BodaInsure platform  

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Core Principles](#2-core-principles)
3. [Implementation Phases](#3-implementation-phases)
4. [Architecture Rules](#4-architecture-rules)
5. [Code Standards](#5-code-standards)
6. [Security & Compliance Mandates](#6-security--compliance-mandates)
7. [Data Handling Rules](#7-data-handling-rules)
8. [Testing Requirements](#8-testing-requirements)
9. [Documentation Standards](#9-documentation-standards)
10. [Decision Framework](#10-decision-framework)
11. [Boundaries & Constraints](#11-boundaries--constraints)
12. [Gap Handling Protocol](#12-gap-handling-protocol)
13. [Communication Guidelines](#13-communication-guidelines)
14. [Reference Documents](#14-reference-documents)

---

## 1. Project Context

### 1.1 What is BodaInsure?

BodaInsure is a digital insurance platform enabling Kenya's 700,000+ bodaboda (motorcycle taxi) riders to access mandatory Third-Party Only (TPO) insurance through an affordable micropayment model.

### 1.2 Key Business Model

```
Traditional: 3,500 KES annual lump sum (unaffordable)
     ↓
BodaInsure Model:
  • Initial Deposit: 1,048 KES → 1-month policy issued
  • Daily Payments: 87 KES × 30 days → 11-month policy issued
  • Total: 3,658 KES (includes platform fee)
```

### 1.3 Stakeholder Ecosystem

| Entity | Role |
|--------|------|
| **Atronach K Ltd** | Platform owner/developer |
| **Robs Insurance Agency** | Insurance agent (JV partner) |
| **Definite Assurance Co.** | Underwriter |
| **Kenya Bodaboda Association (KBA)** | Launch client |
| **Bodaboda Riders** | End users (700,000+ target) |

### 1.4 Critical Success Metrics

- **Enrollment**: 700,000 users in Year 1
- **Policy Delivery**: Within 6 hours of payment
- **System Uptime**: 99.5%
- **Compliance**: 100% IRA and Data Protection Act adherence

---

## 2. Core Principles

### 2.1 Development Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUIDING PRINCIPLES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. USER-FIRST DESIGN                                          │
│     Build for low-literacy, feature-phone users first.         │
│     If it works on USSD, it works everywhere.                  │
│                                                                 │
│  2. FINANCIAL INTEGRITY                                        │
│     Every shilling must be accounted for.                      │
│     No payment can be lost, duplicated, or misattributed.      │
│                                                                 │
│  3. COMPLIANCE BY DEFAULT                                      │
│     Data protection and insurance regulations are not          │
│     afterthoughts—they're architectural requirements.          │
│                                                                 │
│  4. SIMPLICITY OVER CLEVERNESS                                 │
│     Readable, maintainable code beats elegant complexity.      │
│     The next developer should understand it in 5 minutes.      │
│                                                                 │
│  5. FAIL SAFE, NOT FAIL SILENT                                 │
│     Errors must be visible, logged, and recoverable.           │
│     Users must always know what happened.                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 The "Rider Test"

Before implementing any feature, ask:

> "Can a 35-year-old bodaboda rider in Nakuru with a basic Android phone 
> and intermittent 3G connectivity successfully use this feature?"

If no, redesign.

### 2.3 The "Audit Test"

Before deploying any financial or data-handling code, ask:

> "If the Insurance Regulatory Authority or Data Commissioner audits 
> this system tomorrow, can we demonstrate full compliance and traceability?"

If no, do not deploy.

---

## 3. Implementation Phases

### 3.1 Phase Overview

```
Phase 1 (MVP)          Phase 2               Phase 3
─────────────          ─────────             ─────────
Months 1-4             Months 5-8            Months 9-12
                       
• Core registration    • SACCO bulk tools    • Additional products
• KYC upload           • Advanced reporting  • Claims integration
• M-Pesa payments      • Underwriter API     • Multi-umbrella body
• Policy generation    • Offline mode        • Analytics platform
• USSD channel         • Commission tracking • API marketplace
• Basic dashboards     • Renewal automation
```

### 3.2 Phase 1 (MVP) Scope — LOCKED

The following features constitute the MVP and must be completed before any Phase 2 work begins:

| Module | MVP Features |
|--------|--------------|
| **Identity** | Phone registration, OTP verification, JWT auth, RBAC |
| **KYC** | Document capture, upload, validation, status tracking |
| **Payment** | M-Pesa STK Push, deposit, daily payment, wallet |
| **Policy** | Two-policy model, batch processing (3x daily), PDF delivery |
| **Organization** | KBA/SACCO hierarchy, basic member view |
| **Notification** | SMS OTP, payment reminders, policy delivery (WhatsApp) |
| **Reporting** | Enrollment dashboard, payment dashboard |
| **USSD** | Balance, payment, policy status |
| **Admin** | User lookup, basic support tools |

### 3.3 MVP Exit Criteria

- [ ] All P1 requirements from `requirements_specification.md` implemented
- [ ] All P1 features from `feature_specification.md` functional
- [ ] Security audit passed (zero critical/high findings)
- [ ] Load test passed (10,000 concurrent users)
- [ ] UAT signed off by Atronach, Robs, and KBA representatives
- [ ] IRA and Data Commissioner compliance confirmed

### 3.4 Feature Freeze Rules

1. **No new features** after MVP scope lock without written approval from Product Owner
2. **Bug fixes** always allowed
3. **Security patches** always required
4. **Performance improvements** allowed if they don't change interfaces
5. **Scope changes** require impact assessment on timeline and resources

---

## 4. Architecture Rules

### 4.1 Architectural Style

```
MANDATED: Modular Monolith (Phase 1)
          ↓
FUTURE:   Microservices extraction as scale demands (Phase 3+)
```

**Rationale**: Speed of development and operational simplicity for MVP. Clear module boundaries enable future extraction.

### 4.2 Module Boundaries — ENFORCED

Each module owns its:
- **Data**: No direct database access across modules
- **API**: All inter-module communication via defined interfaces
- **Logic**: Business rules encapsulated within module

```
CORRECT:
┌──────────────┐     API Call      ┌──────────────┐
│   Payment    │ ─────────────────▶│    Policy    │
│   Module     │  POST /policies   │    Module    │
└──────────────┘                   └──────────────┘

INCORRECT:
┌──────────────┐   Direct DB Query  ┌──────────────┐
│   Payment    │ ──────────────────▶│   policies   │
│   Module     │   SELECT * FROM    │    table     │
└──────────────┘                    └──────────────┘
```

### 4.3 Module Inventory

| Module | Owner Responsibility | Database Tables |
|--------|---------------------|-----------------|
| **identity** | Auth, sessions, RBAC | users, roles, sessions, otps |
| **kyc** | Documents, verification | documents, kyc_status, validations |
| **payment** | Transactions, wallet | wallets, transactions, payment_requests |
| **policy** | Policy lifecycle | policies, policy_documents, batches |
| **organization** | Hierarchy, membership | organizations, memberships, geography |
| **notification** | All outbound comms | notifications, templates, preferences |
| **reporting** | Dashboards, exports | report_definitions, generated_reports |
| **scheduler** | Cron jobs, batch triggers | jobs, job_history |
| **audit** | Immutable event log | audit_events |

### 4.4 API Design Rules

1. **RESTful conventions**: Use standard HTTP methods and status codes
2. **Versioning**: All APIs prefixed with `/api/v1/`
3. **Naming**: Use kebab-case for URLs (`/payment-requests`, not `/paymentRequests`)
4. **Pagination**: All list endpoints support `page` and `limit` parameters
5. **Filtering**: Use query parameters for filtering (`?status=active`)
6. **Errors**: Consistent error response format (see below)

```json
// Standard Error Response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone number is invalid",
    "details": [
      {
        "field": "phone",
        "message": "Must be 10 digits starting with 07 or 01"
      }
    ],
    "request_id": "uuid"
  }
}
```

### 4.5 Technology Stack — LOCKED

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | Async I/O, ecosystem |
| **Framework** | NestJS | Latest | TypeScript, structure, OpenAPI |
| **Database** | PostgreSQL | 15+ | ACID, JSON, proven |
| **Cache** | Redis | 7+ | Sessions, rate limiting |
| **Queue** | BullMQ (Redis) | Latest | Job processing |
| **Storage** | S3-compatible | - | Documents |
| **Container** | Docker | Latest | Standardization |
| **Orchestration** | Kubernetes | 1.28+ | Scaling |

**Deviation from stack requires written justification and approval.**

### 4.6 Dependency Rules

1. **No new npm packages** without security audit (`npm audit`)
2. **Prefer well-maintained packages** (>1000 GitHub stars, recent commits)
3. **Pin exact versions** in `package.json` (no `^` or `~`)
4. **Document why** each dependency is needed in `DEPENDENCIES.md`
5. **Review licenses** — no GPL in production code

---

## 5. Code Standards

### 5.1 Language & Style

```typescript
// ENFORCED: TypeScript strict mode
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 5.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `payment-service.ts` |
| Classes | PascalCase | `PaymentService` |
| Interfaces | PascalCase with `I` prefix | `IPaymentRequest` |
| Functions | camelCase | `processPayment()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Database tables | snake_case | `payment_requests` |
| API endpoints | kebab-case | `/payment-requests` |
| Environment vars | SCREAMING_SNAKE_CASE | `DATABASE_URL` |

### 5.3 File Structure

```
src/
├── modules/
│   ├── identity/
│   │   ├── controllers/
│   │   │   └── auth.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── otp.service.ts
│   │   ├── repositories/
│   │   │   └── user.repository.ts
│   │   ├── dto/
│   │   │   ├── register.dto.ts
│   │   │   └── login.dto.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── interfaces/
│   │   │   └── auth.interface.ts
│   │   └── identity.module.ts
│   ├── payment/
│   │   └── ... (same structure)
│   └── ... (other modules)
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── utils/
├── config/
├── database/
│   ├── migrations/
│   └── seeds/
└── main.ts
```

### 5.4 Code Quality Rules

1. **Functions**: Maximum 50 lines. If longer, extract.
2. **Files**: Maximum 300 lines. If longer, split.
3. **Nesting**: Maximum 3 levels deep. If deeper, refactor.
4. **Parameters**: Maximum 4 per function. If more, use object.
5. **Comments**: Code should be self-documenting. Comment *why*, not *what*.
6. **No magic numbers**: Use named constants.
7. **No `any` type**: Always define proper types.

```typescript
// BAD
function process(a: any, b: any, c: any, d: any, e: any) {
  if (a) {
    if (b) {
      if (c) {
        // 4 levels deep - too much
      }
    }
  }
}

// GOOD
interface ProcessOptions {
  userId: string;
  amount: number;
  currency: Currency;
  metadata: PaymentMetadata;
}

function processPayment(options: ProcessOptions): PaymentResult {
  if (!this.validateOptions(options)) {
    return PaymentResult.invalid();
  }
  return this.executePayment(options);
}
```

### 5.5 Git Workflow

```
main (protected)
  │
  └── develop (protected)
        │
        ├── feature/TICKET-123-user-registration
        ├── feature/TICKET-124-otp-verification
        ├── bugfix/TICKET-125-payment-timeout
        └── hotfix/TICKET-126-security-patch
```

**Branch Rules:**
- `main`: Production deployments only. Requires 2 approvals.
- `develop`: Integration branch. Requires 1 approval.
- `feature/*`: Individual features. Named with ticket number.
- `bugfix/*`: Non-critical fixes.
- `hotfix/*`: Critical production fixes. Can bypass `develop`.

**Commit Messages:**
```
type(scope): description

[optional body]

[optional footer]

Examples:
feat(payment): add M-Pesa STK push integration
fix(auth): resolve OTP expiration race condition
docs(readme): update deployment instructions
refactor(kyc): extract validation logic to service
test(payment): add integration tests for refunds
```

### 5.6 Code Review Requirements

All PRs must have:
- [ ] At least 1 approval (2 for `main`)
- [ ] All CI checks passing
- [ ] No decrease in test coverage
- [ ] No new linting errors
- [ ] Updated documentation if API changed
- [ ] Changelog entry for user-facing changes

---

## 6. Security & Compliance Mandates

### 6.1 Security Requirements — NON-NEGOTIABLE

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY MANDATES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔐 ENCRYPTION                                                  │
│     • All data at rest: AES-256                                │
│     • All data in transit: TLS 1.2+ (prefer 1.3)               │
│     • PII fields: Additional field-level encryption            │
│                                                                 │
│  🔑 AUTHENTICATION                                              │
│     • JWT tokens with RS256 signing                            │
│     • Tokens expire in 30 days (mobile), 30 min (web)          │
│     • OTP rate limiting: 3 requests/hour, 5 attempts/OTP       │
│                                                                 │
│  🛡️ AUTHORIZATION                                               │
│     • RBAC enforced at API gateway level                       │
│     • All endpoints require authentication except /auth/*      │
│     • Principle of least privilege for all roles               │
│                                                                 │
│  📝 AUDIT                                                       │
│     • All authentication events logged                         │
│     • All payment transactions logged                          │
│     • All PII access logged                                    │
│     • Logs immutable and retained 7 years                      │
│                                                                 │
│  🚫 FORBIDDEN                                                   │
│     • Storing plaintext passwords (OTP-only auth)              │
│     • Logging PII in plaintext                                 │
│     • Exposing stack traces to users                           │
│     • Using deprecated crypto algorithms                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 PII Classification

| Field | Classification | Encryption | Masking in Logs |
|-------|---------------|------------|-----------------|
| `national_id` | HIGH | Required | Show last 4 only |
| `kra_pin` | HIGH | Required | Show last 4 only |
| `phone_number` | MEDIUM | At rest | Show last 4 only |
| `full_name` | MEDIUM | At rest | First name + initial |
| `email` | MEDIUM | At rest | First 3 chars + domain |
| `date_of_birth` | MEDIUM | At rest | Year only |
| `policy_number` | LOW | At rest | Full (non-PII) |

### 6.3 Compliance Requirements

#### Data Protection Act 2019 (Kenya)

| Requirement | Implementation |
|-------------|---------------|
| Consent | Explicit consent captured at registration with timestamp |
| Right to Access | API endpoint for user to download all their data |
| Right to Correction | API endpoint for user to update profile |
| Right to Deletion | Soft delete with 30-day grace, then hard delete |
| Breach Notification | Automated alerting + 72-hour notification workflow |
| Data Minimization | Only collect fields specified in KYC requirements |

#### Insurance Regulatory Authority (IRA)

| Requirement | Implementation |
|-------------|---------------|
| Two-policy limit | System enforces max 2 TPO policies per vehicle per year |
| 30-day free look | Cancellation endpoint with full refund within 30 days |
| Policy terms disclosure | Terms displayed and acknowledged before payment |
| Commission transparency | Commission rates disclosed (when implemented) |

### 6.4 Security Testing Requirements

Before any production deployment:

1. **OWASP Top 10 scan** — Zero critical/high findings
2. **Dependency vulnerability scan** — Zero known vulnerabilities
3. **Penetration test** — Quarterly by approved vendor
4. **Code security review** — For all authentication/payment code

---

## 7. Data Handling Rules

### 7.1 Database Rules

1. **Migrations**: All schema changes via versioned migrations. No manual DDL.
2. **Indexes**: Create indexes for all foreign keys and frequently queried fields.
3. **Soft delete**: Use `deleted_at` timestamp, never hard delete user data.
4. **Timestamps**: All tables have `created_at` and `updated_at`.
5. **UUIDs**: Use UUIDv4 for all primary keys (not auto-increment).

```sql
-- Standard table template
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ... other columns
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_example_created_at ON example(created_at);
```

### 7.2 Transaction Rules

For payment and financial operations:

```typescript
// REQUIRED: Use database transactions for multi-step financial operations
async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
  return this.dataSource.transaction(async (manager) => {
    // 1. Create payment record
    const payment = await manager.save(Payment, { ...paymentData, status: 'PENDING' });
    
    // 2. Call M-Pesa (external)
    const mpesaResult = await this.mpesaService.stkPush(paymentData);
    
    // 3. Update payment with M-Pesa reference
    payment.mpesaRef = mpesaResult.checkoutRequestId;
    await manager.save(payment);
    
    // 4. Log audit event
    await manager.save(AuditEvent, {
      eventType: 'PAYMENT_INITIATED',
      entityId: payment.id,
      // ...
    });
    
    return payment;
  });
}
```

### 7.3 Idempotency Rules

All payment endpoints must be idempotent:

```typescript
// REQUIRED: Idempotency key for payment operations
@Post('payments')
async createPayment(
  @Headers('Idempotency-Key') idempotencyKey: string,
  @Body() paymentDto: CreatePaymentDto
): Promise<PaymentResult> {
  // Check for existing transaction with same idempotency key
  const existing = await this.paymentService.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    return existing; // Return cached result
  }
  
  // Process new payment
  return this.paymentService.create(paymentDto, idempotencyKey);
}
```

### 7.4 Data Retention

| Data Type | Retention | After Retention |
|-----------|-----------|-----------------|
| User accounts | Account lifetime + 7 years | Anonymize |
| KYC documents | Account lifetime + 7 years | Delete |
| Transactions | 7 years | Archive |
| Policies | 7 years after expiry | Archive |
| Audit logs | 7 years | Archive (immutable) |
| Session logs | 90 days | Delete |
| OTP records | 24 hours | Delete |

---

## 8. Testing Requirements

### 8.1 Test Coverage Minimums

| Test Type | Coverage | Enforcement |
|-----------|----------|-------------|
| Unit tests | 80% line coverage | CI blocks merge if below |
| Integration tests | All API endpoints | CI blocks merge if missing |
| E2E tests | Critical user journeys | Required for release |

### 8.2 Critical Test Scenarios — MANDATORY

These scenarios must have automated tests before MVP:

#### Authentication
- [ ] Registration with valid phone
- [ ] Registration with duplicate phone (should fail)
- [ ] OTP verification success
- [ ] OTP verification failure (wrong code)
- [ ] OTP expiration handling
- [ ] Rate limiting enforcement

#### Payments
- [ ] Deposit payment success flow
- [ ] Deposit payment failure handling
- [ ] Daily payment success flow
- [ ] Multiple days payment
- [ ] Payment idempotency
- [ ] M-Pesa callback processing
- [ ] Wallet balance accuracy

#### Policy
- [ ] Policy 1 generation on deposit
- [ ] Policy 2 generation on 30th payment
- [ ] Batch processing execution
- [ ] Policy status transitions
- [ ] Two-policy limit enforcement

### 8.3 Test Environment Rules

1. **Never test with production data**
2. **Use realistic synthetic data** (Kenya names, phone formats)
3. **Mock external services** (M-Pesa, SMS) in unit/integration tests
4. **Sandbox environments** for M-Pesa in E2E tests
5. **Isolated databases** per test run

### 8.4 Performance Testing

Before production launch:

| Scenario | Target | Tool |
|----------|--------|------|
| API response time | p95 < 500ms | k6, Artillery |
| USSD response time | p95 < 2s | Custom script |
| Concurrent users | 10,000 | k6 |
| Payment throughput | 100 TPS | k6 |
| Batch processing | <30 min for 10K policies | Timing logs |

---

## 9. Documentation Standards

### 9.1 Required Documentation

| Document | Location | Update Frequency |
|----------|----------|------------------|
| API specification | `/docs/api/openapi.yaml` | Every API change |
| Database schema | `/docs/database/schema.md` | Every migration |
| Architecture decisions | `/docs/adr/` | Each significant decision |
| Deployment guide | `/docs/deployment/` | Each environment change |
| Runbook | `/docs/runbook/` | Each new alert/procedure |

### 9.2 Architecture Decision Records (ADRs)

For any significant technical decision, create an ADR:

```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need a primary database for the BodaInsure platform that supports...

## Decision
We will use PostgreSQL 15 because...

## Consequences
- Positive: ACID compliance, JSON support...
- Negative: Requires PostgreSQL expertise...
```

### 9.3 Code Documentation

```typescript
/**
 * Processes an M-Pesa STK push payment request.
 * 
 * @description Initiates a payment request to the user's phone via M-Pesa STK Push.
 * The user will receive a prompt on their phone to enter their M-Pesa PIN.
 * 
 * @param {CreatePaymentDto} paymentDto - Payment details including amount and phone
 * @param {string} idempotencyKey - Unique key to prevent duplicate processing
 * @returns {Promise<PaymentResult>} The payment result with transaction reference
 * 
 * @throws {InsufficientBalanceError} If user's M-Pesa balance is insufficient
 * @throws {PaymentTimeoutError} If payment is not completed within 120 seconds
 * @throws {DuplicatePaymentError} If idempotency key already exists
 * 
 * @example
 * const result = await paymentService.processPayment(
 *   { amount: 87, phone: '+254712345678', type: 'DAILY' },
 *   'unique-request-id-123'
 * );
 */
async processPayment(
  paymentDto: CreatePaymentDto,
  idempotencyKey: string
): Promise<PaymentResult> {
  // Implementation
}
```

---

## 10. Decision Framework

### 10.1 When to Escalate

| Situation | Action |
|-----------|--------|
| Security vulnerability discovered | Immediate escalation to Tech Lead |
| Scope change requested | Escalate to Product Owner |
| Dependency on unavailable external system | Escalate to Project Manager |
| Performance target cannot be met | Escalate to Tech Lead with alternatives |
| Compliance requirement unclear | Escalate to Legal/Compliance |

### 10.2 Technical Decision Authority

| Decision Type | Authority |
|---------------|-----------|
| Bug fix approach | Developer |
| Code structure within module | Developer |
| New dependency addition | Tech Lead approval |
| API contract change | Tech Lead + Product Owner |
| Architecture change | Architecture Review Board |
| Technology stack change | CTO approval |

### 10.3 Trade-off Guidelines

When facing trade-offs, prioritize in this order:

```
1. SECURITY & COMPLIANCE
   ↓ Never compromise
2. DATA INTEGRITY
   ↓ Financial accuracy is critical
3. USER EXPERIENCE
   ↓ Riders depend on this for livelihood
4. PERFORMANCE
   ↓ Within defined SLAs
5. DEVELOPER EXPERIENCE
   ↓ Maintainability matters
6. COST
   ↓ Optimize where possible
```

---

## 11. Boundaries & Constraints

### 11.1 What This Project IS

- ✅ A digital insurance distribution platform
- ✅ A micropayment collection system
- ✅ A policy lifecycle management tool
- ✅ A multi-channel access platform (app, USSD, web)
- ✅ A SACCO/KBA management dashboard

### 11.2 What This Project IS NOT

- ❌ An insurance underwriting system (Definite Assurance handles this)
- ❌ A claims processing system (underwriter responsibility)
- ❌ A general-purpose payment platform
- ❌ A loan or credit product
- ❌ A SACCO management replacement system

### 11.3 Integration Boundaries

| System | Our Responsibility | Their Responsibility |
|--------|-------------------|----------------------|
| **M-Pesa** | Initiate payments, process callbacks | Transaction processing, user authentication |
| **Definite Assurance** | Send policy requests, receive confirmations | Underwriting, policy issuance, claims |
| **SMS Gateway** | Send messages via API | Message delivery |
| **WhatsApp** | Send templates via API | Message delivery |

### 11.4 Hard Constraints

1. **No storing card numbers** — M-Pesa only
2. **No direct bank integrations** — Out of scope for MVP
3. **No claims processing** — Redirect to underwriter
4. **No loan products** — Not a lending platform
5. **Kenya only** — No multi-country support in Phase 1

---

## 12. Gap Handling Protocol

### 12.1 Known Gaps from Requirements

These items are identified as gaps and must be resolved before implementation:

| Gap | Required Action | Blocker Level |
|-----|----------------|---------------|
| USSD shortcode number | Confirm with telco | Blocks USSD development |
| M-Pesa credentials | Obtain from Safaricom | Blocks payment integration |
| Grace period rules | Business decision needed | Blocks lapse logic |
| Commission calculation | Business terms needed | Can defer to Phase 2 |
| Claims workflow | Underwriter input needed | Out of MVP scope |
| Underwriter API spec | Awaiting from Definite | Blocks Phase 2 |

### 12.2 Handling Undefined Requirements

When encountering undefined requirements:

```
Step 1: Check documentation
        ↓
        Found? → Implement as documented
        ↓
        Not found?
        ↓
Step 2: Check similar features
        ↓
        Pattern exists? → Follow established pattern
        ↓
        No pattern?
        ↓
Step 3: Make reasonable assumption
        ↓
        Document assumption in code comment
        ↓
        Flag for Product Owner review
        ↓
Step 4: Implement with feature flag (if risky)
```

### 12.3 Assumption Documentation

All assumptions must be documented:

```typescript
/**
 * ASSUMPTION: Grace period is 7 days after 1-month policy expiry.
 * SOURCE: Product discussion 2024-12-01 (not formally documented)
 * TICKET: BODA-234 - Confirm grace period rules
 * RISK: Medium - affects user experience and policy lapse
 * FALLBACK: If incorrect, grace period is configurable via admin settings
 */
const GRACE_PERIOD_DAYS = 7;
```

---

## 13. Communication Guidelines

### 13.1 Status Reporting

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| Daily standup | Daily | Dev team | Blockers, progress |
| Sprint review | Bi-weekly | Stakeholders | Demo, metrics |
| Technical debt | Monthly | Tech Lead, PM | Debt inventory, remediation plan |
| Security status | Monthly | Tech Lead, CISO | Vulnerabilities, patches |

### 13.2 Incident Response

```
Severity 1 (Critical): Production down, payments failing
  → Immediate page to on-call
  → War room within 15 minutes
  → Stakeholder update every 30 minutes
  
Severity 2 (High): Major feature broken, workaround exists
  → Page to on-call within 1 hour
  → Fix within 4 hours
  → Stakeholder update every 2 hours
  
Severity 3 (Medium): Minor feature issue
  → Ticket created, prioritized in sprint
  → Fix within 1 week
  
Severity 4 (Low): Cosmetic issue
  → Ticket created, backlog
  → Fix when convenient
```

### 13.3 AI Assistant Usage Guidelines

When using Claude or other AI assistants for this project:

1. **Always provide context**: Reference this CLAUDE.md and relevant spec documents
2. **Verify outputs**: AI-generated code must be reviewed and tested
3. **Don't share PII**: Never include real user data in prompts
4. **Document AI usage**: Note in PR if significant code was AI-assisted
5. **Maintain ownership**: Humans are responsible for all committed code

---

## 14. Reference Documents

### 14.1 Project Documentation

| Document | Purpose |
|----------|---------|
| [product_description.md](product_description.md) | Business context, personas, journeys |
| [module_architecture.md](module_architecture.md) | Technical architecture, modules, data |
| [requirements_specification.md](requirements_specification.md) | Functional and non-functional requirements |
| [feature_specification.md](feature_specification.md) | Detailed feature definitions |

### 14.2 External References

| Reference | URL |
|-----------|-----|
| M-Pesa Daraja API | https://developer.safaricom.co.ke/ |
| WhatsApp Business API | https://developers.facebook.com/docs/whatsapp |
| Kenya Data Protection Act | https://www.odpc.go.ke/ |
| Insurance Regulatory Authority | https://www.ira.go.ke/ |
| NestJS Documentation | https://docs.nestjs.com/ |
| PostgreSQL Documentation | https://www.postgresql.org/docs/ |

### 14.3 Contacts

| Role | Responsibility |
|------|----------------|
| Product Owner | Requirements, priorities, scope |
| Tech Lead | Architecture, code review, technical decisions |
| Project Manager | Timeline, resources, stakeholder communication |
| Compliance Officer | Regulatory requirements, audits |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2024 | Initial version |

---

*This document governs the implementation of the BodaInsure platform. All team members and AI assistants must adhere to these guidelines. Deviations require explicit approval and documentation.*
