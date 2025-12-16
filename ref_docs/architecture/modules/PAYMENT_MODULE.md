# Payment Module Architecture

## 1. Module Overview

### 1.1 Purpose and Scope

The Payment module is the financial backbone of the BodaInsure platform, implementing the innovative micropayment model that makes insurance accessible to bodaboda riders. It handles the complete payment lifecycle including M-Pesa STK Push integration, wallet management, transaction tracking, and policy trigger events.

### 1.2 Business Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    BODAINSURE PAYMENT MODEL                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Traditional Insurance: 3,500 KES annual lump sum (unaffordable)│
│                                                                 │
│  BodaInsure Model:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DEPOSIT: 1,048 KES → Policy 1 (1-month coverage)       │   │
│  │                                                          │   │
│  │  DAILY:   87 KES × 30 days → Policy 2 (11-month)        │   │
│  │                                                          │   │
│  │  TOTAL:   3,658 KES (includes platform fee)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **M-Pesa Integration** | STK Push for collections, B2C for refunds |
| **Wallet Management** | Balance tracking, payment progress, status |
| **Transaction Processing** | Immutable records, idempotency, audit trail |
| **Policy Triggers** | Detect when Policy 1 or Policy 2 should be issued |
| **Grace Period Handling** | 7-day grace period management after policy expiry |

---

## 2. Module Structure

### 2.1 File Organization

```
src/modules/payment/
├── payment.module.ts              # Module definition
├── controllers/
│   ├── payment.controller.ts      # Payment initiation endpoints
│   ├── wallet.controller.ts       # Wallet balance/progress endpoints
│   ├── transaction.controller.ts  # Transaction history endpoint
│   └── mpesa-callback.controller.ts # M-Pesa webhook handlers
├── services/
│   ├── payment.service.ts         # Payment orchestration
│   ├── payment.service.spec.ts    # Payment service tests
│   ├── wallet.service.ts          # Wallet operations
│   ├── wallet.service.spec.ts     # Wallet service tests
│   ├── mpesa.service.ts           # M-Pesa Daraja API integration
│   └── mpesa.service.spec.ts      # M-Pesa service tests
├── entities/
│   ├── index.ts                   # Entity exports
│   ├── wallet.entity.ts           # Wallet entity definition
│   ├── transaction.entity.ts      # Transaction entity definition
│   └── payment-request.entity.ts  # Payment request entity definition
├── dto/
│   ├── initiate-deposit.dto.ts    # Deposit request DTO
│   ├── initiate-daily.dto.ts      # Daily payment request DTO
│   └── payment-response.dto.ts    # Response DTOs
└── interfaces/
    └── mpesa.interface.ts         # M-Pesa types and interfaces
```

### 2.2 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                      PAYMENT MODULE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IMPORTS:                                                       │
│  ├── TypeOrmModule.forFeature([                                │
│  │     Wallet, Transaction, PaymentRequest                     │
│  │   ])                                                        │
│  ├── ConfigModule (M-Pesa credentials, payment config)         │
│  ├── HttpModule (M-Pesa API calls)                             │
│  └── CommonModule (guards, filters)                            │
│                                                                 │
│  EXPORTS:                                                       │
│  ├── PaymentService                                            │
│  ├── WalletService                                             │
│  └── MpesaService                                              │
│                                                                 │
│  CONSUMERS:                                                     │
│  ├── PolicyModule (policy trigger events)                      │
│  ├── NotificationModule (payment confirmations)                │
│  ├── UssdModule (balance inquiries, payments)                  │
│  └── SchedulerModule (expire stale requests)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│       User          │       │       Policy        │
│  (Identity Module)  │       │  (Policy Module)    │
└─────────┬───────────┘       └──────────▲──────────┘
          │                              │
          │ 1:1                          │ 1:N
          ▼                              │
┌─────────────────────┐                  │
│       Wallet        │                  │
│  ─────────────────  │                  │
│  id (UUID, PK)      │                  │
│  userId (UUID, UK)  │                  │
│  status (enum)      │                  │
│  balance (bigint)   │                  │
│  depositCompleted   │                  │
│  dailyPaymentsCount │                  │
│  ...                │                  │
└─────────┬───────────┘                  │
          │                              │
          │ 1:N                          │
          ▼                              │
┌─────────────────────┐                  │
│    Transaction      │──────────────────┘
│  ─────────────────  │
│  id (UUID, PK)      │
│  userId (UUID)      │
│  walletId (UUID,FK) │
│  type (enum)        │
│  status (enum)      │
│  amount (bigint)    │
│  mpesaReceiptNumber │
│  policyId (UUID)    │
│  ...                │
└─────────────────────┘
          ▲
          │ 1:1
          │
┌─────────────────────┐
│   PaymentRequest    │
│  ─────────────────  │
│  id (UUID, PK)      │
│  userId (UUID)      │
│  status (enum)      │
│  checkoutRequestId  │
│  transactionId (FK) │
│  ...                │
└─────────────────────┘
```

### 3.2 Wallet Entity

Tracks user payment balances and progress toward policy eligibility.

```typescript
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE
  })
  status: WalletStatus;  // ACTIVE | FROZEN | SUSPENDED | LAPSED

  @Column({ type: 'bigint', default: 0 })
  balance: number;  // Stored in cents (KES × 100)

  @Column({ type: 'bigint', default: 0 })
  totalDeposited: number;

  @Column({ type: 'bigint', default: 0 })
  totalPaid: number;

  @Column({ default: false })
  depositCompleted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  depositCompletedAt: Date;

  @Column({ type: 'int', default: 0 })
  dailyPaymentsCount: number;  // 0-30

  @Column({ type: 'timestamptz', nullable: true })
  lastDailyPaymentAt: Date;

  @Column({ default: false })
  dailyPaymentsCompleted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  dailyPaymentsCompletedAt: Date;

  @Column({ length: 3, default: 'KES' })
  currency: string;

  @VersionColumn()
  version: number;  // Optimistic locking

  // Helper methods
  getBalanceInKes(): number;
  getRemainingDailyPayments(): number;
  getDailyPaymentProgress(): number;
}
```

**Wallet Status State Machine:**

```
                    ┌──────────────┐
                    │    ACTIVE    │◄──────────────┐
                    │   (default)  │               │
                    └──────┬───────┘               │
                           │                       │
          ┌────────────────┼────────────────┐      │
          │                │                │      │
          ▼                ▼                ▼      │
   ┌──────────┐     ┌──────────┐     ┌──────────┐ │
   │  FROZEN  │     │SUSPENDED │     │  LAPSED  │ │
   │(temp hold)│     │ (fraud)  │     │(expired) │ │
   └────┬─────┘     └──────────┘     └──────────┘ │
        │                                          │
        └──────────────────────────────────────────┘
                    (unfreeze)
```

### 3.3 Transaction Entity

Immutable record of all financial transactions.

```typescript
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  DAILY_PAYMENT = 'DAILY_PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED'
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: 'PENDING' })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: PaymentProvider, default: 'MPESA' })
  provider: PaymentProvider;  // MPESA | MANUAL

  @Column({ type: 'bigint' })
  amount: number;  // In cents

  @Column({ length: 3, default: 'KES' })
  currency: string;

  @Column({ length: 15, nullable: true })
  phone: string;  // E.164 format

  @Column({ length: 50, nullable: true, unique: true })
  mpesaReceiptNumber: string;

  @Column({ length: 100, nullable: true })
  mpesaCheckoutRequestId: string;

  @Column({ length: 100, nullable: true, unique: true })
  idempotencyKey: string;

  @Column({ type: 'int', nullable: true })
  dailyPaymentNumber: number;  // 1-30

  @Column({ type: 'int', default: 1 })
  daysCount: number;  // For multi-day payments

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'uuid', nullable: true })
  policyId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  // Helper methods
  getAmountInKes(): number;
  isSuccessful(): boolean;
  isPending(): boolean;
}
```

### 3.4 PaymentRequest Entity

Tracks M-Pesa STK Push request lifecycle.

```typescript
export enum PaymentRequestStatus {
  INITIATED = 'INITIATED',   // Created, not yet sent to M-Pesa
  SENT = 'SENT',             // STK Push sent, waiting for user
  COMPLETED = 'COMPLETED',   // Payment successful
  FAILED = 'FAILED',         // Payment failed
  CANCELLED = 'CANCELLED',   // User cancelled on phone
  TIMEOUT = 'TIMEOUT',       // User didn't respond in time
  EXPIRED = 'EXPIRED'        // Request expired before callback
}

@Entity('payment_requests')
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: PaymentRequestStatus, default: 'INITIATED' })
  status: PaymentRequestStatus;

  @Column({ type: 'enum', enum: TransactionType })
  paymentType: TransactionType;

  @Column({ type: 'bigint' })
  amount: number;  // In cents

  @Column({ length: 15 })
  phone: string;

  @Column({ length: 100, unique: true })
  idempotencyKey: string;

  @Column({ length: 100, nullable: true, unique: true })
  checkoutRequestId: string;  // M-Pesa's reference

  @Column({ length: 100, nullable: true })
  merchantRequestId: string;

  @Column({ length: 50, nullable: true })
  mpesaReceiptNumber: string;

  @Column({ type: 'uuid', nullable: true })
  transactionId: string;  // Created on success

  @Column({ type: 'int', default: 1 })
  daysCount: number;

  @Column({ length: 50 })
  accountReference: string;  // Display on user's phone

  @Column({ length: 100 })
  transactionDesc: string;

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload: Record<string, any>;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;  // STK Push timeout (120 seconds)

  // Helper methods
  isExpired(): boolean;
  isPending(): boolean;
  isSuccessful(): boolean;
}
```

---

## 4. Service Layer

### 4.1 Service Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐                                       │
│  │   PaymentService    │ ← Orchestrates payment flows          │
│  │  ─────────────────  │                                       │
│  │  • initiatePayment  │                                       │
│  │  • processCallback  │                                       │
│  │  • getTransactions  │                                       │
│  └──────────┬──────────┘                                       │
│             │                                                   │
│             │ uses                                              │
│             ▼                                                   │
│  ┌─────────────────────┐     ┌─────────────────────┐          │
│  │   WalletService     │     │    MpesaService     │          │
│  │  ─────────────────  │     │  ─────────────────  │          │
│  │  • getOrCreate      │     │  • initiateSTKPush  │          │
│  │  • creditWallet     │     │  • querySTKStatus   │          │
│  │  • recordPayments   │     │  • initiateB2C      │          │
│  │  • getGracePeriod   │     │  • parseCallback    │          │
│  └─────────────────────┘     └─────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 PaymentService

The central orchestrator for all payment operations.

```typescript
@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentRequest)
    private paymentRequestRepo: Repository<PaymentRequest>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    private walletService: WalletService,
    private mpesaService: MpesaService,
    private dataSource: DataSource
  ) {}

  // Payment Initiation
  async initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;

  // Callback Processing
  async processCallback(callbackData: ParsedCallbackData): Promise<CallbackProcessResult>;

  // Query Operations
  async getPaymentRequest(requestId: string): Promise<PaymentRequest | null>;
  async getPaymentRequestByCheckoutId(checkoutRequestId: string): Promise<PaymentRequest | null>;
  async getTransactionHistory(userId: string, options?): Promise<PaginatedResult<Transaction>>;
  async getTransaction(transactionId: string): Promise<Transaction | null>;

  // Maintenance
  async expireStaleRequests(): Promise<number>;

  // Configuration
  isMpesaConfigured(): boolean;
}
```

**Key Method: initiatePayment()**

```typescript
async initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
  // 1. Check idempotency - return cached result if exists
  const existing = await this.paymentRequestRepo.findOne({
    where: { idempotencyKey: request.idempotencyKey }
  });
  if (existing) {
    return this.formatExistingResult(existing);
  }

  // 2. Get or create wallet
  const wallet = await this.walletService.getOrCreateWallet(request.userId);

  // 3. Validate payment eligibility
  if (request.type === TransactionType.DEPOSIT) {
    const eligibility = await this.walletService.canMakeDeposit(request.userId);
    if (!eligibility.allowed) {
      return { success: false, message: eligibility.reason };
    }
  } else {
    const eligibility = await this.walletService.canMakeDailyPayment(request.userId);
    if (!eligibility.allowed) {
      return { success: false, message: eligibility.reason };
    }
  }

  // 4. Calculate amount
  const amount = this.calculateAmount(request.type, request.daysCount);

  // 5. Create PaymentRequest record
  const paymentRequest = await this.paymentRequestRepo.save({
    userId: request.userId,
    status: PaymentRequestStatus.INITIATED,
    paymentType: request.type,
    amount,
    phone: request.phone,
    idempotencyKey: request.idempotencyKey,
    daysCount: request.daysCount ?? 1,
    accountReference: this.generateAccountRef(request.type, wallet),
    transactionDesc: this.generateDescription(request.type, request.daysCount),
    expiresAt: new Date(Date.now() + 120 * 1000)
  });

  // 6. Initiate M-Pesa STK Push
  const stkResult = await this.mpesaService.initiateSTKPush({
    phone: request.phone,
    amount: amount / 100,  // Convert cents to KES
    accountReference: paymentRequest.accountReference,
    transactionDesc: paymentRequest.transactionDesc
  });

  // 7. Update PaymentRequest with M-Pesa response
  paymentRequest.status = stkResult.success
    ? PaymentRequestStatus.SENT
    : PaymentRequestStatus.FAILED;
  paymentRequest.checkoutRequestId = stkResult.checkoutRequestId;
  paymentRequest.merchantRequestId = stkResult.merchantRequestId;
  await this.paymentRequestRepo.save(paymentRequest);

  return {
    success: stkResult.success,
    paymentRequestId: paymentRequest.id,
    checkoutRequestId: stkResult.checkoutRequestId,
    amount: amount / 100,
    message: stkResult.success ? 'Payment initiated' : stkResult.message,
    status: paymentRequest.status
  };
}
```

**Key Method: processCallback()**

```typescript
async processCallback(callbackData: ParsedCallbackData): Promise<CallbackProcessResult> {
  // 1. Find PaymentRequest
  const paymentRequest = await this.paymentRequestRepo.findOne({
    where: { checkoutRequestId: callbackData.checkoutRequestId }
  });

  if (!paymentRequest) {
    return { success: false, message: 'Payment request not found' };
  }

  // 2. Check if already processed (idempotency)
  if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
    return {
      success: true,
      transactionId: paymentRequest.transactionId,
      message: 'Already processed'
    };
  }

  // 3. Update with callback data
  paymentRequest.callbackPayload = callbackData;
  paymentRequest.callbackReceivedAt = new Date();

  // 4. Handle failure
  if (!callbackData.isSuccessful) {
    paymentRequest.status = this.mapResultCodeToStatus(callbackData.resultCode);
    await this.paymentRequestRepo.save(paymentRequest);
    return { success: false, message: callbackData.resultDesc };
  }

  // 5. Process successful payment in transaction
  return this.dataSource.transaction(async (manager) => {
    // Lock wallet for update
    const wallet = await manager.findOne(Wallet, {
      where: { userId: paymentRequest.userId },
      lock: { mode: 'pessimistic_write' }
    });

    // Create Transaction record
    const transaction = await manager.save(Transaction, {
      userId: paymentRequest.userId,
      walletId: wallet.id,
      type: paymentRequest.paymentType,
      status: TransactionStatus.COMPLETED,
      provider: PaymentProvider.MPESA,
      amount: paymentRequest.amount,
      phone: paymentRequest.phone,
      mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
      mpesaCheckoutRequestId: callbackData.checkoutRequestId,
      idempotencyKey: paymentRequest.idempotencyKey,
      daysCount: paymentRequest.daysCount,
      completedAt: new Date()
    });

    // Update wallet
    wallet.balance += paymentRequest.amount;
    wallet.totalDeposited += paymentRequest.amount;

    let triggeredPolicy: 'POLICY_1' | 'POLICY_2' | undefined;

    if (paymentRequest.paymentType === TransactionType.DEPOSIT) {
      wallet.depositCompleted = true;
      wallet.depositCompletedAt = new Date();
      triggeredPolicy = 'POLICY_1';
    } else {
      const prevCount = wallet.dailyPaymentsCount;
      wallet.dailyPaymentsCount = Math.min(prevCount + paymentRequest.daysCount, 30);
      wallet.lastDailyPaymentAt = new Date();
      transaction.dailyPaymentNumber = wallet.dailyPaymentsCount;

      if (wallet.dailyPaymentsCount >= 30 && !wallet.dailyPaymentsCompleted) {
        wallet.dailyPaymentsCompleted = true;
        wallet.dailyPaymentsCompletedAt = new Date();
        triggeredPolicy = 'POLICY_2';
      }
    }

    await manager.save(wallet);
    await manager.save(transaction);

    // Update PaymentRequest
    paymentRequest.status = PaymentRequestStatus.COMPLETED;
    paymentRequest.transactionId = transaction.id;
    paymentRequest.mpesaReceiptNumber = callbackData.mpesaReceiptNumber;
    await manager.save(paymentRequest);

    return {
      success: true,
      transactionId: transaction.id,
      paymentRequestId: paymentRequest.id,
      message: 'Payment processed successfully',
      triggeredPolicy
    };
  });
}
```

### 4.3 WalletService

Manages wallet lifecycle and payment progress.

```typescript
@Injectable()
export class WalletService {
  private readonly GRACE_PERIOD_DAYS = 7;

  // Wallet Lifecycle
  async getOrCreateWallet(userId: string): Promise<Wallet>;
  async getWalletByUserId(userId: string): Promise<Wallet | null>;
  async getBalance(userId: string): Promise<WalletBalanceInfo>;

  // Balance Operations (with pessimistic locking)
  async creditWallet(userId: string, amountCents: number): Promise<Wallet>;
  async debitWallet(userId: string, amountCents: number): Promise<Wallet>;

  // Payment Progress
  async markDepositCompleted(userId: string): Promise<Wallet>;
  async recordDailyPayments(userId: string, daysCount: number): Promise<Wallet>;
  async getPaymentProgress(userId: string): Promise<PaymentProgressInfo>;

  // Eligibility Checks
  async canMakeDeposit(userId: string): Promise<EligibilityResult>;
  async canMakeDailyPayment(userId: string): Promise<EligibilityResult>;

  // Status Management
  async freezeWallet(userId: string, reason?: string): Promise<Wallet>;
  async unfreezeWallet(userId: string): Promise<Wallet>;

  // Grace Period (per GAP-010)
  async getGracePeriodStatus(userId: string, policyExpiryDate?: Date): Promise<GracePeriodInfo>;
  async checkAndUpdateLapseStatus(userId: string, policyExpiryDate?: Date): Promise<LapseCheckResult>;
  async getWalletsInGracePeriod(): Promise<Wallet[]>;
}
```

**Payment Progress Response:**

```typescript
interface PaymentProgressInfo {
  depositCompleted: boolean;
  depositAmount: number;           // 1,048 KES
  dailyPaymentsCount: number;      // 0-30
  dailyPaymentsRemaining: number;  // 30 - count
  dailyPaymentsCompleted: boolean;
  dailyAmount: number;             // 87 KES
  totalPaid: number;               // KES
  totalRequired: number;           // 3,658 KES
  progressPercentage: number;      // 0-100
  policy1Eligible: boolean;        // deposit completed
  policy2Eligible: boolean;        // all 30 daily payments
}
```

### 4.4 MpesaService

Handles all M-Pesa Daraja API interactions.

```typescript
@Injectable()
export class MpesaService {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  // Authentication
  async getAccessToken(): Promise<string>;

  // STK Push (Customer-to-Business)
  async initiateSTKPush(request: StkPushRequest): Promise<StkPushResponse>;
  async querySTKStatus(checkoutRequestId: string): Promise<StkQueryResponse>;
  parseCallback(body: MpesaCallbackBody): ParsedCallbackData;

  // B2C (Business-to-Customer) - Refunds
  async initiateB2C(request: B2cRequest): Promise<B2cResponse>;
  async processRefund(request: RefundRequest): Promise<RefundResponse>;
  parseB2cCallback(body: B2cCallbackBody): ParsedB2cCallbackData;

  // Utilities
  formatPhoneNumber(phone: string): string;
  isConfigured(): boolean;
  isB2cConfigured(): boolean;
}
```

**M-Pesa API Endpoints:**

| Environment | Auth URL | STK Push URL | B2C URL |
|-------------|----------|--------------|---------|
| Sandbox | sandbox.safaricom.co.ke/oauth/v1/generate | sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest | sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest |
| Production | api.safaricom.co.ke/oauth/v1/generate | api.safaricom.co.ke/mpesa/stkpush/v1/processrequest | api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest |

---

## 5. API Endpoints

### 5.1 Payment Controller

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT ENDPOINTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/payments/deposit                                  │
│  ├── Auth: JWT Required                                        │
│  ├── Body: { phone: string, idempotencyKey: string }           │
│  ├── Response: InitiatePaymentResponseDto                      │
│  └── Purpose: Initiate 1,048 KES deposit payment               │
│                                                                 │
│  POST /api/v1/payments/daily                                    │
│  ├── Auth: JWT Required                                        │
│  ├── Body: { phone, idempotencyKey, daysCount?: 1-30 }        │
│  ├── Response: InitiatePaymentResponseDto                      │
│  └── Purpose: Initiate daily payment(s) (87 KES × days)       │
│                                                                 │
│  GET /api/v1/payments/status/:requestId                        │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PaymentStatusResponseDto                        │
│  └── Purpose: Check payment request status                     │
│                                                                 │
│  GET /api/v1/payments/eligibility/deposit                      │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PaymentEligibilityResponseDto                   │
│  └── Purpose: Check if user can make deposit                   │
│                                                                 │
│  GET /api/v1/payments/eligibility/daily                        │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PaymentEligibilityResponseDto                   │
│  └── Purpose: Check if user can make daily payment             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Wallet Controller

```
┌─────────────────────────────────────────────────────────────────┐
│                    WALLET ENDPOINTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/v1/wallet/balance                                     │
│  ├── Auth: JWT Required                                        │
│  ├── Response: WalletBalanceResponseDto                        │
│  └── Purpose: Get current wallet balance and status            │
│                                                                 │
│  GET /api/v1/wallet/progress                                    │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PaymentProgressResponseDto                      │
│  └── Purpose: Get detailed payment progress                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Transaction Controller

```
┌─────────────────────────────────────────────────────────────────┐
│                  TRANSACTION ENDPOINTS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/v1/transactions                                       │
│  ├── Auth: JWT Required                                        │
│  ├── Query: page, limit (max 100), type (optional)             │
│  ├── Response: Paginated transaction list                      │
│  └── Purpose: Get user's transaction history                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 M-Pesa Callback Controller

```
┌─────────────────────────────────────────────────────────────────┐
│                   CALLBACK ENDPOINTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/mpesa/callback                                    │
│  ├── Auth: None (public webhook)                               │
│  ├── Body: M-Pesa callback payload                             │
│  ├── Response: { ResultCode: 0, ResultDesc: 'Accepted' }       │
│  └── Purpose: Handle STK Push completion                       │
│                                                                 │
│  POST /api/v1/mpesa/validation                                  │
│  ├── Auth: None (public webhook)                               │
│  ├── Response: { ResultCode: 0, ResultDesc: 'Accepted' }       │
│  └── Purpose: Optional M-Pesa validation callback              │
│                                                                 │
│  POST /api/v1/mpesa/b2c/result                                  │
│  ├── Auth: None (public webhook)                               │
│  └── Purpose: Handle B2C (refund) completion                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Payment Flows

### 6.1 Deposit Payment Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │   API   │     │ Payment │     │ M-Pesa  │     │ Wallet  │
│  App    │     │ Gateway │     │ Service │     │ Daraja  │     │ Service │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ POST /payments/deposit        │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │               │ initiatePayment()             │               │
     │               │──────────────>│               │               │
     │               │               │               │               │
     │               │               │ canMakeDeposit()              │
     │               │               │──────────────────────────────>│
     │               │               │               │               │
     │               │               │<──────────────────────────────│
     │               │               │  { allowed: true }            │
     │               │               │               │               │
     │               │               │ Create PaymentRequest         │
     │               │               │──────┐        │               │
     │               │               │      │        │               │
     │               │               │<─────┘        │               │
     │               │               │               │               │
     │               │               │ initiateSTKPush()             │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │<──────────────│               │
     │               │               │ checkoutRequestId             │
     │               │               │               │               │
     │               │<──────────────│               │               │
     │<──────────────│ { paymentRequestId, checkoutRequestId }      │
     │               │               │               │               │
     │   User enters M-Pesa PIN     │               │               │
     │   on their phone              │               │               │
     │               │               │               │               │
     │               │               │  M-Pesa Callback              │
     │               │               │<──────────────│               │
     │               │               │               │               │
     │               │               │ processCallback()             │
     │               │               │──────┐        │               │
     │               │               │      │        │               │
     │               │               │ DB Transaction:               │
     │               │               │ - Lock wallet                 │
     │               │               │ - Create Transaction          │
     │               │               │ - Update wallet balance       │
     │               │               │ - Mark deposit complete       │
     │               │               │<─────┘        │               │
     │               │               │               │               │
     │               │               │ Return: triggeredPolicy=POLICY_1
     │               │               │               │               │
     │  SMS: Payment confirmed       │               │               │
     │<──────────────────────────────│               │               │
     │               │               │               │               │
```

### 6.2 Daily Payment Flow (Multi-Day)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │   API   │     │ Payment │     │ M-Pesa  │     │ Policy  │
│  App    │     │ Gateway │     │ Service │     │ Daraja  │     │ Module  │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ POST /payments/daily          │               │               │
     │ { daysCount: 5 }              │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │               │ initiatePayment()             │               │
     │               │──────────────>│               │               │
     │               │               │               │               │
     │               │               │ Validate:                     │
     │               │               │ - Deposit completed? ✓        │
     │               │               │ - Daily payments < 30? ✓      │
     │               │               │ - daysCount valid? ✓          │
     │               │               │               │               │
     │               │               │ Calculate: 87 × 5 = 435 KES   │
     │               │               │               │               │
     │               │               │ initiateSTKPush()             │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │<──────────────│               │
     │               │<──────────────│               │               │
     │<──────────────│               │               │               │
     │               │               │               │               │
     │   User enters M-Pesa PIN     │               │               │
     │               │               │               │               │
     │               │               │  Callback     │               │
     │               │               │<──────────────│               │
     │               │               │               │               │
     │               │               │ processCallback()             │
     │               │               │ - Previous count: 25          │
     │               │               │ - New count: min(25+5,30)=30  │
     │               │               │ - All 30 complete!            │
     │               │               │               │               │
     │               │               │ Trigger Policy 2              │
     │               │               │──────────────────────────────>│
     │               │               │               │               │
     │               │               │               │    Create     │
     │               │               │               │    Policy 2   │
     │               │               │               │    (11-month) │
     │               │               │               │               │
     │  SMS: All payments complete!  │               │               │
     │  Your 11-month policy issued. │               │               │
     │<──────────────────────────────│               │               │
     │               │               │               │               │
```

### 6.3 M-Pesa Callback Processing

```
┌─────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────┐
│ M-Pesa  │     │  Callback   │     │ Payment │     │Database │
│  API    │     │ Controller  │     │ Service │     │         │
└────┬────┘     └──────┬──────┘     └────┬────┘     └────┬────┘
     │                 │                 │               │
     │ POST /mpesa/callback              │               │
     │────────────────>│                 │               │
     │                 │                 │               │
     │                 │ parseCallback() │               │
     │                 │────────────────>│               │
     │                 │                 │               │
     │                 │<────────────────│               │
     │                 │  ParsedData     │               │
     │                 │                 │               │
     │                 │ processCallback()               │
     │                 │────────────────>│               │
     │                 │                 │               │
     │                 │                 │ Find PaymentRequest
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │<──────────────│
     │                 │                 │               │
     │                 │                 │ BEGIN TRANSACTION
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │ Lock Wallet   │
     │                 │                 │ (SELECT FOR UPDATE)
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │ Insert Transaction
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │ Update Wallet │
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │ Update PaymentRequest
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │ COMMIT        │
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │<────────────────│               │
     │                 │  { success: true }              │
     │                 │                 │               │
     │<────────────────│                 │               │
     │ { ResultCode: 0 }                 │               │
     │                 │                 │               │
```

### 6.4 PaymentRequest Status Flow

```
                          ┌───────────────┐
                          │   INITIATED   │
                          │ (record created)
                          └───────┬───────┘
                                  │
                                  │ STK Push sent
                                  ▼
                          ┌───────────────┐
                          │     SENT      │
                          │ (waiting for  │
                          │  user PIN)    │
                          └───────┬───────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
   │   COMPLETED   │      │   CANCELLED   │      │    TIMEOUT    │
   │ (ResultCode=0)│      │(ResultCode=   │      │(ResultCode=   │
   │               │      │ 1032)         │      │ 1037/1036)    │
   └───────────────┘      └───────────────┘      └───────────────┘
                                  │
                                  │
                                  ▼
                          ┌───────────────┐
                          │    FAILED     │
                          │ (other codes) │
                          └───────────────┘

                          ┌───────────────┐
                          │    EXPIRED    │
                          │ (SENT status  │
                          │ past timeout) │
                          └───────────────┘
                                  ▲
                                  │
                          Scheduler job:
                          expireStaleRequests()
```

---

## 7. Error Handling

### 7.1 Payment Error Scenarios

| Scenario | Error Code | User Message | System Action |
|----------|------------|--------------|---------------|
| Duplicate idempotency key | N/A | Return cached result | Skip processing |
| Deposit already completed | DEPOSIT_COMPLETED | "Deposit already made" | Reject request |
| Daily payments completed | DAILY_COMPLETE | "All payments complete" | Reject request |
| Wallet frozen | WALLET_FROZEN | "Account temporarily frozen" | Reject request |
| M-Pesa unavailable | MPESA_ERROR | "Payment service unavailable" | Log, retry later |
| User cancelled | 1032 | "Payment cancelled" | Mark CANCELLED |
| User timeout | 1037 | "Payment timed out" | Mark TIMEOUT |
| Insufficient balance | 1 | "Insufficient M-Pesa balance" | Mark FAILED |

### 7.2 Idempotency Protection

```typescript
// Every payment initiation requires unique idempotency key
POST /payments/deposit
{
  "phone": "0712345678",
  "idempotencyKey": "dep-user123-20241215-001"  // Required
}

// If same key submitted again:
// - Returns cached result
// - No duplicate charge
// - Same response as original
```

### 7.3 Transaction Consistency

All payment processing uses database transactions with pessimistic locking:

```typescript
// Ensures atomic operations
await this.dataSource.transaction(async (manager) => {
  // 1. Lock wallet row
  const wallet = await manager.findOne(Wallet, {
    where: { userId },
    lock: { mode: 'pessimistic_write' }
  });

  // 2. All updates in same transaction
  // - Create transaction record
  // - Update wallet balance
  // - Update payment request

  // 3. Commit or rollback together
});
```

---

## 8. Configuration

### 8.1 Environment Variables

```bash
# M-Pesa STK Push Configuration
MPESA_ENVIRONMENT=sandbox|production
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://api.bodainsure.com/api/v1/mpesa/callback

# M-Pesa B2C Configuration (Refunds)
MPESA_B2C_SHORTCODE=600000
MPESA_B2C_INITIATOR_NAME=initiator
MPESA_B2C_SECURITY_CREDENTIAL=credential
MPESA_B2C_RESULT_URL=https://api.bodainsure.com/api/v1/mpesa/b2c/result
MPESA_B2C_TIMEOUT_URL=https://api.bodainsure.com/api/v1/mpesa/b2c/timeout
```

### 8.2 Payment Constants

```typescript
// From PAYMENT_CONFIG
export const PAYMENT_CONFIG = {
  DEPOSIT_AMOUNT: 1048,        // KES
  DAILY_AMOUNT: 87,            // KES
  TOTAL_DAILY_PAYMENTS: 30,    // Days
  TOTAL_ANNUAL: 3658,          // KES (1048 + 87×30)

  // Timing
  STK_TIMEOUT_SECONDS: 120,
  MAX_CALLBACK_RETRIES: 3,

  // Grace period (GAP-010)
  GRACE_PERIOD_DAYS: 7
};
```

---

## 9. Security Considerations

### 9.1 M-Pesa Callback Security

```
┌─────────────────────────────────────────────────────────────────┐
│                    CALLBACK SECURITY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. HTTPS Only                                                 │
│     • All callbacks must use HTTPS                             │
│     • TLS 1.2+ required                                        │
│                                                                 │
│  2. IP Whitelisting (Production)                               │
│     • Only accept from Safaricom IPs                           │
│     • Configure at load balancer/WAF                           │
│                                                                 │
│  3. Idempotency                                                │
│     • Track checkoutRequestId to prevent replay                │
│     • Return cached result for duplicates                      │
│                                                                 │
│  4. Always Return 200                                          │
│     • Prevent M-Pesa retries                                   │
│     • Log failures internally                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Financial Data Protection

| Data | Protection | Storage |
|------|------------|---------|
| Phone numbers | Masked in logs (last 4) | Encrypted at rest |
| M-Pesa receipts | Full audit trail | Encrypted at rest |
| Transaction amounts | Full audit trail | Plaintext (non-PII) |
| Wallet balances | Optimistic locking | Encrypted at rest |

### 9.3 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /payments/deposit | 3 requests | Per hour per user |
| POST /payments/daily | 10 requests | Per hour per user |
| GET /wallet/balance | 60 requests | Per minute per user |

---

## 10. Integration Points

### 10.1 Module Dependencies

```
Payment Module
    │
    ├──► Identity Module
    │    └── User authentication, user lookup
    │
    ├──► Policy Module
    │    └── Trigger policy issuance on payment completion
    │
    ├──► Notification Module
    │    └── Send payment confirmations (SMS, WhatsApp)
    │
    ├──► Queue Module
    │    └── Async processing of payment notifications
    │
    ├──► Audit Module
    │    └── Log all payment events
    │
    └──► Scheduler Module
         └── Expire stale payment requests
```

### 10.2 External Integrations

| System | Purpose | Protocol |
|--------|---------|----------|
| M-Pesa Daraja API | Payment processing | REST/HTTPS |
| M-Pesa Callback | Payment confirmation | Webhook/HTTPS |

---

## 11. Testing

### 11.1 Test Coverage

| Component | Unit Tests | Integration Tests |
|-----------|------------|-------------------|
| PaymentService | payment.service.spec.ts | ✓ |
| WalletService | wallet.service.spec.ts | ✓ |
| MpesaService | mpesa.service.spec.ts | ✓ |

### 11.2 Critical Test Scenarios

- [ ] Deposit payment success flow
- [ ] Deposit payment failure handling
- [ ] Daily payment success flow
- [ ] Multiple days payment
- [ ] Payment idempotency
- [ ] M-Pesa callback processing
- [ ] Wallet balance accuracy
- [ ] Policy trigger on 30th payment
- [ ] Grace period calculation
- [ ] Wallet status transitions

---

## 12. Appendix

### 12.1 M-Pesa Result Codes

| Code | Description | PaymentRequestStatus |
|------|-------------|---------------------|
| 0 | Success | COMPLETED |
| 1 | Insufficient balance | FAILED |
| 1032 | User cancelled | CANCELLED |
| 1036 | STK already in progress | TIMEOUT |
| 1037 | Request timeout | TIMEOUT |
| Other | Various failures | FAILED |

### 12.2 Phone Number Formats

```
Input Formats (all valid):
• 0712345678
• +254712345678
• 254712345678

Output Format (M-Pesa):
• 254712345678
```
