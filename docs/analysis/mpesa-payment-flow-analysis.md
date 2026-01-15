# M-Pesa Payment Flow Analysis

## Executive Summary

The current implementation is **more robust than assumed**. The system DOES have:
- M-Pesa callback handling
- Frontend polling
- Post-payment service triggering (ledger, escrow)
- Manual refresh capability
- Background stale payment reconciliation

However, there are gaps that cause the perceived behavior issues, primarily related to mock mode behavior and timeout handling.

---

## 1. Assumed Behavior vs Actual Implementation

### User's Assumption

| Step | Assumed Behavior |
|------|-----------------|
| 1 | Rider initiates M-Pesa STK Push |
| 2 | Rider completes payment on device |
| 3 | UI waits but confirmation never automatically received |
| 4 | Rider manually clicks "Confirm Payment" |
| 5 | Post-payment services triggered at that point |

### Actual Implementation

| Step | Actual Behavior | Code Reference |
|------|----------------|----------------|
| 1 | STK Push initiated via `/payments/deposit` or `/payments/daily` | `payment.controller.ts:76-123` |
| 2 | `PaymentRequest` created with status `SENT` | `payment.service.ts:156-202` |
| 3 | **M-Pesa callback endpoint EXISTS** and processes callbacks | `payment.controller.ts:631-666` |
| 4 | **Frontend DOES poll** every 2s for up to 60s | `PaymentPage.tsx:127-146` |
| 5 | **Post-payment services ARE triggered** on callback | `payment.service.ts:448-516` |
| 6 | Manual refresh available via "Check Payment Status" button | `PaymentPage.tsx:100-124` |
| 7 | Background stale payment polling every 5 minutes | `batch-scheduler.service.ts:219-235` |

---

## 2. Current Architecture Flow

```
┌─────────────┐     STK Push        ┌──────────────┐
│   Frontend  │ ─────────────────▶  │   Backend    │
│  (React)    │                     │  (NestJS)    │
└─────────────┘                     └──────────────┘
       │                                   │
       │                                   │ initiateSTKPush()
       │                                   ▼
       │                            ┌──────────────┐
       │                            │   M-Pesa     │
       │                            │   Daraja     │
       │                            └──────────────┘
       │                                   │
       │ poll status                       │ Callback (async)
       │ every 2s                          │
       │                                   ▼
       │                            ┌──────────────┐
       │◀─────────────────────────── │  /mpesa/     │
       │    status: COMPLETED        │  callback    │
       │                            └──────────────┘
       │                                   │
       │                                   │ processCallback()
       │                                   ▼
       │                            ┌──────────────┐
       │                            │ Post-Payment │
       │                            │  Services    │
       │                            └──────────────┘
       │                                   │
       │                    ┌──────────────┴──────────────┐
       │                    │              │              │
       │                    ▼              ▼              ▼
       │              ┌─────────┐   ┌─────────┐   ┌─────────┐
       │              │ Journal │   │ Escrow  │   │ Wallet  │
       │              │ Entry   │   │ Record  │   │ Update  │
       │              └─────────┘   └─────────┘   └─────────┘
```

---

## 3. Post-Payment Services Triggering

### When Are They Triggered?

Post-payment services are triggered in `PaymentService.processCallback()` at `payment.service.ts:448-516`:

```typescript
// 1. Journal Entry (Ledger Posting)
const postingResult = await this.postingEngineService.postPaymentReceipt({
  transactionId: result.transactionId,
  userId: result._postingData.userId,
  paymentType: result._postingData.paymentType === TransactionType.DEPOSIT
    ? 'DEPOSIT' : 'DAILY_PAYMENT',
  amountCents: result._postingData.amountCents,
  daysCount: result._postingData.daysCount,
  mpesaReceiptNumber: result._postingData.mpesaReceiptNumber,
});

// 2. Escrow Record (Premium Tracking)
const escrowRecord = await this.escrowService.createEscrowRecord({
  riderId: result._postingData.userId,
  transactionId: result.transactionId,
  paymentDay: result._postingData.paymentDay,
  premiumAmountCents,
  serviceFeeAmountCents,
});
```

### What Gets Created?

| Service | Entity Created | Purpose |
|---------|---------------|---------|
| PostingEngineService | JournalEntry + JournalEntryLines | Double-entry accounting (Debit 1001 Cash, Credit 2001/2002/4001) |
| EscrowService | EscrowRecord | Track premium amounts for underwriter settlement |
| WalletService | Wallet balance update | Track rider's payment progress |
| TransactionRepository | Transaction record | Permanent payment record with M-Pesa receipt |

---

## 4. Identified Gaps

### Gap 1: Mock Mode Doesn't Simulate Full Callback Flow

**Problem:** When `MPESA_USE_MOCK=true`, the `simulateStk()` method returns success but doesn't actually POST to the callback endpoint.

**Location:** `mpesa.service.ts:461-520`

**Impact:** In development/testing, the callback never arrives, so post-payment services aren't triggered.

### Gap 2: Frontend Timeout Doesn't Auto-Trigger Refresh

**Problem:** After 60 seconds of polling, the UI shows a timeout error. The user can manually click "Check Payment Status" but this isn't automatic.

**Location:** `PaymentPage.tsx:130-137`

```typescript
const maxPolls = 30; // 60 seconds (2s interval)
if (pollingCount >= maxPolls) {
  setErrorMessage(getMpesaErrorMessage('TIMEOUT'));
  setStep('failed');
  return;  // No auto-refresh attempt
}
```

### Gap 3: No Real-Time Push Notifications

**Problem:** Uses polling instead of WebSocket/SSE. Rider must wait up to 2s for status updates.

### Gap 4: No Delayed Transaction Queueing

**Problem:** When a callback is delayed beyond 60s:
1. UI shows timeout
2. Payment request remains in `SENT` status
3. Only recovered by:
   - Manual refresh button click
   - Background stale polling (every 5 minutes)

**Missing:** No immediate queueing for async processing or rider notification.

### Gap 5: Callback URL Accessibility

**Problem:** In development, M-Pesa cannot reach `localhost` callback URLs.

**Workaround:** ngrok URLs in `.env.docker`, but these expire.

---

## 5. Current Resilience Mechanisms

### Mechanism 1: Idempotent Callback Processing

```typescript
// payment.service.ts:304-314
if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
  this.logger.debug('Duplicate callback received for already processed payment');
  return {
    success: true,
    paymentRequestId: paymentRequest.id,
    transactionId: paymentRequest.transactionId ?? undefined,
    message: 'Payment already processed',
  };
}
```

### Mechanism 2: Security Validation

```typescript
// payment.service.ts:233-301
// - Validates checkoutRequestId exists
// - Validates amount matches (within 1 KES tolerance)
// - Validates phone number (last 4 digits)
// - Logs suspicious callbacks for audit
```

### Mechanism 3: Stale Payment Polling (Background Job)

```typescript
// batch-scheduler.service.ts:219-235
@Cron(CronExpression.EVERY_5_MINUTES, { name: 'stale-payment-polling' })
async handleStalePaymentPolling(): Promise<void> {
  // Polls M-Pesa for requests in SENT status older than 3 minutes
}
```

### Mechanism 4: Manual Refresh via Transaction Status Query

```typescript
// payment.service.ts:640-754
async refreshPaymentStatus(requestId: string, userId: string) {
  // Queries M-Pesa STK Query API
  // Processes result as if it were a callback
}
```

### Mechanism 5: Callback Acknowledgment

```typescript
// payment.controller.ts:659-665
// Always return success to M-Pesa to prevent retries
return { ResultCode: 0, ResultDesc: 'Accepted' };
```

---

## 6. Daraja Best Practices Compliance

| Daraja Recommendation | Current Implementation | Status |
|----------------------|----------------------|--------|
| **Immediate Callback Acknowledgment** | Returns `{ ResultCode: 0 }` immediately | ✅ Compliant |
| **Transaction Status Query** | `refreshPaymentStatus()` uses STK Query API | ✅ Implemented |
| **Idempotent Processing** | Checks for COMPLETED status before processing | ✅ Implemented |
| **Amount Validation** | Validates amount within 1 KES tolerance | ✅ Implemented |
| **Phone Validation** | Validates last 4 digits of phone | ✅ Implemented |
| **Security Logging** | Logs suspicious callbacks | ✅ Implemented |
| **Retry Handling** | Background polling for stale requests | ⚠️ Every 5 min (could be faster) |
| **Timeout Handling** | Manual refresh available, but not auto | ⚠️ Needs improvement |

---

## 7. Why The Assumed Behavior Might Be Observed

### Scenario 1: Development Environment (Most Likely)

1. M-Pesa is in mock mode or sandbox
2. Callback URL uses ngrok which may have expired
3. Callbacks never arrive
4. Polling times out after 60s
5. User sees "timeout" and must manually click refresh

### Scenario 2: Network Issues

1. Callback endpoint returns success to M-Pesa
2. But internal processing fails
3. Payment stays in SENT status
4. Only recovered by background polling or manual refresh

### Scenario 3: Actual M-Pesa Delay

1. M-Pesa is slow (can happen during peak times)
2. Callback arrives after 60s polling window
3. Frontend shows timeout
4. Background processing eventually catches it

---

## 8. Proposed Improvements

See `mpesa-payment-flow-improvements.md` for detailed implementation plan.

### Summary of Improvements:

1. **Enhanced Mock Mode** - Simulate actual callback posting
2. **Auto-Refresh on Timeout** - Automatically query M-Pesa after polling timeout
3. **Progressive Timeout Handling** - Show delay notification at 60s, continue processing
4. **Real-Time Updates via SSE** - Push payment status to frontend
5. **Queue-Based Processing** - Use BullMQ for reliable async processing
6. **Enhanced Monitoring** - Track callback delays, success rates, processing times
