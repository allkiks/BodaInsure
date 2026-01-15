# M-Pesa Payment Flow Improvements

## Proposed Architecture

This document outlines improvements to achieve the desired payment flow behavior.

---

## 1. Desired Behavior (Target State)

```
┌─────────────┐     1. Initiate STK    ┌──────────────┐
│   Rider     │ ────────────────────▶  │   Backend    │
│   (App)     │                        │   (API)      │
└─────────────┘                        └──────────────┘
       │                                      │
       │                                      │ 2. M-Pesa STK Push
       │                                      ▼
       │                               ┌──────────────┐
       │                               │   M-Pesa     │
       │                               │   Daraja     │
       │                               └──────────────┘
       │                                      │
       │ 3a. Poll /status                     │ 3b. Callback
       │     (every 2s)                       │
       │                                      ▼
       │◀──────────────────────────────┌──────────────┐
       │   4. Auto-update UI           │  Callback    │
       │      to COMPLETED             │  Handler     │
       │                               └──────────────┘
       │                                      │
       │                                      │ 5. Post-Payment
       │   6. If >60s:                        │    Services
       │      Show delay notification         ▼
       │      Enqueue for async        ┌──────────────┐
       │                               │ BullMQ Queue │
       │                               │ (Reliable)   │
       │                               └──────────────┘
```

---

## 2. Implementation Plan

### Phase 1: Enhanced Mock Mode (Development)

**Goal:** Make mock mode simulate the full callback flow for development testing.

**File:** `src/server/src/modules/payment/services/mpesa.service.ts`

```typescript
/**
 * Enhanced mock STK simulation
 * Instead of just returning success, actually trigger the callback endpoint
 */
private async simulateStkWithCallback(
  request: StkPushRequest,
  checkoutRequestId: string,
  merchantRequestId: string,
): Promise<void> {
  // Simulate M-Pesa processing delay (2-5 seconds)
  const delay = 2000 + Math.random() * 3000;

  setTimeout(async () => {
    try {
      // Construct callback payload matching M-Pesa format
      const callbackPayload = {
        stkCallback: {
          MerchantRequestID: merchantRequestId,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: request.amount },
              { Name: 'MpesaReceiptNumber', Value: `MOCK${Date.now()}` },
              { Name: 'TransactionDate', Value: new Date().toISOString() },
              { Name: 'PhoneNumber', Value: request.phone },
            ],
          },
        },
      };

      // POST to our own callback endpoint
      const callbackUrl = this.configService.get<string>('MPESA_CALLBACK_URL');
      if (callbackUrl) {
        await this.httpClient.post(callbackUrl, callbackPayload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        });
        this.logger.log(`[MOCK] Simulated callback sent for ${checkoutRequestId}`);
      }
    } catch (error) {
      this.logger.warn(`[MOCK] Failed to send simulated callback: ${error}`);
    }
  }, delay);
}
```

### Phase 2: Auto-Refresh on Timeout

**Goal:** When polling times out after 60s, automatically query M-Pesa instead of just showing error.

**File:** `src/client/src/pages/rider/PaymentPage.tsx`

```typescript
// Enhanced polling with auto-refresh
useEffect(() => {
  if (step !== 'processing' || !paymentRequestId) return;

  const maxPolls = 30; // 60 seconds

  if (pollingCount >= maxPolls) {
    // Instead of immediately failing, try a direct M-Pesa query
    handleAutoRefresh();
    return;
  }

  const timer = setTimeout(() => {
    checkStatus.mutate(paymentRequestId);
    setPollingCount((prev) => prev + 1);
  }, 2000);

  return () => clearTimeout(timer);
}, [step, paymentRequestId, pollingCount]);

// Auto-refresh handler
const handleAutoRefresh = async () => {
  if (!paymentRequestId) return;

  setStep('verifying'); // New step for delay notification

  try {
    const result = await paymentApi.refreshStatus(paymentRequestId);

    if (result.status === 'COMPLETED') {
      setMpesaReceiptNumber(result.mpesaReceiptNumber ?? null);
      setStep('success');
    } else if (result.status === 'FAILED' || result.status === 'CANCELLED') {
      setErrorMessage(result.failureReason ?? 'Payment failed');
      setStep('failed');
    } else {
      // Still pending - show delay notification
      setStep('delayed');
      // Enqueue for background monitoring
      await paymentApi.enqueueForMonitoring(paymentRequestId);
    }
  } catch {
    setStep('delayed');
  }
};
```

### Phase 3: Progressive Timeout Handling (Backend)

**Goal:** Track delayed payments and provide better status information.

**File:** `src/server/src/modules/payment/services/payment.service.ts`

```typescript
/**
 * Enhanced payment status with delay detection
 */
async getPaymentStatusWithDelayInfo(
  requestId: string,
  userId: string,
): Promise<{
  status: PaymentRequestStatus;
  isDelayed: boolean;
  delaySeconds?: number;
  recommendedAction: 'wait' | 'refresh' | 'contact_support';
  message: string;
}> {
  const paymentRequest = await this.paymentRequestRepository.findOne({
    where: { id: requestId, userId },
  });

  if (!paymentRequest) {
    throw new NotFoundException('Payment request not found');
  }

  const elapsedSeconds = Math.floor(
    (Date.now() - paymentRequest.createdAt.getTime()) / 1000
  );

  // Determine if delayed
  const isDelayed = paymentRequest.status === PaymentRequestStatus.SENT &&
                    elapsedSeconds > 60;

  let recommendedAction: 'wait' | 'refresh' | 'contact_support' = 'wait';
  let message = 'Payment is being processed';

  if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
    return {
      status: paymentRequest.status,
      isDelayed: false,
      message: 'Payment completed successfully',
      recommendedAction: 'wait',
    };
  }

  if (isDelayed) {
    if (elapsedSeconds < 180) {
      recommendedAction = 'refresh';
      message = 'Payment is taking longer than expected. We are checking with M-Pesa.';
    } else if (elapsedSeconds < 600) {
      recommendedAction = 'refresh';
      message = 'Payment confirmation delayed. Please check your M-Pesa messages.';
    } else {
      recommendedAction = 'contact_support';
      message = 'Payment status uncertain. Please contact support with your M-Pesa receipt.';
    }
  }

  return {
    status: paymentRequest.status,
    isDelayed,
    delaySeconds: isDelayed ? elapsedSeconds : undefined,
    recommendedAction,
    message,
  };
}
```

### Phase 4: Queue-Based Delayed Payment Processing

**Goal:** Use BullMQ for reliable async processing of delayed payments.

**File:** `src/server/src/modules/payment/processors/delayed-payment.processor.ts`

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';

export const DELAYED_PAYMENT_QUEUE = 'delayed-payments';

export interface DelayedPaymentJob {
  paymentRequestId: string;
  userId: string;
  attemptCount: number;
  maxAttempts: number;
}

@Injectable()
@Processor(DELAYED_PAYMENT_QUEUE)
export class DelayedPaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(DelayedPaymentProcessor.name);

  constructor(private readonly paymentService: PaymentService) {
    super();
  }

  async process(job: Job<DelayedPaymentJob>): Promise<void> {
    const { paymentRequestId, userId, attemptCount, maxAttempts } = job.data;

    this.logger.log(
      `Processing delayed payment ${paymentRequestId} (attempt ${attemptCount}/${maxAttempts})`
    );

    try {
      const result = await this.paymentService.refreshPaymentStatus(
        paymentRequestId,
        userId
      );

      if (result.status === 'COMPLETED') {
        this.logger.log(`Delayed payment ${paymentRequestId} resolved: COMPLETED`);
        // Send notification to user
        await this.notifyUserPaymentComplete(userId, paymentRequestId);
        return;
      }

      if (result.status === 'FAILED' || result.status === 'CANCELLED') {
        this.logger.log(`Delayed payment ${paymentRequestId} resolved: ${result.status}`);
        // Send notification to user
        await this.notifyUserPaymentFailed(userId, paymentRequestId, result.message);
        return;
      }

      // Still pending - re-queue if attempts remaining
      if (attemptCount < maxAttempts) {
        throw new Error('Payment still pending - will retry');
      }

      // Max attempts reached
      this.logger.warn(
        `Delayed payment ${paymentRequestId} unresolved after ${maxAttempts} attempts`
      );
      await this.notifyUserPaymentUnresolved(userId, paymentRequestId);
    } catch (error) {
      this.logger.error(
        `Error processing delayed payment ${paymentRequestId}`,
        error
      );
      throw error; // Will trigger retry
    }
  }

  private async notifyUserPaymentComplete(
    userId: string,
    paymentRequestId: string
  ): Promise<void> {
    // TODO: Integrate with notification service
    this.logger.log(`Notify user ${userId}: Payment ${paymentRequestId} completed`);
  }

  private async notifyUserPaymentFailed(
    userId: string,
    paymentRequestId: string,
    reason: string
  ): Promise<void> {
    this.logger.log(`Notify user ${userId}: Payment ${paymentRequestId} failed - ${reason}`);
  }

  private async notifyUserPaymentUnresolved(
    userId: string,
    paymentRequestId: string
  ): Promise<void> {
    this.logger.log(`Notify user ${userId}: Payment ${paymentRequestId} needs manual review`);
  }
}
```

### Phase 5: Enqueue Delayed Payments

**File:** `src/server/src/modules/payment/services/payment.service.ts`

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DELAYED_PAYMENT_QUEUE, DelayedPaymentJob } from '../processors/delayed-payment.processor';

// In constructor:
constructor(
  // ... existing deps
  @InjectQueue(DELAYED_PAYMENT_QUEUE)
  private readonly delayedPaymentQueue: Queue<DelayedPaymentJob>,
) {}

/**
 * Enqueue a payment for delayed processing
 * Called when polling times out
 */
async enqueueForDelayedProcessing(
  requestId: string,
  userId: string,
): Promise<void> {
  const paymentRequest = await this.paymentRequestRepository.findOne({
    where: { id: requestId, userId },
  });

  if (!paymentRequest) {
    throw new NotFoundException('Payment request not found');
  }

  // Only enqueue if still in SENT status
  if (paymentRequest.status !== PaymentRequestStatus.SENT) {
    this.logger.debug(`Payment ${requestId} not in SENT status, skipping queue`);
    return;
  }

  // Add to queue with exponential backoff
  await this.delayedPaymentQueue.add(
    'process-delayed-payment',
    {
      paymentRequestId: requestId,
      userId,
      attemptCount: 1,
      maxAttempts: 5,
    },
    {
      delay: 30000, // Start after 30 seconds
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 30000, // 30s, 60s, 120s, 240s, 480s
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep for debugging
    }
  );

  this.logger.log(`Enqueued payment ${requestId} for delayed processing`);
}
```

### Phase 6: Enhanced Frontend UI States

**File:** `src/client/src/pages/rider/PaymentPage.tsx`

Add new UI states for delay handling:

```typescript
type PaymentStep =
  | 'select'
  | 'confirm'
  | 'processing'
  | 'verifying'  // NEW: Auto-refresh in progress
  | 'delayed'    // NEW: Payment is delayed, queued for processing
  | 'success'
  | 'failed';

// New UI for 'delayed' step
if (step === 'delayed') {
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <Clock className="h-8 w-8 text-yellow-600" />
        </div>
        <CardTitle>Payment Processing Delayed</CardTitle>
        <CardDescription>
          Your payment is taking longer than usual to confirm
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-yellow-50 p-4 text-left">
          <p className="text-sm text-yellow-800">
            <strong>What's happening:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-yellow-700">
            <li>• M-Pesa confirmation is delayed</li>
            <li>• We're monitoring your payment automatically</li>
            <li>• You'll be notified when it completes</li>
          </ul>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 text-left">
          <p className="text-sm text-blue-800">
            <strong>What you can do:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-700">
            <li>• Check your M-Pesa messages for a confirmation SMS</li>
            <li>• If you received a confirmation, click "Check Status" below</li>
            <li>• If not, please wait - we'll notify you automatically</li>
          </ul>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleRefreshStatus}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking with M-Pesa...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Payment Status
            </>
          )}
        </Button>

        <Button variant="outline" className="w-full" onClick={() => navigate('/my/wallet')}>
          Continue to Wallet
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## 3. API Changes Summary

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/payments/status/:id/detailed` | GET | Get payment status with delay info |
| `/payments/:id/enqueue-monitoring` | POST | Enqueue payment for delayed processing |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `/payments/status/:id` | Add `isDelayed`, `delaySeconds`, `recommendedAction` fields |
| `/payments/status/:id/refresh` | Add auto-queueing on continued pending |

---

## 4. Queue Configuration

**File:** `src/server/src/modules/payment/payment.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';
import { DELAYED_PAYMENT_QUEUE } from './processors/delayed-payment.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DELAYED_PAYMENT_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    // ... existing imports
  ],
  providers: [
    // ... existing providers
    DelayedPaymentProcessor,
  ],
})
export class PaymentModule {}
```

---

## 5. Monitoring & Observability

### New Metrics to Track

| Metric | Description |
|--------|-------------|
| `payment_callback_delay_seconds` | Time between STK initiation and callback receipt |
| `payment_polling_timeout_count` | Number of payments that exceeded polling timeout |
| `payment_delayed_queue_size` | Number of payments in delayed processing queue |
| `payment_delayed_resolution_rate` | % of delayed payments eventually resolved |
| `payment_manual_refresh_count` | Number of manual refresh attempts |

### Logging Enhancements

```typescript
// Add structured logging for payment lifecycle
this.logger.log({
  event: 'payment_callback_received',
  paymentRequestId: paymentRequest.id,
  delaySeconds: elapsedSinceInitiation,
  resultCode: callbackData.resultCode,
  mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
});
```

---

## 6. Testing Strategy

### Unit Tests

1. Mock mode callback simulation
2. Delay detection logic
3. Queue job processing
4. Status transition logic

### Integration Tests

1. Full payment flow with mock callbacks
2. Timeout handling and auto-refresh
3. Queue-based processing
4. Notification triggering

### E2E Tests (Sandbox)

1. Real M-Pesa STK Push with sandbox
2. Callback handling with ngrok
3. Transaction Status Query API

---

## 7. Rollout Plan

### Phase 1 (Week 1)
- Implement enhanced mock mode
- Add detailed status endpoint
- Update frontend timeout handling

### Phase 2 (Week 2)
- Implement queue-based delayed processing
- Add delay notification UI
- Integrate with notification service

### Phase 3 (Week 3)
- Add monitoring metrics
- Enhanced logging
- Performance testing

### Phase 4 (Week 4)
- Production rollout
- Monitoring validation
- Documentation update

---

## 8. Backwards Compatibility

All changes are backwards compatible:
- New endpoints don't affect existing ones
- New fields in responses are additive
- Queue processing is supplementary to existing polling
- Frontend changes gracefully degrade
