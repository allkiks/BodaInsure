# M-Pesa (Daraja API) Remediation Plan

**Document Version:** 1.3
**Created:** December 2024
**Last Updated:** December 2024 (All P0 and P1 items complete)
**Status:** P0 AND P1 COMPLETE - PRODUCTION READY
**Related Document:** [mpesa_audit.md](./mpesa_audit.md)

**Reference Documents:**
- Safaricom Daraja Authorization API Documentation
- Safaricom Daraja C2B API Documentation

---

## Remediation Overview

This document provides a step-by-step remediation plan for all gaps identified in the M-Pesa integration audit. Items are prioritized using P0 (critical blocker), P1 (high priority), and P2 (medium priority).

### Priority Definitions

| Priority | Definition | Timeline |
|----------|------------|----------|
| **P0** | Production blocker - security/functionality critical | Must fix before go-live |
| **P1** | High priority - significant functionality gap | Fix within Sprint 1 |
| **P2** | Medium priority - improvement or technical debt | Fix within Sprint 2-3 |

### Effort Estimates

| Size | Definition | Approximate Duration |
|------|------------|---------------------|
| **S** | Small - single file, < 100 lines | 2-4 hours |
| **M** | Medium - multiple files, 100-500 lines | 1-2 days |
| **L** | Large - cross-cutting, > 500 lines | 3-5 days |

---

## Executive Summary

| Priority | Count | Completed | Remaining |
|----------|-------|-----------|-----------|
| P0 (Critical) | 3 | **3** | 0 |
| P1 (High) | 4 | **4** | 0 |
| P2 (Medium) | 5 | 0 | 5 |
| **Total** | **12** | **7** | **5** |

### Implementation Progress (v1.3)

**All P0 (Critical) and P1 (High) items are now COMPLETE:**

| Item | Description | Status | File(s) |
|------|-------------|--------|---------|
| P0-001 | Callback IP Whitelist | **DONE** | `src/common/guards/mpesa-callback.guard.ts` |
| P0-002 | Callback Validation | **DONE** | `src/modules/payment/services/payment.service.ts` |
| P0-003 | Cluster-Safe Token Management | **DONE** | `src/common/services/redis.service.ts`, `mpesa.service.ts` |
| P1-001 | B2C Callback Handlers | **DONE** | `src/modules/payment/controllers/payment.controller.ts` |
| P1-003 | Startup Config Validation | **DONE** | `src/modules/payment/services/mpesa.service.ts` |
| P1-004 | STK Query Polling | **DONE** | `payment.service.ts`, `batch-scheduler.service.ts` |
| P1-005 | Enhanced Error Handling | **DONE** | `src/modules/payment/errors/mpesa.errors.ts` |

**Remaining P2 (Medium) items for future sprints:**

| Item | Description | Status |
|------|-------------|--------|
| P2-001 | Comprehensive Integration Tests | Pending |
| P2-002 | Transaction Reversal Support | Pending |
| P2-003 | Webhook Retry Logic | Pending |
| P2-004 | Payment Metrics & Monitoring | Pending |
| P2-005 | Secrets Manager Integration | Pending |

### Critical Change from v1.0

**Token Caching upgraded from P1 to P0** based on official Daraja documentation:
> "Can I generate multiple tokens? Yes, but **each request invalidates the previous token**."

This means in a clustered environment, **payments WILL fail** when multiple pods refresh tokens. This is not optional.

**RESOLVED in v1.2:** Implemented Redis-based token caching with distributed locking.

---

## P0 - Critical Security Fixes (MUST COMPLETE BEFORE PRODUCTION)

### P0-001: Implement Callback Authentication

**Gap Reference:** GAP-001, SEC-001, SEC-002, SEC-003
**Severity:** Critical
**Effort:** M (1-2 days)

#### Problem Statement
The M-Pesa callback endpoint accepts any request without verification. A malicious actor can craft fake callbacks to credit wallets with non-existent payments.

#### Implementation Steps

**Step 1: Create IP Whitelist Guard**

Create file: `src/server/src/common/guards/mpesa-callback.guard.ts`

```typescript
// Implementation requirements:
// 1. Extract source IP from request (handle X-Forwarded-For for load balancers)
// 2. Validate against Safaricom IP ranges:
//    - 196.201.214.200-207 (primary callback servers)
//    - 196.201.214.0/24 (full range for flexibility)
// 3. Log all rejected requests with full details
// 4. Make IP ranges configurable via environment variable
```

**Step 2: Add Callback Signature Validation (Optional Enhancement)**

Note: Safaricom doesn't provide HMAC signatures for STK callbacks. Implement checksum validation using known fields.

```typescript
// Validation approach:
// 1. Verify CheckoutRequestID exists in our database
// 2. Verify MerchantRequestID matches our records
// 3. Verify amount matches expected amount
// 4. Verify phone number (last 4 digits) matches
```

**Step 3: Apply Guard to Callback Controller**

Modify: `src/server/src/modules/payment/controllers/payment.controller.ts`

```typescript
@Post('callback')
@UseGuards(MpesaCallbackGuard)  // Add this line
@HttpCode(HttpStatus.OK)
async handleCallback(@Body() body: MpesaCallbackBody) {
  // existing implementation
}
```

**Step 4: Add Environment Configuration**

Add to `.env.production`:
```env
MPESA_ALLOWED_IPS=196.201.214.200,196.201.214.201,196.201.214.202,196.201.214.203,196.201.214.204,196.201.214.205,196.201.214.206,196.201.214.207
MPESA_ALLOW_LOCALHOST_CALLBACK=false
```

#### Testing Requirements
- [ ] Unit test: Guard rejects non-Safaricom IPs
- [ ] Unit test: Guard accepts valid Safaricom IPs
- [ ] Unit test: Guard handles X-Forwarded-For header
- [ ] Integration test: Full callback flow with guard
- [ ] Manual test: Verify sandbox callbacks still work

#### Acceptance Criteria
- [ ] All callback requests from non-whitelisted IPs are rejected with 403
- [ ] Rejected requests are logged with source IP and payload
- [ ] Valid Safaricom callbacks are processed normally
- [ ] Configuration is environment-specific

---

### P0-002: Implement Callback Request Validation

**Gap Reference:** SEC-002
**Severity:** Critical
**Effort:** S (2-4 hours)

#### Problem Statement
Callbacks are processed without validating that the payment request exists and matches expected values.

#### Implementation Steps

**Step 1: Enhance processCallback validation**

Modify: `src/server/src/modules/payment/services/payment.service.ts`

```typescript
async processCallback(callbackData: ParsedCallbackData): Promise<CallbackProcessResult> {
  // NEW: Pre-validation before any processing
  const paymentRequest = await this.paymentRequestRepository.findOne({
    where: { checkoutRequestId: callbackData.checkoutRequestId },
  });

  if (!paymentRequest) {
    // NEW: Log suspicious callback
    this.logger.warn(
      `Callback for unknown checkoutRequestId: ${callbackData.checkoutRequestId}`,
      { fullPayload: callbackData }
    );
    return { success: false, message: 'Payment request not found' };
  }

  // NEW: Validate amount matches (within 1 KES tolerance for rounding)
  if (callbackData.isSuccessful && callbackData.amount) {
    const expectedAmount = paymentRequest.getAmountInKes();
    if (Math.abs(callbackData.amount - expectedAmount) > 1) {
      this.logger.error(
        `Amount mismatch in callback: expected=${expectedAmount}, received=${callbackData.amount}`,
        { paymentRequestId: paymentRequest.id }
      );
      // Don't process - potential fraud attempt
      return { success: false, message: 'Amount validation failed' };
    }
  }

  // Continue with existing processing...
}
```

#### Testing Requirements
- [ ] Unit test: Callback with non-existent checkoutRequestId rejected
- [ ] Unit test: Callback with mismatched amount rejected
- [ ] Unit test: Valid callback processed successfully

#### Acceptance Criteria
- [ ] All callbacks validated against existing payment requests
- [ ] Amount mismatches logged and rejected
- [ ] Suspicious callbacks flagged in logs

---

## P1 - High Priority Fixes

### P1-001: Implement B2C Callback Handlers

**Gap Reference:** GAP-002, GAP-005
**Severity:** High
**Effort:** M (1-2 days)

#### Problem Statement
B2C refunds are initiated but there's no way to receive confirmation from Safaricom. Refund status is never updated.

#### Implementation Steps

**Step 1: Create B2C Result DTO**

Create file: `src/server/src/modules/payment/dto/b2c-callback.dto.ts`

**Step 2: Add B2C Callback Endpoints**

Modify: `src/server/src/modules/payment/controllers/payment.controller.ts`

Add to `MpesaCallbackController`:

```typescript
/**
 * B2C Result URL - receives refund confirmations
 */
@Post('b2c/result')
@HttpCode(HttpStatus.OK)
async handleB2cResult(@Body() body: B2cCallbackBody) {
  this.logger.log('B2C result callback received');
  // Parse callback
  // Find refund transaction by OriginatorConversationID
  // Update transaction status
  // Update related records
  return { ResultCode: 0, ResultDesc: 'Accepted' };
}

/**
 * B2C Timeout URL - handles timeout scenarios
 */
@Post('b2c/timeout')
@HttpCode(HttpStatus.OK)
async handleB2cTimeout(@Body() body: B2cTimeoutBody) {
  this.logger.log('B2C timeout callback received');
  // Mark refund as failed/timeout
  // Trigger retry or alert
  return { ResultCode: 0, ResultDesc: 'Accepted' };
}
```

**Step 3: Create Refund Transaction Tracking**

Add refund-specific fields to track B2C transactions and link them to original transactions.

**Step 4: Apply IP Whitelist Guard**

Use same guard from P0-001.

#### Testing Requirements
- [ ] Unit test: B2C result callback parsing
- [ ] Unit test: B2C timeout handling
- [ ] Integration test: Full refund flow

#### Acceptance Criteria
- [ ] B2C result callbacks update refund status
- [ ] B2C timeout callbacks trigger appropriate handling
- [ ] Refund audit trail is complete

---

### P0-003: Implement Cluster-Safe Token Management (CRITICAL)

**Gap Reference:** GAP-006
**Severity:** CRITICAL (upgraded from High)
**Effort:** M (1-2 days)

#### Problem Statement

**From Official Daraja Documentation:**
> "Can I generate multiple tokens? Yes, but **each request invalidates the previous token**."

This is NOT just an efficiency concern - it causes **payment failures**:

```
Pod A gets Token-1 → works
Pod B gets Token-2 → TOKEN-1 IS NOW INVALID
Pod A uses Token-1 → 401 UNAUTHORIZED - PAYMENT FAILS
```

**In production with 3+ pods, payments WILL fail intermittently.**

#### Implementation Steps

**Step 1: Add Redis Token Storage with Distributed Lock**

Modify: `src/server/src/modules/payment/services/mpesa.service.ts`

```typescript
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import Redlock from 'redlock';

const TOKEN_CACHE_KEY = 'mpesa:oauth:access_token';
const TOKEN_LOCK_KEY = 'mpesa:oauth:refresh_lock';
const TOKEN_CACHE_TTL = 55 * 60 * 1000; // 55 minutes (token expires at 60)
const LOCK_TTL = 10000; // 10 seconds max to fetch token

@Injectable()
export class MpesaService {
  private redlock: Redlock;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRedis() private readonly redis: Redis, // Need Redis client for Redlock
  ) {
    // Initialize Redlock for distributed locking
    this.redlock = new Redlock([this.redis], {
      retryCount: 10,
      retryDelay: 200, // ms between retries
    });
  }

  async getAccessToken(): Promise<string> {
    // 1. Try to get from cache first (fast path)
    const cached = await this.cacheManager.get<string>(TOKEN_CACHE_KEY);
    if (cached) {
      return cached;
    }

    // 2. Need to refresh - acquire distributed lock
    // This ensures ONLY ONE pod refreshes at a time
    let lock;
    try {
      lock = await this.redlock.acquire([TOKEN_LOCK_KEY], LOCK_TTL);

      // 3. Check cache again (another pod might have refreshed while we waited)
      const cachedAfterLock = await this.cacheManager.get<string>(TOKEN_CACHE_KEY);
      if (cachedAfterLock) {
        return cachedAfterLock;
      }

      // 4. Actually fetch new token from Safaricom
      const token = await this.fetchTokenFromSafaricom();

      // 5. Store in Redis for all pods to use
      await this.cacheManager.set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_TTL);

      this.logger.log('M-Pesa access token refreshed and cached');
      return token;

    } catch (error) {
      if (error.name === 'LockError') {
        // Couldn't get lock, wait and retry from cache
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryCache = await this.cacheManager.get<string>(TOKEN_CACHE_KEY);
        if (retryCache) return retryCache;
      }
      throw error;
    } finally {
      if (lock) {
        await lock.release();
      }
    }
  }

  private async fetchTokenFromSafaricom(): Promise<string> {
    // ... existing OAuth fetch logic
  }
}
```

**Step 2: Install Required Dependencies**

```bash
npm install redlock ioredis @nestjs/cache-manager cache-manager-redis-store
```

**Step 3: Update Module Configuration**

```typescript
// payment.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
        ttl: 3600, // default 1 hour
      }),
      inject: [ConfigService],
    }),
    // ... other imports
  ],
})
```

#### Testing Requirements
- [ ] Unit test: Token retrieved from cache when available
- [ ] Unit test: Only one pod fetches when multiple request simultaneously
- [ ] Integration test: Simulate 3 pods, verify no token invalidation errors
- [ ] Load test: 100 concurrent requests, zero 401 errors

#### Acceptance Criteria
- [ ] Access token stored in Redis (shared across all pods)
- [ ] Distributed lock prevents concurrent token refreshes
- [ ] Zero 401 errors due to token invalidation in production
- [ ] Token refresh logged with pod identifier

---

### P1-003: Add Startup Configuration Validation

**Gap Reference:** Part of configuration audit
**Severity:** High
**Effort:** S (2-4 hours)

#### Problem Statement
Service starts without validating that required M-Pesa credentials are present. This can cause silent failures in production.

#### Implementation Steps

**Step 1: Add Validation in Constructor**

Modify: `src/server/src/modules/payment/services/mpesa.service.ts`

```typescript
constructor(private readonly configService: ConfigService) {
  // Load configuration
  this.environment = this.configService.get<string>('MPESA_ENVIRONMENT', 'sandbox');
  // ... other config loading

  // NEW: Startup validation
  if (process.env.NODE_ENV === 'production') {
    this.validateProductionConfig();
  }
}

private validateProductionConfig(): void {
  const required = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_SHORTCODE',
    'MPESA_PASSKEY',
    'MPESA_CALLBACK_URL',
  ];

  const missing = required.filter(key => !this.configService.get(key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required M-Pesa configuration: ${missing.join(', ')}. ` +
      `Service cannot start in production without these values.`
    );
  }

  // Validate environment is production
  if (this.environment !== 'production') {
    this.logger.warn(
      'MPESA_ENVIRONMENT is not set to "production". ' +
      'Verify this is intentional before processing real payments.'
    );
  }

  // Validate callback URL is HTTPS
  if (!this.callbackUrl.startsWith('https://')) {
    throw new Error(
      'MPESA_CALLBACK_URL must use HTTPS in production'
    );
  }
}
```

#### Testing Requirements
- [ ] Unit test: Service fails to start with missing config in prod
- [ ] Unit test: Service starts normally with all config present
- [ ] Unit test: Warning logged for non-production environment

#### Acceptance Criteria
- [ ] Application fails fast with clear error if config missing
- [ ] Non-HTTPS callback URLs rejected in production
- [ ] Environment mismatch generates warning

---

### P1-004: Implement STK Query for Status Polling

**Gap Reference:** PART-004
**Severity:** High
**Effort:** S (2-4 hours)

#### Problem Statement
`querySTKStatus()` exists but is never called. If a callback is missed, there's no way to recover the payment status.

#### Implementation Steps

**Step 1: Add Status Polling Endpoint**

Add to `PaymentController`:

```typescript
/**
 * Query M-Pesa for payment status (fallback when callback missed)
 */
@Post('status/:requestId/refresh')
@UseGuards(JwtAuthGuard)
async refreshPaymentStatus(
  @Param('requestId', ParseUUIDPipe) requestId: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  const result = await this.paymentService.refreshPaymentStatus(requestId, user.userId);
  return { data: result };
}
```

**Step 2: Add Service Method**

Add to `PaymentService`:

```typescript
async refreshPaymentStatus(requestId: string, userId: string) {
  const request = await this.getPaymentRequest(requestId);

  if (!request || request.userId !== userId) {
    throw new NotFoundException('Payment request not found');
  }

  // Only query if still pending
  if (!request.isPending()) {
    return { status: request.status, message: 'Status already final' };
  }

  // Query M-Pesa
  const queryResult = await this.mpesaService.querySTKStatus(request.checkoutRequestId);

  // Update status based on query result
  if (queryResult.success && queryResult.resultCode === '0') {
    // Process as successful
    // ... (similar to callback processing)
  }

  return queryResult;
}
```

**Step 3: Add Scheduled Polling for Stale Requests**

Add to `BatchSchedulerService` or create dedicated job:

```typescript
@Cron(CronExpression.EVERY_10_MINUTES)
async pollStalePaymentRequests() {
  // Find requests in SENT status older than 3 minutes
  // Query M-Pesa for each
  // Update status accordingly
}
```

#### Testing Requirements
- [ ] Unit test: Manual refresh endpoint works
- [ ] Unit test: Scheduled polling finds stale requests
- [ ] Integration test: Full polling flow

#### Acceptance Criteria
- [ ] Users can manually refresh payment status
- [ ] Stale requests are automatically polled
- [ ] Status updates correctly based on query results

---

### P1-005: Enhanced Error Handling and Logging

**Gap Reference:** PART-002, PART-003
**Severity:** High
**Effort:** M (1-2 days)

#### Implementation Steps

**Step 1: Create Structured Error Classes**

Create file: `src/server/src/modules/payment/errors/mpesa.errors.ts`

```typescript
export class MpesaError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
    public readonly technicalMessage: string,
    public readonly isRetryable: boolean,
  ) {
    super(technicalMessage);
  }
}

export class MpesaAuthError extends MpesaError { }
export class MpesaStkError extends MpesaError { }
export class MpesaB2cError extends MpesaError { }
```

**Step 2: Implement PII Masking Utility**

Create file: `src/server/src/common/utils/pii-masking.ts`

```typescript
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}

export function maskNationalId(id: string): string {
  if (!id || id.length < 4) return '****';
  return '*'.repeat(id.length - 4) + id.slice(-4);
}
```

**Step 3: Update Logging Throughout**

Apply masking to all log statements containing PII.

#### Acceptance Criteria
- [ ] All errors use structured error classes
- [ ] All PII masked in logs
- [ ] Error messages are user-friendly
- [ ] Technical details preserved for debugging

---

## P2 - Medium Priority Improvements

### P2-001: Add Comprehensive Integration Tests

**Effort:** L (3-5 days)

#### Scope
- Create test fixtures for M-Pesa API responses
- Add integration tests for full payment flow
- Add tests for error scenarios
- Add load tests for concurrent payments

---

### P2-002: Implement Transaction Reversal

**Gap Reference:** GAP-004
**Effort:** M (1-2 days)

#### Scope
- Implement `TransactionType.REVERSAL` handling
- Add reversal endpoint for admin use
- Link reversals to original transactions
- Update wallet balances correctly

---

### P2-003: Add Webhook Retry Logic

**Gap Reference:** GAP-007
**Effort:** S (2-4 hours)

#### Scope
- Implement callback queue for retry
- Add exponential backoff
- Track retry attempts
- Alert after max retries exceeded

---

### P2-004: Add Payment Metrics and Monitoring

**Effort:** M (1-2 days)

#### Scope
- Add Prometheus metrics for:
  - Payment success rate
  - Payment latency (initiation to callback)
  - Token refresh frequency
  - Error rates by type
- Create Grafana dashboard
- Set up alerting rules

---

### P2-005: Implement Secrets Manager Integration

**Effort:** M (1-2 days)

#### Scope
- Integrate with AWS Secrets Manager (or Vault)
- Move all M-Pesa credentials to secrets manager
- Implement credential rotation support
- Remove credentials from .env files

---

### P2-006: Add C2B Paybill Support (Future)

**Effort:** L (3-5 days)

#### Scope
- Implement C2B register URL endpoint
- Add validation URL handler
- Add confirmation URL handler
- Support paybill alongside STK push

---

## Implementation Roadmap

### Sprint 1 (Week 1-2): P0 Critical - COMPLETED

| Task | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| P0-001: Callback IP Whitelist | P0 | M | Backend | **DONE** |
| P0-002: Callback Validation | P0 | S | Backend | **DONE** |
| P0-003: Cluster-Safe Token Management | P0 | M | Backend | **DONE** |

**Sprint 1 Definition of Done:** Zero security vulnerabilities in callback handling, zero token invalidation errors in multi-pod deployment.

**Implementation Notes (v1.2):**
- Created `MpesaCallbackGuard` in `src/server/src/common/guards/mpesa-callback.guard.ts`
- Applied guard to all M-Pesa callback endpoints (`/mpesa/callback`, `/mpesa/validation`, `/mpesa/b2c/result`, `/mpesa/b2c/timeout`)
- Enhanced `processCallback()` with amount and phone validation in `payment.service.ts`
- Created `RedisService` for distributed token caching in `src/server/src/common/services/redis.service.ts`
- Updated `MpesaService.getAccessToken()` to use Redis with distributed locking

### Sprint 2 (Week 3-4): P1 High Priority - COMPLETED

| Task | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| P1-001: B2C Callback Handlers | P1 | M | Backend | **DONE** |
| P1-003: Startup Config Validation | P1 | S | Backend | **DONE** |
| P1-004: STK Query Polling | P1 | S | Backend | **DONE** |
| P1-005: Error Handling | P1 | M | Backend | **DONE** |

**Implementation Notes (v1.3):**
- Added B2C callback endpoints: `/mpesa/b2c/result` and `/mpesa/b2c/timeout`
- Added `processB2cCallback()` and `processB2cTimeout()` methods to `PaymentService`
- Added `validateConfiguration()` method to `MpesaService` for startup validation
- Added `refreshPaymentStatus()` for manual status refresh API
- Added `pollStalePaymentRequests()` for automatic polling of missed callbacks
- Registered stale payment polling handler in `PaymentModule.onModuleInit()`
- Created `src/modules/payment/errors/mpesa.errors.ts` with:
  - `MpesaException`, `MpesaAuthException`, `MpesaServiceUnavailableException`, `MpesaTimeoutException`
  - `PiiMasker` utility for masking phone numbers, national IDs, and receipts
  - `getMpesaErrorMessage()` for user-friendly error messages

### Sprint 3 (Week 5-6): P2 Quality & Observability

| Task | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| P2-001: Integration Tests | P2 | L | Backend | Pending |
| P2-004: Metrics & Monitoring | P2 | M | Backend/DevOps | Pending |
| P2-007: Rename Callback URL | P2 | S | Backend | Pending |

### Sprint 4+ (Week 7+): Technical Debt

| Task | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| P2-002: Transaction Reversal | P2 | M | Backend | Pending |
| P2-003: Webhook Retry | P2 | S | Backend | Pending |
| P2-005: Secrets Manager | P2 | M | DevOps | Pending |

### Removed from Roadmap

| Original Task | Reason |
|---------------|--------|
| ~~C2B Validation/Confirmation URLs~~ | **NOT A GAP** - BodaInsure uses STK Push, not traditional C2B. STK Push is the correct choice for app-initiated payments. |

---

## Definition of Done

For each remediation item to be considered complete:

- [ ] Code implemented and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests (where applicable)
- [ ] Documentation updated
- [ ] Security review completed (for P0 items)
- [ ] Deployed to staging and verified
- [ ] Product owner sign-off

---

## Appendix: Code Samples

### A. MpesaCallbackGuard Implementation Skeleton

```typescript
// src/server/src/common/guards/mpesa-callback.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class MpesaCallbackGuard implements CanActivate {
  private readonly allowedIps: Set<string>;
  private readonly allowLocalhost: boolean;

  constructor(private readonly configService: ConfigService) {
    const ipsConfig = this.configService.get<string>('MPESA_ALLOWED_IPS', '');
    this.allowedIps = new Set(ipsConfig.split(',').map(ip => ip.trim()).filter(Boolean));
    this.allowLocalhost = this.configService.get<boolean>('MPESA_ALLOW_LOCALHOST_CALLBACK', false);

    // Add default Safaricom IPs if not configured
    if (this.allowedIps.size === 0) {
      for (let i = 200; i <= 207; i++) {
        this.allowedIps.add(`196.201.214.${i}`);
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.extractClientIp(request);

    // Allow localhost in development
    if (this.allowLocalhost && this.isLocalhost(clientIp)) {
      return true;
    }

    // Check against whitelist
    if (!this.allowedIps.has(clientIp)) {
      // Log the rejected request
      console.warn(`M-Pesa callback rejected from IP: ${clientIp}`);
      throw new ForbiddenException('Callback source not authorized');
    }

    return true;
  }

  private extractClientIp(request: Request): string {
    // Handle X-Forwarded-For for load balancers
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
      return ips.split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || '';
  }

  private isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  }
}
```

### B. Redis Token Caching Pattern

```typescript
// In mpesa.service.ts
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

const TOKEN_CACHE_KEY = 'mpesa:oauth:access_token';
const TOKEN_CACHE_TTL = 55 * 60 * 1000; // 55 minutes

async getAccessToken(): Promise<string> {
  // Try cache first
  const cached = await this.cacheManager.get<string>(TOKEN_CACHE_KEY);
  if (cached) {
    this.logger.debug('Using cached M-Pesa access token');
    return cached;
  }

  // Fetch new token with mutex to prevent thundering herd
  const lockKey = 'mpesa:oauth:lock';
  const lock = await this.cacheManager.get(lockKey);

  if (lock) {
    // Another instance is fetching, wait and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.getAccessToken();
  }

  // Set lock
  await this.cacheManager.set(lockKey, 'locked', 10000);

  try {
    const token = await this.fetchTokenFromSafaricom();
    await this.cacheManager.set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_TTL);
    return token;
  } finally {
    await this.cacheManager.del(lockKey);
  }
}
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Security Lead | | | |
| Product Owner | | | |

---

**End of Remediation Plan**

*This document should be reviewed and updated as remediation progresses.*
