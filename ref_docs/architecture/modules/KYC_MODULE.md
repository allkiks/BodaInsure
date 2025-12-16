# KYC Module Architecture

## 1. Module Overview

### 1.1 Purpose and Scope

The KYC (Know Your Customer) module handles document verification for bodaboda riders before they can proceed to payment. It implements a complete document upload, validation, and review workflow that ensures compliance with insurance regulatory requirements while maintaining a smooth user experience.

### 1.2 Business Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    KYC VERIFICATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REQUIRED DOCUMENTS (6 Total):                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. ID_FRONT      - National ID (Front side)            │   │
│  │  2. ID_BACK       - National ID (Back side)             │   │
│  │  3. LICENSE       - Driving License                     │   │
│  │  4. LOGBOOK       - Vehicle Logbook                     │   │
│  │  5. KRA_PIN       - KRA PIN Certificate                 │   │
│  │  6. PHOTO         - Passport Photo                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Business Rule: ALL 6 documents must be APPROVED before        │
│  user can proceed to payment (BR-001)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Document Upload** | Accept and store user documents (JPEG/PNG, max 10MB) |
| **Version Management** | Track document versions, maintain history |
| **Validation** | Automated quality checks, duplicate detection |
| **Admin Review** | Manual approval/rejection workflow |
| **Status Orchestration** | Manage overall KYC status based on document states |
| **Payment Gating** | Block payments until KYC is fully approved |

---

## 2. Module Structure

### 2.1 File Organization

```
src/modules/kyc/
├── kyc.module.ts                    # Module definition
├── controllers/
│   ├── index.ts                     # Controller exports
│   └── kyc.controller.ts            # User and admin endpoints
├── services/
│   ├── index.ts                     # Service exports
│   ├── document.service.ts          # Document operations
│   └── kyc.service.ts               # KYC status orchestration
├── entities/
│   ├── index.ts                     # Entity exports
│   ├── document.entity.ts           # Document record
│   └── kyc-validation.entity.ts     # Validation results
└── dto/
    ├── index.ts                     # DTO exports
    ├── upload-document.dto.ts       # Upload request/response
    ├── review-document.dto.ts       # Admin review DTOs
    └── kyc-status.dto.ts            # Status response DTOs
```

### 2.2 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        KYC MODULE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IMPORTS:                                                       │
│  ├── TypeOrmModule.forFeature([Document, KycValidation, User]) │
│  ├── MulterModule (file upload handling, 10MB limit)           │
│  └── IdentityModule (user entity, authentication)              │
│                                                                 │
│  EXPORTS:                                                       │
│  ├── DocumentService                                           │
│  └── KycService                                                │
│                                                                 │
│  CONSUMERS:                                                     │
│  ├── PaymentModule (checks canProceedToPayment)                │
│  ├── PolicyModule (links approved KYC to policies)             │
│  └── NotificationModule (status update notifications)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐
│        User         │
│  (Identity Module)  │
│  ─────────────────  │
│  kycStatus (enum)   │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│      Document       │
│  ─────────────────  │
│  id (UUID, PK)      │
│  userId (UUID, FK)  │
│  documentType       │
│  status             │
│  version            │
│  isCurrent          │
│  storageKey         │
│  contentHash        │
│  ...                │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│   KycValidation     │
│  ─────────────────  │
│  id (UUID, PK)      │
│  documentId (FK)    │
│  validationType     │
│  result             │
│  confidenceScore    │
│  ...                │
└─────────────────────┘
```

### 3.2 Document Entity

Core entity for storing uploaded documents.

```typescript
export enum DocumentType {
  ID_FRONT = 'ID_FRONT',
  ID_BACK = 'ID_BACK',
  LICENSE = 'LICENSE',
  LOGBOOK = 'LOGBOOK',
  KRA_PIN = 'KRA_PIN',
  PHOTO = 'PHOTO'
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column({ type: 'enum', enum: DocumentStatus, default: 'PENDING' })
  status: DocumentStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: true })
  isCurrent: boolean;  // Only one version per type is active

  // Storage
  @Column({ length: 500 })
  storageKey: string;  // S3 path: kyc/{userId}/{documentType}/{documentId}.{ext}

  @Column({ length: 255 })
  originalFilename: string;

  @Column({ length: 50 })
  mimeType: string;  // image/jpeg, image/png

  @Column({ type: 'int' })
  fileSize: number;  // Bytes

  // Quality & Device Info
  @Column({ type: 'int', nullable: true })
  qualityScore: number;  // 0-100 from client

  @Column({ length: 255, nullable: true })
  device: string;

  @Column({ type: 'timestamptz', nullable: true })
  capturedAt: Date;

  // Review
  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  reviewerNotes: string;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date;

  // Deduplication
  @Column({ length: 64, nullable: true })
  contentHash: string;  // SHA256 for duplicate detection

  // OCR/Validation Data
  @Column({ type: 'jsonb', nullable: true })
  extractedData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Database Indexes:**

```sql
CREATE INDEX idx_documents_user_type ON documents(user_id, document_type);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);
CREATE UNIQUE INDEX idx_documents_hash ON documents(content_hash) WHERE content_hash IS NOT NULL;
```

### 3.3 KycValidation Entity

Tracks validation results for each document.

```typescript
export enum ValidationType {
  QUALITY = 'QUALITY',         // Image quality check
  TYPE_MATCH = 'TYPE_MATCH',   // Document matches declared type
  READABILITY = 'READABILITY', // Text can be extracted
  FACE_MATCH = 'FACE_MATCH',   // Face matches photo ID
  EXPIRY_CHECK = 'EXPIRY_CHECK', // Document not expired
  FRAUD_CHECK = 'FRAUD_CHECK', // No tampering detected
  MANUAL = 'MANUAL'            // Manual review result
}

export enum ValidationResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  PENDING = 'PENDING'
}

@Entity('kyc_validations')
export class KycValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  documentId: string;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column({ type: 'enum', enum: ValidationType })
  validationType: ValidationType;

  @Column({ type: 'enum', enum: ValidationResult, default: 'PENDING' })
  result: ValidationResult;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidenceScore: number;  // 0-100

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @Column({ default: true })
  isAutomated: boolean;

  @Column({ type: 'uuid', nullable: true })
  validatedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### 3.4 KYC Status (in User Entity)

```typescript
// Located in Identity module's User entity
export enum KycStatus {
  PENDING = 'PENDING',       // Initial state, documents missing
  IN_REVIEW = 'IN_REVIEW',   // All uploaded, awaiting review
  APPROVED = 'APPROVED',     // All documents verified
  REJECTED = 'REJECTED'      // Some documents rejected
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
│  │                   KycService                             │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  • getKycStatus()       • updateKycStatus()             │   │
│  │  • canProceedToPayment() • submitForReview()            │   │
│  │  • checkRejectionThreshold()                            │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│                             │ uses                              │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                DocumentService                           │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  • uploadDocument()     • getUserDocuments()            │   │
│  │  • reviewDocument()     • getPendingDocuments()         │   │
│  │  • getDocumentCompletion() • deleteDocument()           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 DocumentService

Handles all document operations.

```typescript
@Injectable()
export class DocumentService {
  // Constants
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
  private readonly MAX_RESUBMISSIONS = 5;
  private readonly REQUIRED_DOCUMENTS: DocumentType[] = [
    DocumentType.ID_FRONT,
    DocumentType.ID_BACK,
    DocumentType.LICENSE,
    DocumentType.LOGBOOK,
    DocumentType.KRA_PIN,
    DocumentType.PHOTO
  ];

  // Upload Operations
  async uploadDocument(data: UploadDocumentData): Promise<DocumentUploadResult>;
  async getUserDocuments(userId: string): Promise<Document[]>;
  async getDocumentById(documentId: string): Promise<Document | null>;

  // Completion Tracking
  async getDocumentCompletion(userId: string): Promise<DocumentCompletion>;
  async getSubmissionCount(userId: string, documentType: DocumentType): Promise<number>;

  // Admin Review
  async reviewDocument(
    documentId: string,
    reviewerId: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
    reviewerNotes?: string
  ): Promise<Document>;
  async getPendingDocuments(options: PendingDocumentsQuery): Promise<PaginatedResult<Document>>;

  // Utilities
  async deleteDocument(documentId: string, userId: string): Promise<void>;
  getDocumentTypeLabel(type: DocumentType): string;
}
```

**Upload Flow:**

```typescript
async uploadDocument(data: UploadDocumentData): Promise<DocumentUploadResult> {
  // 1. Validate file
  if (!this.ALLOWED_MIME_TYPES.includes(data.mimeType)) {
    throw new BadRequestException('Only JPEG and PNG files are allowed');
  }
  if (data.fileSize > this.MAX_FILE_SIZE) {
    throw new BadRequestException('File size exceeds 10MB limit');
  }

  // 2. Check submission count
  const submissionCount = await this.getSubmissionCount(data.userId, data.documentType);
  if (submissionCount >= this.MAX_RESUBMISSIONS) {
    throw new BadRequestException('Maximum resubmissions reached for this document type');
  }

  // 3. Calculate content hash for deduplication
  const contentHash = crypto.createHash('sha256').update(data.file).digest('hex');
  const existingDoc = await this.documentRepo.findOne({ where: { contentHash } });
  if (existingDoc) {
    throw new ConflictException('This document has already been uploaded');
  }

  // 4. Mark previous versions as inactive
  await this.documentRepo.update(
    { userId: data.userId, documentType: data.documentType, isCurrent: true },
    { isCurrent: false }
  );

  // 5. Calculate new version number
  const previousVersion = await this.documentRepo.findOne({
    where: { userId: data.userId, documentType: data.documentType },
    order: { version: 'DESC' }
  });
  const version = previousVersion ? previousVersion.version + 1 : 1;

  // 6. Generate storage key
  const extension = data.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const documentId = uuidv4();
  const storageKey = `kyc/${data.userId}/${data.documentType}/${documentId}.${extension}`;

  // 7. Create document record
  const document = await this.documentRepo.save({
    id: documentId,
    userId: data.userId,
    documentType: data.documentType,
    status: DocumentStatus.PROCESSING,
    version,
    isCurrent: true,
    storageKey,
    originalFilename: data.originalFilename,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    qualityScore: data.qualityScore,
    device: data.device,
    capturedAt: data.capturedAt,
    contentHash
  });

  // 8. Run preliminary validations
  const validations = await this.runPreliminaryValidations(document, data.file);

  // 9. Update status based on validations
  const hasFailures = validations.some(v => v.result === ValidationResult.FAIL);
  document.status = hasFailures ? DocumentStatus.IN_REVIEW : DocumentStatus.PENDING;
  await this.documentRepo.save(document);

  // 10. TODO: Upload file to storage
  // await this.storageService.upload(storageKey, data.file, data.mimeType);

  return {
    documentId: document.id,
    status: 'SUCCESS',
    version: document.version,
    validation: {
      quality: validations.find(v => v.validationType === 'QUALITY')?.result ?? 'PENDING',
      typeMatch: validations.find(v => v.validationType === 'TYPE_MATCH')?.result ?? 'PENDING'
    },
    message: 'Document uploaded successfully'
  };
}
```

**Document Completion Response:**

```typescript
interface DocumentCompletion {
  uploaded: DocumentType[];      // All uploaded types
  missing: DocumentType[];       // Required but not uploaded
  approved: DocumentType[];      // Fully approved
  rejected: DocumentType[];      // Currently rejected
  inReview: DocumentType[];      // Pending or processing
  completionPercentage: number;  // 0-100
  isComplete: boolean;           // All documents uploaded
  allApproved: boolean;          // All documents approved
}
```

### 4.3 KycService

Orchestrates overall KYC status.

```typescript
@Injectable()
export class KycService {
  private readonly REJECTION_THRESHOLD = 3;

  // Status Management
  async getKycStatus(userId: string): Promise<KycStatusResponse>;
  async updateKycStatus(userId: string): Promise<KycStatus>;
  async getKycSummary(userId: string): Promise<KycSummary>;

  // Workflow
  async submitForReview(userId: string): Promise<SubmitResult>;
  async checkRejectionThreshold(userId: string): Promise<boolean>;

  // Payment Gating
  async canProceedToPayment(userId: string): Promise<boolean>;
}
```

**KYC Status Determination:**

```typescript
async updateKycStatus(userId: string): Promise<KycStatus> {
  const completion = await this.documentService.getDocumentCompletion(userId);
  const user = await this.userService.findById(userId);

  let newStatus: KycStatus;

  if (completion.allApproved) {
    newStatus = KycStatus.APPROVED;
  } else if (completion.rejected.length > 0) {
    newStatus = KycStatus.REJECTED;
  } else if (completion.missing.length > 0) {
    newStatus = KycStatus.PENDING;
  } else {
    // All uploaded, some still in review
    newStatus = KycStatus.IN_REVIEW;
  }

  if (user.kycStatus !== newStatus) {
    await this.userRepo.update(userId, { kycStatus: newStatus });
  }

  return newStatus;
}
```

**KYC Status Response:**

```typescript
interface KycStatusResponse {
  status: KycStatus;
  updatedAt: Date;
  documents: DocumentStatusItem[];
  documentsUploaded: number;
  documentsRequired: number;
  completionPercentage: number;
  canProceedToPayment: boolean;
  nextAction?: string;  // User guidance message
}

// Next action examples:
// - "Please upload: National ID (Front), Driving License"
// - "Please re-upload rejected documents"
// - "We're reviewing your documents. This usually takes 1-2 hours."
// - "All documents verified. You can proceed to payment."
```

---

## 5. API Endpoints

### 5.1 User Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER KYC ENDPOINTS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/v1/kyc/status                                         │
│  ├── Auth: JWT Required                                        │
│  ├── Response: KycStatusResponse                               │
│  └── Purpose: Get detailed KYC status with guidance            │
│                                                                 │
│  POST /api/v1/kyc/documents                                     │
│  ├── Auth: JWT Required                                        │
│  ├── Content-Type: multipart/form-data                         │
│  ├── Body: file (binary), documentType, qualityScore?, device? │
│  ├── Response: UploadDocumentResponse                          │
│  └── Purpose: Upload a KYC document                            │
│                                                                 │
│  GET /api/v1/kyc/documents                                      │
│  ├── Auth: JWT Required                                        │
│  ├── Response: Document[]                                      │
│  └── Purpose: Get user's current documents                     │
│                                                                 │
│  POST /api/v1/kyc/submit                                        │
│  ├── Auth: JWT Required                                        │
│  ├── Response: { success, message, kycStatus }                 │
│  └── Purpose: Submit documents for review                      │
│                                                                 │
│  GET /api/v1/kyc/summary                                        │
│  ├── Auth: JWT Required                                        │
│  ├── Response: KycSummary                                      │
│  └── Purpose: Get dashboard-friendly summary                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Admin Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                   ADMIN KYC ENDPOINTS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/v1/kyc/admin/pending                                  │
│  ├── Auth: JWT + Admin Role                                    │
│  ├── Query: documentType?, userId?, page, limit                │
│  ├── Response: { documents[], total }                          │
│  └── Purpose: Get documents awaiting review                    │
│                                                                 │
│  PATCH /api/v1/kyc/admin/documents/:id/review                   │
│  ├── Auth: JWT + Admin Role                                    │
│  ├── Body: { status: APPROVED|REJECTED, rejectionReason?, notes? }
│  ├── Response: ReviewDocumentResponse                          │
│  └── Purpose: Approve or reject a document                     │
│                                                                 │
│  GET /api/v1/kyc/admin/documents/:id                            │
│  ├── Auth: JWT + Admin Role                                    │
│  ├── Response: Document with validations                       │
│  └── Purpose: Get full document details                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Document Lifecycle

### 6.1 Status State Machine

```
                    ┌───────────────┐
                    │   PROCESSING  │ ← Initial upload state
                    └───────┬───────┘
                            │
                            │ Preliminary validation
                            ▼
           ┌────────────────┴────────────────┐
           │                                 │
           ▼                                 ▼
   ┌───────────────┐                 ┌───────────────┐
   │    PENDING    │                 │   IN_REVIEW   │
   │ (auto-passed) │                 │ (needs review)│
   └───────┬───────┘                 └───────┬───────┘
           │                                 │
           └────────────┬────────────────────┘
                        │
                        │ Admin reviews
                        ▼
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
   ┌───────────────┐         ┌───────────────┐
   │   APPROVED    │         │   REJECTED    │
   │   (final)     │         │ (re-upload)   │
   └───────────────┘         └───────┬───────┘
                                     │
                                     │ User re-uploads
                                     ▼
                             ┌───────────────┐
                             │  PROCESSING   │
                             │ (new version) │
                             └───────────────┘
```

### 6.2 Upload Flow Sequence

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │   API   │     │Document │     │ Storage │
│  App    │     │Controller│    │ Service │     │ Service │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ POST /kyc/documents           │               │
     │ (file + metadata)             │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ uploadDocument()              │
     │               │──────────────>│               │
     │               │               │               │
     │               │               │ Validate file │
     │               │               │ (type, size)  │
     │               │               │──────┐        │
     │               │               │      │        │
     │               │               │<─────┘        │
     │               │               │               │
     │               │               │ Check submission count
     │               │               │──────┐        │
     │               │               │      │        │
     │               │               │<─────┘        │
     │               │               │               │
     │               │               │ Calculate SHA256 hash
     │               │               │ Check duplicates
     │               │               │──────┐        │
     │               │               │      │        │
     │               │               │<─────┘        │
     │               │               │               │
     │               │               │ Mark previous versions inactive
     │               │               │ Create new document record
     │               │               │──────┐        │
     │               │               │      │        │
     │               │               │<─────┘        │
     │               │               │               │
     │               │               │ Run preliminary validations
     │               │               │ (quality, type match)
     │               │               │──────┐        │
     │               │               │      │        │
     │               │               │<─────┘        │
     │               │               │               │
     │               │               │ Upload to storage
     │               │               │──────────────>│
     │               │               │               │
     │               │               │<──────────────│
     │               │               │               │
     │               │<──────────────│               │
     │<──────────────│               │               │
     │ { documentId, │               │               │
     │   status,     │               │               │
     │   validation }│               │               │
     │               │               │               │
```

### 6.3 Review Flow Sequence

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Admin  │     │   API   │     │Document │     │   KYC   │
│ Portal  │     │Controller│    │ Service │     │ Service │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │ GET /admin/pending            │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ getPendingDocuments()         │
     │               │──────────────>│               │
     │               │               │               │
     │               │<──────────────│               │
     │<──────────────│               │               │
     │ { documents[] }               │               │
     │               │               │               │
     │ PATCH /admin/documents/:id/review             │
     │ { status: APPROVED }          │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ reviewDocument()              │
     │               │──────────────>│               │
     │               │               │               │
     │               │               │ Update document status
     │               │               │ Create MANUAL validation
     │               │               │──────┐        │
     │               │               │      │        │
     │               │               │<─────┘        │
     │               │               │               │
     │               │               │ updateKycStatus()
     │               │               │──────────────>│
     │               │               │               │
     │               │               │ Calculate new status
     │               │               │ Update user.kycStatus
     │               │               │<──────────────│
     │               │               │               │
     │               │<──────────────│               │
     │<──────────────│               │               │
     │ { kycStatus,  │               │               │
     │   document }  │               │               │
     │               │               │               │
```

---

## 7. Validation System

### 7.1 Preliminary Validations

Run automatically when document is uploaded.

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTOMATED VALIDATIONS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUALITY VALIDATION                                            │
│  ──────────────────                                            │
│  Input: Client-provided qualityScore (0-100)                   │
│  Result:                                                       │
│  • PASS: qualityScore >= 70                                    │
│  • WARNING: qualityScore 50-69                                 │
│  • FAIL: qualityScore < 50                                     │
│                                                                 │
│  TYPE_MATCH VALIDATION                                         │
│  ─────────────────────                                         │
│  Input: File content (for ML model - future)                   │
│  Result: PENDING (placeholder for ML implementation)           │
│  Note: Would use image classification to verify document type  │
│                                                                 │
│  Future Validations (planned):                                 │
│  • READABILITY: OCR extraction success                         │
│  • FACE_MATCH: Photo matches ID                                │
│  • EXPIRY_CHECK: Document not expired                          │
│  • FRAUD_CHECK: No tampering detected                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Manual Review

Admin review creates a MANUAL validation record.

```typescript
async reviewDocument(
  documentId: string,
  reviewerId: string,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string,
  reviewerNotes?: string
): Promise<Document> {
  const document = await this.documentRepo.findOne({ where: { id: documentId } });

  if (!document) {
    throw new NotFoundException('Document not found');
  }

  if (document.status === DocumentStatus.APPROVED) {
    throw new BadRequestException('Cannot review an already approved document');
  }

  if (status === 'REJECTED' && !rejectionReason) {
    throw new BadRequestException('Rejection reason is required');
  }

  // Update document
  document.status = status === 'APPROVED' ? DocumentStatus.APPROVED : DocumentStatus.REJECTED;
  document.rejectionReason = rejectionReason ?? null;
  document.reviewerNotes = reviewerNotes ?? null;
  document.reviewedBy = reviewerId;
  document.reviewedAt = new Date();
  await this.documentRepo.save(document);

  // Create manual validation record
  await this.validationRepo.save({
    documentId,
    validationType: ValidationType.MANUAL,
    result: status === 'APPROVED' ? ValidationResult.PASS : ValidationResult.FAIL,
    message: rejectionReason ?? 'Approved by reviewer',
    isAutomated: false,
    validatedBy: reviewerId
  });

  // Update overall KYC status
  await this.kycService.updateKycStatus(document.userId);

  // Check rejection threshold
  await this.kycService.checkRejectionThreshold(document.userId);

  return document;
}
```

---

## 8. Business Rules

### 8.1 Enforced Rules

| Rule | Description | Implementation |
|------|-------------|----------------|
| **BR-001** | All 6 documents required | `REQUIRED_DOCUMENTS` array |
| **BR-002** | Max 5 resubmissions per type | `MAX_RESUBMISSIONS = 5` |
| **BR-003** | Max 3 versions retained | `isCurrent` flag |
| **BR-004** | 3+ rejections flags user | `REJECTION_THRESHOLD = 3` |
| **BR-005** | KYC APPROVED before payment | `canProceedToPayment()` |
| **BR-006** | Only JPEG/PNG allowed | `ALLOWED_MIME_TYPES` |
| **BR-007** | Max 10MB file size | `MAX_FILE_SIZE` |
| **BR-008** | Duplicate detection | SHA256 content hash |

### 8.2 Rejection Threshold

```typescript
async checkRejectionThreshold(userId: string): Promise<boolean> {
  const rejectedDocs = await this.documentRepo.count({
    where: {
      userId,
      status: DocumentStatus.REJECTED,
      isCurrent: true
    }
  });

  if (rejectedDocs >= this.REJECTION_THRESHOLD) {
    this.logger.warn(
      `User ${userId.substring(0, 8)}... has ${rejectedDocs} rejected documents - flagged for manual review`
    );
    return true;
  }

  return false;
}
```

---

## 9. Storage Integration

### 9.1 Storage Path Format

```
kyc/{userId}/{documentType}/{documentId}.{extension}

Examples:
kyc/550e8400-e29b-41d4-a716-446655440000/ID_FRONT/123e4567-e89b-12d3-a456-426655440000.jpg
kyc/550e8400-e29b-41d4-a716-446655440000/LICENSE/789f0123-e45b-67d8-b901-234567890123.png
```

### 9.2 Storage Service Integration

```typescript
// Upload (TODO in current implementation)
await this.storageService.uploadKycDocument(
  userId,
  `${documentId}.${extension}`,
  fileBuffer,
  { contentType: mimeType, metadata: { documentType, version } }
);

// Download
const result = await this.storageService.downloadKycDocument(userId, fileName);

// List
const documents = await this.storageService.listKycDocuments(userId);
```

---

## 10. Security Considerations

### 10.1 Data Protection

| Aspect | Implementation |
|--------|----------------|
| **PII Classification** | National ID, KRA PIN = HIGH |
| **Storage** | Encrypted at rest (S3/provider) |
| **Access Control** | User can only access own documents |
| **Admin Access** | Role-based (PLATFORM_ADMIN, INSURANCE_ADMIN) |
| **Logging** | User IDs masked (first 8 chars only) |
| **Soft Delete** | Documents never hard-deleted |

### 10.2 File Validation

```typescript
// Multer configuration
{
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(new BadRequestException('Only JPEG and PNG allowed'), false);
    }
    cb(null, true);
  }
}
```

---

## 11. Error Handling

### 11.1 Error Scenarios

| Scenario | Error | HTTP Status |
|----------|-------|-------------|
| Invalid file type | BadRequestException | 400 |
| File too large | BadRequestException | 400 |
| Max resubmissions | BadRequestException | 400 |
| Duplicate file | ConflictException | 409 |
| Document not found | NotFoundException | 404 |
| Already approved | BadRequestException | 400 |
| Missing rejection reason | BadRequestException | 400 |
| Unauthorized access | ForbiddenException | 403 |

### 11.2 Error Response Format

```json
{
  "error": {
    "code": "MAX_RESUBMISSIONS_REACHED",
    "message": "Maximum resubmissions reached for this document type",
    "details": {
      "documentType": "ID_FRONT",
      "currentSubmissions": 5,
      "maxAllowed": 5
    }
  }
}
```

---

## 12. Testing

### 12.1 Critical Test Scenarios

- [ ] Upload valid JPEG document
- [ ] Upload valid PNG document
- [ ] Reject invalid file type (PDF, GIF)
- [ ] Reject oversized file (>10MB)
- [ ] Enforce max 5 resubmissions
- [ ] Detect duplicate by hash
- [ ] Version management (mark previous inactive)
- [ ] Quality validation (pass/warning/fail)
- [ ] Admin approval flow
- [ ] Admin rejection with reason
- [ ] KYC status transitions
- [ ] Rejection threshold detection
- [ ] Payment gating (canProceedToPayment)
- [ ] Pagination for pending documents
- [ ] User document isolation

---

## 13. Appendix

### 13.1 Document Type Labels

| Type | Label |
|------|-------|
| ID_FRONT | National ID (Front) |
| ID_BACK | National ID (Back) |
| LICENSE | Driving License |
| LOGBOOK | Vehicle Logbook |
| KRA_PIN | KRA PIN Certificate |
| PHOTO | Passport Photo |

### 13.2 KYC Status Messages

| Status | Next Action Message |
|--------|---------------------|
| PENDING (missing docs) | "Please upload: [missing document labels]" |
| REJECTED | "Please re-upload rejected documents" |
| IN_REVIEW | "We're reviewing your documents. This usually takes 1-2 hours." |
| APPROVED | "All documents verified. You can proceed to payment." |
