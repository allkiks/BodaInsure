# Policy Module Architecture

## 1. Module Overview

### 1.1 Purpose and Scope

The Policy module manages the complete lifecycle of insurance policies in the BodaInsure platform. It implements the innovative two-policy model, handles batch processing for policy issuance, generates PDF certificates, and ensures regulatory compliance with IRA (Insurance Regulatory Authority) requirements.

### 1.2 Business Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    TWO-POLICY MODEL                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POLICY 1: ONE_MONTH (1,048 KES deposit)                │   │
│  │  ───────────────────────────────────────                │   │
│  │  • Triggered by: Initial deposit payment                │   │
│  │  • Coverage: 1 month from issuance                      │   │
│  │  • Policy Number: BDA-YYMM-NNNNNN                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POLICY 2: ELEVEN_MONTH (87 KES × 30 = 2,610 KES)       │   │
│  │  ───────────────────────────────────────────────        │   │
│  │  • Triggered by: 30th daily payment                     │   │
│  │  • Coverage: 11 months from issuance                    │   │
│  │  • Policy Number: BDB-YYMM-NNNNNN                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Total Annual Coverage: 12 months for 3,658 KES                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Policy Issuance** | Create policies based on payment events |
| **Batch Processing** | 3x daily batch processing (08:00, 14:00, 20:00 EAT) |
| **PDF Generation** | Generate policy certificates with PDFKit |
| **Lifecycle Management** | Status transitions from pending to expired |
| **Compliance** | IRA two-policy limit, 30-day free look, terms acknowledgment |
| **Document Delivery** | Multi-channel delivery (WhatsApp, SMS, Email) |

---

## 2. Module Structure

### 2.1 File Organization

```
src/modules/policy/
├── policy.module.ts                      # Module definition
├── controllers/
│   ├── index.ts                          # Controller exports
│   ├── policy.controller.ts              # User policy endpoints
│   ├── policy-batch.controller.ts        # Admin batch endpoints
│   └── policy-terms.controller.ts        # Terms management endpoints
├── services/
│   ├── index.ts                          # Service exports
│   ├── policy.service.ts                 # User-facing operations
│   ├── policy.service.spec.ts            # Policy service tests
│   ├── batch-processing.service.ts       # Batch issuance logic
│   ├── batch-processing.service.spec.ts  # Batch processing tests
│   ├── pdf-generation.service.ts         # PDF certificate generation
│   ├── pdf-generation.service.spec.ts    # PDF generation tests
│   └── policy-terms.service.ts           # Terms and compliance
├── entities/
│   ├── index.ts                          # Entity exports
│   ├── policy.entity.ts                  # Core policy entity
│   ├── policy-document.entity.ts         # Document tracking
│   ├── policy-batch.entity.ts            # Batch processing
│   └── policy-terms.entity.ts            # Terms and acknowledgments
└── dto/
    ├── policy-response.dto.ts            # Response DTOs
    └── create-policy-terms.dto.ts        # Terms creation DTO
```

### 2.2 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                      POLICY MODULE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IMPORTS:                                                       │
│  ├── TypeOrmModule.forFeature([                                │
│  │     Policy, PolicyDocument, PolicyBatch,                    │
│  │     PolicyTerms, PolicyTermsAcknowledgment                  │
│  │   ])                                                        │
│  ├── ConfigModule                                              │
│  ├── StorageModule (S3/document storage)                       │
│  └── CommonModule (guards, filters)                            │
│                                                                 │
│  EXPORTS:                                                       │
│  ├── PolicyService                                             │
│  ├── BatchProcessingService                                    │
│  ├── PdfGenerationService                                      │
│  └── PolicyTermsService                                        │
│                                                                 │
│  CONSUMERS:                                                     │
│  ├── PaymentModule (triggers policy issuance)                  │
│  ├── NotificationModule (delivery confirmations)               │
│  ├── QueueModule (async PDF generation)                        │
│  ├── SchedulerModule (batch triggers, expiry checks)           │
│  └── UssdModule (policy status queries)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│        User         │       │     Transaction     │
│  (Identity Module)  │       │  (Payment Module)   │
└─────────┬───────────┘       └──────────┬──────────┘
          │                              │
          │ 1:N                          │ 1:1
          ▼                              ▼
┌─────────────────────────────────────────────────────┐
│                      Policy                          │
│  ─────────────────────────────────────────────────  │
│  id (UUID, PK)                                      │
│  userId (UUID, FK)                                  │
│  policyType (ONE_MONTH | ELEVEN_MONTH)             │
│  status (enum)                                      │
│  policyNumber (varchar, unique)                     │
│  triggeringTransactionId (UUID)                     │
│  batchId (UUID, FK)                                │
│  ...                                                │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           │ 1:N                      │ N:1
           ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│   PolicyDocument    │    │     PolicyBatch     │
│  ─────────────────  │    │  ─────────────────  │
│  id (UUID, PK)      │    │  id (UUID, PK)      │
│  policyId (UUID,FK) │    │  batchNumber        │
│  documentType       │    │  schedule           │
│  status             │    │  status             │
│  storagePath        │    │  totalPolicies      │
│  ...                │    │  ...                │
└─────────────────────┘    └─────────────────────┘

┌─────────────────────┐    ┌─────────────────────────┐
│    PolicyTerms      │    │PolicyTermsAcknowledgment│
│  ─────────────────  │    │  ─────────────────────  │
│  id (UUID, PK)      │◄───│  termsId (UUID, FK)     │
│  version            │    │  userId (UUID, FK)      │
│  type               │    │  acknowledgedAt         │
│  content            │    │  ipAddress              │
│  isActive           │    │  termsChecksum          │
│  ...                │    │  ...                    │
└─────────────────────┘    └─────────────────────────┘
```

### 3.2 Policy Entity

The core entity representing insurance policies.

```typescript
export enum PolicyType {
  ONE_MONTH = 'ONE_MONTH',      // Initial deposit policy
  ELEVEN_MONTH = 'ELEVEN_MONTH' // Completion policy
}

export enum PolicyStatus {
  PENDING_ISSUANCE = 'PENDING_ISSUANCE',  // Awaiting batch
  PROCESSING = 'PROCESSING',               // In current batch
  ACTIVE = 'ACTIVE',                       // Coverage active
  EXPIRING = 'EXPIRING',                   // 30 days until expiry
  EXPIRED = 'EXPIRED',                     // Coverage ended
  LAPSED = 'LAPSED',                       // Payment default
  CANCELLED = 'CANCELLED'                  // User/admin cancelled
}

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: PolicyType })
  policyType: PolicyType;

  @Column({ type: 'enum', enum: PolicyStatus, default: 'PENDING_ISSUANCE' })
  status: PolicyStatus;

  @Column({ length: 50, unique: true, nullable: true })
  policyNumber: string;  // BDA-YYMM-NNNNNN or BDB-YYMM-NNNNNN

  @Column({ length: 50, nullable: true })
  certificateNumber: string;

  @Column({ type: 'uuid', nullable: true })
  batchId: string;

  @Column({ type: 'uuid' })
  triggeringTransactionId: string;

  @Column({ type: 'bigint' })
  premiumAmount: number;  // In cents

  @Column({ length: 3, default: 'KES' })
  currency: string;

  @Column({ type: 'timestamptz' })
  coverageStart: Date;

  @Column({ type: 'timestamptz' })
  coverageEnd: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  // Renewal chain
  @Column({ type: 'uuid', nullable: true })
  previousPolicyId: string;

  @Column({ type: 'uuid', nullable: true })
  nextPolicyId: string;

  // Insured details
  @Column({ length: 20, nullable: true })
  vehicleRegistration: string;

  @Column({ length: 200, nullable: true })
  insuredName: string;

  @Column({ length: 20, nullable: true })
  nationalId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isActive(): boolean { return ['ACTIVE', 'EXPIRING'].includes(this.status); }
  isPending(): boolean { return ['PENDING_ISSUANCE', 'PROCESSING'].includes(this.status); }
  getDaysUntilExpiry(): number;
  getPremiumInKes(): number { return this.premiumAmount / 100; }
  getDurationMonths(): number { return this.policyType === 'ONE_MONTH' ? 1 : 11; }
}
```

**Database Indexes:**

```sql
CREATE INDEX idx_policies_user_status ON policies(user_id, status);
CREATE UNIQUE INDEX idx_policies_number ON policies(policy_number) WHERE policy_number IS NOT NULL;
CREATE INDEX idx_policies_status_expires ON policies(status, expires_at);
CREATE INDEX idx_policies_vehicle ON policies(vehicle_registration);
```

### 3.3 PolicyDocument Entity

Tracks PDF generation and delivery status.

```typescript
export enum PolicyDocumentType {
  POLICY_CERTIFICATE = 'POLICY_CERTIFICATE',
  TERMS_CONDITIONS = 'TERMS_CONDITIONS',
  COVER_NOTE = 'COVER_NOTE',
  RECEIPT = 'RECEIPT'
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  GENERATED = 'GENERATED',
  FAILED = 'FAILED'
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

@Entity('policy_documents')
export class PolicyDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  policyId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: PolicyDocumentType })
  documentType: PolicyDocumentType;

  @Column({ type: 'enum', enum: DocumentStatus, default: 'PENDING' })
  status: DocumentStatus;

  @Column({ type: 'enum', enum: DeliveryStatus, default: 'PENDING' })
  deliveryStatus: DeliveryStatus;

  @Column({ length: 255 })
  fileName: string;

  @Column({ length: 100, default: 'application/pdf' })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ length: 500, nullable: true })
  storagePath: string;  // S3 key or local path

  @Column({ length: 100, nullable: true })
  storageBucket: string;

  @Column({ length: 64, nullable: true })
  contentHash: string;  // SHA-256

  @Column({ length: 1000, nullable: true })
  downloadUrl: string;

  @Column({ type: 'timestamptz', nullable: true })
  downloadUrlExpiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  generatedAt: Date;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  // Delivery tracking
  @Column({ default: false })
  whatsappSent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  whatsappSentAt: Date;

  @Column({ default: false })
  smsSent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  smsSentAt: Date;

  @Column({ default: false })
  emailSent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  emailSentAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  generationAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  generationData: Record<string, any>;  // Data used to regenerate

  // Helper methods
  isReady(): boolean;
  hasValidDownloadUrl(): boolean;
  wasDelivered(): boolean;
}
```

### 3.4 PolicyBatch Entity

Manages batch processing of policy issuance.

```typescript
export enum BatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum BatchSchedule {
  BATCH_1 = 'BATCH_1',  // 08:00 EAT
  BATCH_2 = 'BATCH_2',  // 14:00 EAT
  BATCH_3 = 'BATCH_3',  // 20:00 EAT
  MANUAL = 'MANUAL'
}

@Entity('policy_batches')
export class PolicyBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  batchNumber: string;  // BATCH-YYYYMMDD-N

  @Column({ type: 'enum', enum: BatchSchedule })
  schedule: BatchSchedule;

  @Column({ type: 'date' })
  batchDate: Date;

  @Column({ type: 'enum', enum: BatchStatus, default: 'PENDING' })
  status: BatchStatus;

  @Column({ type: 'timestamptz' })
  scheduledFor: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  // Payment window this batch covers
  @Column({ type: 'timestamptz' })
  paymentWindowStart: Date;

  @Column({ type: 'timestamptz' })
  paymentWindowEnd: Date;

  // Processing metrics
  @Column({ type: 'int', default: 0 })
  totalPolicies: number;

  @Column({ type: 'int', default: 0 })
  processedCount: number;

  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @Column({ type: 'int', default: 0 })
  oneMonthCount: number;

  @Column({ type: 'int', default: 0 })
  elevenMonthCount: number;

  @Column({ type: 'bigint', default: 0 })
  totalPremium: number;  // In cents

  @Column({ type: 'int', nullable: true })
  processingDurationMs: number;

  @Column({ type: 'jsonb', nullable: true })
  errorDetails: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  failedPolicies: Array<{ policyId: string; reason: string }>;

  @Column({ type: 'uuid', nullable: true })
  triggeredBy: string;  // Admin who triggered manual batch

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Helper methods
  isComplete(): boolean;
  isProcessing(): boolean;
  getSuccessRate(): number;
  static generateBatchNumber(date: Date, schedule: BatchSchedule): string;
}
```

### 3.5 PolicyTerms Entity

Versioned policy terms with acknowledgment tracking.

```typescript
export enum PolicyTermsType {
  TPO = 'TPO',                    // Third-Party Only
  COMPREHENSIVE = 'COMPREHENSIVE' // Future
}

@Entity('policy_terms')
export class PolicyTerms {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  version: string;  // e.g., "1.0", "2.0"

  @Column({ type: 'enum', enum: PolicyTermsType })
  type: PolicyTermsType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;  // Full HTML terms

  @Column({ type: 'text' })
  summary: string;  // Short summary for mobile/USSD

  // Swahili translations
  @Column({ type: 'text', nullable: true })
  contentSw: string;

  @Column({ type: 'text', nullable: true })
  summarySw: string;

  @Column({ type: 'jsonb', nullable: true })
  keyTerms: string[];

  @Column({ type: 'jsonb', nullable: true })
  keyTermsSw: string[];

  @Column({ type: 'jsonb', nullable: true })
  inclusions: string[];

  @Column({ type: 'jsonb', nullable: true })
  exclusions: string[];

  @Column({ type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 200, nullable: true })
  underwriterName: string;

  @Column({ length: 100, nullable: true })
  iraApprovalRef: string;

  @Column({ type: 'int', default: 30 })
  freeLookDays: number;

  @Column({ type: 'text', nullable: true })
  cancellationPolicy: string;

  @Column({ type: 'text', nullable: true })
  claimsProcess: string;

  @Column({ length: 500, nullable: true })
  pdfUrl: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  // Helper method
  isEffective(): boolean;
}

@Entity('policy_terms_acknowledgments')
export class PolicyTermsAcknowledgment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  termsId: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  acknowledgedAt: Date;

  @Column({ length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ length: 20 })
  channel: string;  // app, web, ussd

  @Column({ type: 'uuid', nullable: true })
  policyId: string;

  @Column({ type: 'text', nullable: true })
  consentText: string;

  @Column({ length: 64 })
  termsChecksum: string;  // SHA256 for change detection
}
```

---

## 4. Service Layer

### 4.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   PolicyService                          │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  User-facing operations:                                 │   │
│  │  • getUserPolicies()     • getActivePolicy()            │   │
│  │  • getPolicyDetails()    • cancelPolicy()               │   │
│  │  • getPolicyDocument()   • getUserPolicyStats()         │   │
│  └──────────────────────────────┬──────────────────────────┘   │
│                                 │                               │
│          ┌──────────────────────┼──────────────────────┐       │
│          │                      │                      │       │
│          ▼                      ▼                      ▼       │
│  ┌───────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │BatchProcessing│    │ PdfGeneration   │    │ PolicyTerms  │ │
│  │   Service     │    │   Service       │    │   Service    │ │
│  │ ───────────── │    │ ─────────────── │    │ ──────────── │ │
│  │• processBatch │    │• generatePDF    │    │• getTerms    │ │
│  │• createPolicy │    │• buildSections  │    │• acknowledge │ │
│  │• retryFailed  │    │• maskPII        │    │• validate    │ │
│  └───────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 PolicyService

User-facing policy operations.

```typescript
@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private policyRepo: Repository<Policy>,
    @InjectRepository(PolicyDocument)
    private documentRepo: Repository<PolicyDocument>,
    private storageService: StorageService
  ) {}

  // Policy Queries
  async getUserPolicies(userId: string): Promise<PolicySummary[]>;
  async getActivePolicy(userId: string): Promise<PolicyDetails | null>;
  async getPolicyDetails(policyId: string, userId: string): Promise<PolicyDetails>;
  async getPolicyDocument(policyId: string, userId: string): Promise<DocumentDownloadInfo>;
  async hasActivePolicy(userId: string, policyType?: PolicyType): Promise<boolean>;
  async getUserPolicyStats(userId: string): Promise<PolicyStats>;

  // Policy Issuance (called by Payment module)
  async queuePolicyIssuance(request: PolicyIssuanceRequest): Promise<Policy>;

  // Expiry Management (called by Scheduler)
  async getExpiringPolicies(daysUntilExpiry: number): Promise<Policy[]>;
  async updateExpiringPolicies(): Promise<number>;
  async expirePolicies(): Promise<number>;

  // Cancellation (IRA Free Look)
  async isWithinFreeLookPeriod(policy: Policy): Promise<boolean>;
  async cancelPolicy(policyId: string, userId: string, reason: string): Promise<CancellationResult>;
  async getCancellationPreview(policyId: string, userId: string): Promise<CancellationPreview>;

  // Internal
  async findById(policyId: string): Promise<Policy | null>;
  async updatePolicyStatus(policyId: string, status: PolicyStatus): Promise<Policy>;
}
```

**Policy Statistics Response:**

```typescript
interface PolicyStats {
  totalPolicies: number;
  activePolicies: number;
  expiredPolicies: number;
  totalPremiumPaid: number;  // KES
  currentCoverage: {
    oneMonth: boolean;
    elevenMonth: boolean;
  };
}
```

### 4.3 BatchProcessingService

Handles scheduled batch processing of policy issuance.

```typescript
@Injectable()
export class BatchProcessingService {
  // Two-Policy Limit Enforcement (CR-IRA-001)
  async canIssuePolicyForVehicle(vehicleRegistration: string): Promise<boolean>;

  // Policy Creation
  async createPendingPolicy(request: PolicyIssuanceRequest): Promise<Policy>;

  // Batch Processing
  async processBatch(schedule: BatchSchedule, date?: Date): Promise<BatchProcessingResult>;
  async retryFailedPolicies(batchId: string): Promise<BatchProcessingResult>;

  // Batch Queries
  async getBatch(batchId: string): Promise<PolicyBatch>;
  async getBatches(startDate: Date, endDate: Date): Promise<PolicyBatch[]>;

  // Internal Helpers
  private generatePolicyNumber(policyType: PolicyType): string;
  private calculateCoverageEnd(start: Date, policyType: PolicyType): Date;
  private getPaymentWindow(schedule: BatchSchedule, date: Date): { start: Date; end: Date };
  private getScheduledTime(schedule: BatchSchedule, date: Date): Date;
}
```

**Policy Number Format:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  POLICY NUMBER FORMAT                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1-Month Policy:   BDA-YYMM-NNNNNN                             │
│  11-Month Policy:  BDB-YYMM-NNNNNN                             │
│                                                                 │
│  Example: BDA-2412-000001                                      │
│           ├── BDA = One-month prefix                           │
│           ├── 24 = Year (2024)                                 │
│           ├── 12 = Month (December)                            │
│           └── 000001 = Sequential number (6 digits)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 PdfGenerationService

Generates policy certificate PDFs.

```typescript
@Injectable()
export class PdfGenerationService {
  // Main Generation
  async generatePolicyCertificate(data: PolicyPdfData): Promise<GeneratedPdf>;

  // PDF Section Builders (private)
  private buildPolicyDocument(doc: PDFDocument, data: PolicyPdfData): void;
  private addHeader(doc: PDFDocument): void;
  private addPolicyDetailsBox(doc: PDFDocument, data: PolicyPdfData): void;
  private addInsuredDetails(doc: PDFDocument, data: PolicyPdfData): void;
  private addVehicleDetails(doc: PDFDocument, data: PolicyPdfData): void;
  private addCoverageDetails(doc: PDFDocument, data: PolicyPdfData): void;
  private addImportantNotices(doc: PDFDocument): void;
  private addFooter(doc: PDFDocument, data: PolicyPdfData): void;

  // Utilities
  private generateFileName(policyNumber: string, policyType: PolicyType): string;
  private maskId(nationalId: string): string;    // Show last 4 only
  private maskPhone(phone: string): string;       // Show last 4 only
  private generateDocumentId(data: PolicyPdfData): string;
}
```

**Generated PDF Structure:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    BODAINSURE                                   │
│                Affordable Insurance for Riders                   │
│ ═══════════════════════════════════════════════════════════════ │
│                                                                 │
│        MOTOR THIRD PARTY INSURANCE CERTIFICATE                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  Policy Number: BDA-2412-000001                             │ │
│ │  Certificate Number: BDA-2412-000001                        │ │
│ │  Issue Date: 15 December 2024                               │ │
│ │  Status: ACTIVE                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  INSURED DETAILS                                                │
│  Name: John Kamau Ochieng                                       │
│  National ID: ********1234                                      │
│  Phone: ******5678                                              │
│                                                                 │
│  VEHICLE DETAILS                                                │
│  Registration: KBZ 123A                                         │
│  Type: MOTORCYCLE (BODABODA)                                    │
│  Use: COMMERCIAL - PASSENGER HIRE                               │
│                                                                 │
│  COVERAGE DETAILS                                               │
│  Type: THIRD PARTY ONLY (TPO)                                   │
│  Period: 15 Dec 2024 - 15 Jan 2025                             │
│  Duration: 1 Month                                              │
│  Premium: KES 1,048.00                                          │
│  Liability: Unlimited (Bodily Injury) | KES 3M (Property)      │
│                                                                 │
│  IMPORTANT NOTICES                                              │
│  1. This certificate must be available for inspection           │
│  2. Report accidents within 48 hours                           │
│  3. Do not admit liability at accident scene                   │
│  ...                                                            │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│  Underwriter: Definite Assurance Company Ltd                    │
│  Agent: Robs Insurance Agency                                   │
│  Platform: BodaInsure by Atronach K Ltd                        │
│  Verify: bodainsure.com/verify/ABC123                          │
│  Doc ID: DOC-XYZ789                                            │
│  Regulated by Insurance Regulatory Authority (IRA) Kenya        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 PolicyTermsService

Manages policy terms and compliance.

```typescript
@Injectable()
export class PolicyTermsService {
  // Terms Management
  async createTerms(request: CreatePolicyTermsRequest): Promise<PolicyTerms>;
  async getCurrentTerms(type: PolicyTermsType): Promise<PolicyTerms>;
  async getTermsById(id: string): Promise<PolicyTerms>;
  async getTermsByVersion(version: string, type: PolicyTermsType): Promise<PolicyTerms>;
  async listTerms(options: ListTermsOptions): Promise<PaginatedResult<PolicyTerms>>;
  async deactivateTerms(id: string): Promise<PolicyTerms>;

  // Acknowledgment Recording
  async acknowledgeTerms(request: AcknowledgeTermsRequest): Promise<PolicyTermsAcknowledgment>;
  async checkAcknowledgmentStatus(userId: string, type: PolicyTermsType): Promise<AcknowledgmentStatus>;
  async getUserAcknowledgments(userId: string, options?: PaginationOptions): Promise<PaginatedResult<Acknowledgment>>;
  async validateForPolicyIssuance(userId: string, type: PolicyTermsType): Promise<ValidationResult>;

  // Localization
  async getTermsForUssd(type: PolicyTermsType, language: 'en' | 'sw'): Promise<UssdTerms>;
  async getFreeLookPeriod(type: PolicyTermsType): Promise<number>;

  // Bootstrap
  async seedDefaultTerms(): Promise<PolicyTerms>;
}
```

**Acknowledgment Status Response:**

```typescript
interface AcknowledgmentStatus {
  acknowledged: boolean;
  acknowledgment?: PolicyTermsAcknowledgment;
  currentTerms: PolicyTerms;
  requiresReAcknowledgment: boolean;  // If checksum differs
}
```

---

## 5. API Endpoints

### 5.1 Policy Controller (User Endpoints)

```
┌─────────────────────────────────────────────────────────────────┐
│                    POLICY ENDPOINTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/v1/policies                                           │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PolicySummary[]                                 │
│  └── Purpose: Get all user's policies                          │
│                                                                 │
│  GET /api/v1/policies/active                                    │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PolicyDetails | null                            │
│  └── Purpose: Get current active policy                        │
│                                                                 │
│  GET /api/v1/policies/stats                                     │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PolicyStats                                     │
│  └── Purpose: Get policy statistics                            │
│                                                                 │
│  GET /api/v1/policies/:policyId                                 │
│  ├── Auth: JWT Required                                        │
│  ├── Response: PolicyDetails                                   │
│  └── Purpose: Get full policy details                          │
│                                                                 │
│  GET /api/v1/policies/:policyId/document                        │
│  ├── Auth: JWT Required                                        │
│  ├── Response: DocumentDownloadInfo                            │
│  └── Purpose: Get PDF download URL                             │
│                                                                 │
│  POST /api/v1/policies/:policyId/cancel                         │
│  ├── Auth: JWT Required                                        │
│  ├── Body: { reason: string }                                  │
│  ├── Response: CancellationResult                              │
│  └── Purpose: Cancel policy (free-look eligible)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Batch Controller (Admin Endpoints)

```
┌─────────────────────────────────────────────────────────────────┐
│                  BATCH ADMIN ENDPOINTS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/v1/policy-batches/process                            │
│  ├── Auth: Admin Required                                      │
│  ├── Query: schedule=BATCH_1|BATCH_2|BATCH_3|MANUAL            │
│  ├── Response: BatchProcessingResult                           │
│  └── Purpose: Manually trigger batch processing                │
│                                                                 │
│  GET /api/v1/policy-batches/:batchId                            │
│  ├── Auth: Admin Required                                      │
│  ├── Response: PolicyBatch                                     │
│  └── Purpose: Get batch details and metrics                    │
│                                                                 │
│  POST /api/v1/policy-batches/:batchId/retry                     │
│  ├── Auth: Admin Required                                      │
│  ├── Response: BatchProcessingResult                           │
│  └── Purpose: Retry failed policies in batch                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Terms Controller (Mixed Auth)

```
┌─────────────────────────────────────────────────────────────────┐
│                   TERMS ENDPOINTS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PUBLIC (No Auth):                                              │
│  ─────────────────                                              │
│  GET /api/v1/policy-terms/current?type=TPO&language=en|sw      │
│  └── Get active terms with optional language                   │
│                                                                 │
│  GET /api/v1/policy-terms/summary?type=TPO&language=en|sw      │
│  └── Get USSD/SMS format (summary + key terms)                 │
│                                                                 │
│  GET /api/v1/policy-terms/:id                                   │
│  └── Fetch specific terms by ID                                │
│                                                                 │
│  AUTHENTICATED (JWT Required):                                  │
│  ─────────────────────────────                                  │
│  GET /api/v1/policy-terms/acknowledgment/status?type=TPO       │
│  └── Check if user has acknowledged terms                      │
│                                                                 │
│  POST /api/v1/policy-terms/acknowledge                          │
│  Body: { termsId, policyId? }                                  │
│  └── Record acceptance with audit trail                        │
│                                                                 │
│  GET /api/v1/policy-terms/acknowledgment/history               │
│  └── Get user's acceptance history                             │
│                                                                 │
│  GET /api/v1/policy-terms/validate/policy-issuance?type=TPO    │
│  └── Check if can proceed with policy                          │
│                                                                 │
│  ADMIN (Admin/Compliance Role):                                 │
│  ──────────────────────────────                                 │
│  POST /api/v1/policy-terms                                      │
│  └── Create new terms version                                  │
│                                                                 │
│  GET /api/v1/policy-terms?type=TPO&activeOnly=true             │
│  └── List all terms versions                                   │
│                                                                 │
│  PUT /api/v1/policy-terms/:id/deactivate                        │
│  └── Mark terms inactive                                       │
│                                                                 │
│  POST /api/v1/policy-terms/seed                                 │
│  └── Initialize with default 1.0 TPO terms                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Policy Lifecycle

### 6.1 Status State Machine

```
                    Payment Received
                          │
                          ▼
                ┌─────────────────┐
                │PENDING_ISSUANCE │ ← Policy queued for batch
                └────────┬────────┘
                         │
                         │ Batch picks up policy
                         ▼
                ┌─────────────────┐
                │   PROCESSING    │ ← Policy in current batch
                └────────┬────────┘
                         │
                         │ Policy number generated, PDF created
                         ▼
                ┌─────────────────┐
                │     ACTIVE      │ ← Coverage active
                └────────┬────────┘
                         │
                         │ 30 days before expiry
                         ▼
                ┌─────────────────┐
                │    EXPIRING     │ ← Renewal notifications sent
                └────────┬────────┘
                         │
                         │ Coverage end date passes
                         ▼
                ┌─────────────────┐
                │    EXPIRED      │ ← Coverage ended
                └─────────────────┘


    CANCELLATION PATH:                    LAPSE PATH:
    ─────────────────                    ─────────────

    PENDING or ACTIVE                    ACTIVE
          │                                  │
          │ User cancels                     │ Payment default
          ▼                                  ▼
    ┌───────────┐                      ┌───────────┐
    │ CANCELLED │                      │  LAPSED   │
    └───────────┘                      └───────────┘
          │
          │ Within 30 days?
          ▼
    ┌─────────────┐
    │ REFUND      │ (if free-look)
    │ ELIGIBLE    │
    └─────────────┘
```

### 6.2 Batch Processing Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│Scheduler│     │  Batch  │     │ Policy  │     │   PDF   │
│  Job    │     │ Service │     │  Repo   │     │ Service │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ Trigger batch │               │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ Get payment window             │
     │               │ (based on schedule)           │
     │               │──────┐        │               │
     │               │      │        │               │
     │               │<─────┘        │               │
     │               │               │               │
     │               │ Find PENDING_ISSUANCE policies│
     │               │──────────────>│               │
     │               │               │               │
     │               │<──────────────│               │
     │               │ policies[]    │               │
     │               │               │               │
     │               │ Create batch record           │
     │               │──────────────>│               │
     │               │               │               │
     │               │               │               │
     │               │ FOR EACH policy:              │
     │               │ ════════════════              │
     │               │               │               │
     │               │ Generate policy number        │
     │               │──────┐        │               │
     │               │      │        │               │
     │               │<─────┘        │               │
     │               │               │               │
     │               │ Calculate coverage dates      │
     │               │──────┐        │               │
     │               │      │        │               │
     │               │<─────┘        │               │
     │               │               │               │
     │               │ Update policy to ACTIVE       │
     │               │──────────────>│               │
     │               │               │               │
     │               │ Generate PDF  │               │
     │               │──────────────────────────────>│
     │               │               │               │
     │               │<──────────────────────────────│
     │               │               │               │
     │               │ Create PolicyDocument         │
     │               │──────────────>│               │
     │               │               │               │
     │               │ END FOR EACH  │               │
     │               │               │               │
     │               │ Update batch metrics          │
     │               │──────────────>│               │
     │               │               │               │
     │<──────────────│               │               │
     │  BatchResult  │               │               │
     │               │               │               │
```

### 6.3 Batch Schedule (EAT Timezone)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BATCH SCHEDULE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EAT (East Africa Time) = UTC+3                                │
│                                                                 │
│  BATCH_1: 08:00 EAT (05:00 UTC)                                │
│  ├── Processes payments from: 00:00-07:59 EAT                  │
│  └── (21:00 prev day - 04:59 UTC)                              │
│                                                                 │
│  BATCH_2: 14:00 EAT (11:00 UTC)                                │
│  ├── Processes payments from: 08:00-13:59 EAT                  │
│  └── (05:00-10:59 UTC)                                         │
│                                                                 │
│  BATCH_3: 20:00 EAT (17:00 UTC)                                │
│  ├── Processes payments from: 14:00-19:59 EAT                  │
│  └── (11:00-16:59 UTC)                                         │
│                                                                 │
│  MANUAL: Triggered by admin (any time)                         │
│  └── Custom payment window or retry                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Compliance Features

### 7.1 IRA Requirements

```
┌─────────────────────────────────────────────────────────────────┐
│                IRA COMPLIANCE REQUIREMENTS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CR-IRA-001: TWO-POLICY LIMIT                                  │
│  ──────────────────────────────                                │
│  • Maximum 2 active TPO policies per vehicle per year          │
│  • Enforced in: BatchProcessingService.canIssuePolicyForVehicle│
│  • Validation before policy creation                           │
│  • Checks: ACTIVE, EXPIRING, PENDING_ISSUANCE statuses         │
│                                                                 │
│  CR-IRA-002: 30-DAY FREE LOOK PERIOD                           │
│  ───────────────────────────────────                           │
│  • Full refund if cancelled within 30 days of issuance         │
│  • Implemented in: PolicyService.isWithinFreeLookPeriod()      │
│  • Configurable via: PolicyTerms.freeLookDays                  │
│  • Refund eligibility tracked in cancellation metadata         │
│                                                                 │
│  CR-IRA-003: POLICY TERMS DISPLAY & ACKNOWLEDGMENT             │
│  ─────────────────────────────────────────────────             │
│  • Versioned terms with effective dates                        │
│  • User acknowledgment required before policy issuance         │
│  • Audit trail: timestamp, IP, user agent, channel             │
│  • Checksum verification for terms change detection            │
│  • Swahili translation support                                 │
│  • Re-acknowledgment if terms updated (checksum differs)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Data Protection

| Data Field | Protection | Rationale |
|------------|------------|-----------|
| National ID | Masked in PDF (last 4) | PII protection |
| Phone Number | Masked in PDF (last 4) | PII protection |
| Insured Name | Full in PDF | Required for identification |
| Terms Checksum | SHA-256 | Change detection |
| Acknowledgment | Full audit trail | Legal compliance |

### 7.3 Free Look Cancellation Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │ Policy  │     │ Payment │     │ Audit   │
│   App   │     │ Service │     │ Module  │     │ Module  │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ POST /policies/{id}/cancel    │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ Check isWithinFreeLookPeriod()│
     │               │──────┐        │               │
     │               │      │        │               │
     │               │<─────┘        │               │
     │               │               │               │
     │               │ If within 30 days:            │
     │               │ ├── Calculate refund amount   │
     │               │ ├── Mark policy CANCELLED     │
     │               │ └── Set refundEligible=true   │
     │               │               │               │
     │               │ Trigger refund                │
     │               │──────────────>│               │
     │               │               │               │
     │               │               │ Process B2C   │
     │               │               │ refund to user│
     │               │               │               │
     │               │ Log cancellation              │
     │               │──────────────────────────────>│
     │               │               │               │
     │<──────────────│               │               │
     │ CancellationResult            │               │
     │ { refunded: true,             │               │
     │   amount: 1048 }              │               │
     │               │               │               │
```

---

## 8. Integration Points

### 8.1 Module Dependencies

```
Policy Module
    │
    ├──► Payment Module
    │    ├── Receives: Policy trigger events (deposit, 30th payment)
    │    └── Sends: Refund requests (free-look cancellation)
    │
    ├──► Identity Module
    │    └── User authentication, user details lookup
    │
    ├──► Storage Module
    │    └── PDF document storage (S3/local)
    │
    ├──► Notification Module
    │    └── Policy delivery (WhatsApp, SMS, Email)
    │
    ├──► Queue Module
    │    └── Async PDF generation, delivery tasks
    │
    ├──► Scheduler Module
    │    ├── Batch processing triggers (3x daily)
    │    └── Expiry status updates
    │
    └──► Audit Module
         └── Policy events logging
```

### 8.2 Event Integration

```typescript
// Events published by Policy module
enum PolicyEvents {
  POLICY_CREATED = 'policy.created',
  POLICY_ACTIVATED = 'policy.activated',
  POLICY_EXPIRING = 'policy.expiring',
  POLICY_EXPIRED = 'policy.expired',
  POLICY_CANCELLED = 'policy.cancelled',
  DOCUMENT_GENERATED = 'policy.document.generated',
  DOCUMENT_DELIVERED = 'policy.document.delivered'
}

// Events consumed by Policy module
enum PaymentEvents {
  DEPOSIT_COMPLETED = 'payment.deposit.completed',     // Trigger Policy 1
  DAILY_PAYMENTS_COMPLETED = 'payment.daily.completed' // Trigger Policy 2
}
```

---

## 9. Error Handling

### 9.1 Batch Processing Errors

| Error | Action | Recovery |
|-------|--------|----------|
| PDF generation fails | Mark policy as FAILED in batch | Retry via admin endpoint |
| Storage upload fails | Mark document as FAILED | Regenerate document |
| Two-policy limit exceeded | Skip policy, log error | Manual review |
| Invalid policy data | Skip policy, add to failedPolicies | Data correction needed |

### 9.2 Error Response Format

```json
{
  "error": {
    "code": "POLICY_LIMIT_EXCEEDED",
    "message": "Vehicle already has 2 active policies this year",
    "details": {
      "vehicleRegistration": "KBZ 123A",
      "activePolicies": 2,
      "maxAllowed": 2
    }
  }
}
```

---

## 10. Configuration

### 10.1 Environment Variables

```bash
# Policy configuration
POLICY_BATCH_1_HOUR=8           # 08:00 EAT
POLICY_BATCH_2_HOUR=14          # 14:00 EAT
POLICY_BATCH_3_HOUR=20          # 20:00 EAT
POLICY_FREE_LOOK_DAYS=30        # IRA requirement

# PDF generation
PDF_STORAGE_BUCKET=policy-documents
PDF_DOWNLOAD_URL_EXPIRY=3600    # 1 hour signed URLs

# Underwriter details
UNDERWRITER_NAME=Definite Assurance Company Ltd
INSURANCE_AGENT_NAME=Robs Insurance Agency
```

### 10.2 Premium Amounts

```typescript
const PREMIUM_CONFIG = {
  ONE_MONTH: 104800,     // 1,048 KES in cents
  ELEVEN_MONTH: 261000,  // 2,610 KES in cents
  ANNUAL_TOTAL: 365800   // 3,658 KES in cents
};
```

---

## 11. Testing

### 11.1 Test Coverage

| Component | Test File | Coverage |
|-----------|-----------|----------|
| PolicyService | policy.service.spec.ts | Unit tests |
| BatchProcessingService | batch-processing.service.spec.ts | Unit tests |
| PdfGenerationService | pdf-generation.service.spec.ts | Unit tests |

### 11.2 Critical Test Scenarios

- [ ] Policy 1 generation on deposit
- [ ] Policy 2 generation on 30th payment
- [ ] Batch processing execution
- [ ] Policy status transitions
- [ ] Two-policy limit enforcement
- [ ] Free-look cancellation with refund
- [ ] PDF generation with PII masking
- [ ] Terms acknowledgment flow
- [ ] Re-acknowledgment on terms update
- [ ] Expiring policies notification

---

## 12. Appendix

### 12.1 Premium Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                    PREMIUM BREAKDOWN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Policy 1 (ONE_MONTH):                                         │
│  ├── Premium: KES 1,048                                        │
│  ├── Coverage: 1 month                                         │
│  └── Liability: Unlimited 3P bodily, KES 3M property           │
│                                                                 │
│  Policy 2 (ELEVEN_MONTH):                                      │
│  ├── Premium: KES 2,610 (87 × 30)                              │
│  ├── Coverage: 11 months                                       │
│  └── Liability: Unlimited 3P bodily, KES 3M property           │
│                                                                 │
│  Annual Total:                                                 │
│  ├── Premium: KES 3,658                                        │
│  ├── Coverage: 12 months                                       │
│  └── vs Traditional: KES 3,500 (lump sum)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Coverage Types

| Coverage | Description | Limit |
|----------|-------------|-------|
| Third-Party Bodily Injury | Injuries to other people | Unlimited |
| Third-Party Property Damage | Damage to others' property | KES 3,000,000 |
| Passenger Liability | Injuries to passengers | Included |

### 12.3 Document Types

| Type | Description | Generated When |
|------|-------------|----------------|
| POLICY_CERTIFICATE | Main policy document | Policy activation |
| TERMS_CONDITIONS | Full terms (PDF) | On request |
| COVER_NOTE | Temporary coverage | Pre-policy (if needed) |
| RECEIPT | Payment receipt | After payment |
