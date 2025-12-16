# Storage Module Architecture

**Module:** Storage
**Location:** `src/server/src/modules/storage`
**Purpose:** Multi-provider object storage abstraction layer for document management

---

## Table of Contents

1. [Overview](#1-overview)
2. [Module Structure](#2-module-structure)
3. [Provider Architecture](#3-provider-architecture)
4. [Data Models](#4-data-models)
5. [Storage Service](#5-storage-service)
6. [Provider Implementations](#6-provider-implementations)
7. [Sequence Diagrams](#7-sequence-diagrams)
8. [Security & Data Protection](#8-security--data-protection)
9. [Configuration](#9-configuration)
10. [Integration Points](#10-integration-points)
11. [Error Handling](#11-error-handling)

---

## 1. Overview

### 1.1 Purpose

The Storage module provides a unified, provider-agnostic interface for storing and retrieving documents across multiple cloud storage platforms. It implements the Strategy pattern to allow seamless switching between storage backends through configuration alone.

### 1.2 Key Features

- **Multi-Provider Support**: AWS S3, Azure Blob Storage, GCP Cloud Storage, Local filesystem
- **Unified Interface**: Single API regardless of underlying provider
- **Signed URL Generation**: Secure time-limited access for uploads/downloads
- **User Data Isolation**: Document segregation by user ID with path traversal prevention
- **GDPR Compliance**: Bulk user data deletion for account removal
- **Development Mode**: Local filesystem provider for development without cloud dependencies

### 1.3 Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE MODULE ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐      │
│    │              StorageService (Facade)                │      │
│    │                                                     │      │
│    │  uploadKycDocument()    downloadKycDocument()       │      │
│    │  uploadPolicyDocument() downloadPolicyDocument()    │      │
│    │  uploadClaimDocument()  downloadClaimDocument()     │      │
│    │  getSignedUploadUrl()   getSignedDownloadUrl()      │      │
│    │  deleteAllUserDocuments()                           │      │
│    └──────────────────────┬──────────────────────────────┘      │
│                           │                                     │
│                           ▼                                     │
│    ┌─────────────────────────────────────────────────────┐      │
│    │            IStorageProvider (Interface)             │      │
│    └──────────────────────┬──────────────────────────────┘      │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│    ┌─────────┐      ┌──────────┐      ┌──────────┐              │
│    │   AWS   │      │  Azure   │      │   GCP    │              │
│    │   S3    │      │   Blob   │      │ Storage  │              │
│    └─────────┘      └──────────┘      └──────────┘              │
│         │                                                       │
│         ▼                                                       │
│    ┌─────────┐                                                  │
│    │  Local  │  ← Development/Testing                           │
│    │   FS    │                                                  │
│    └─────────┘                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Structure

### 2.1 File Organization

```
src/server/src/modules/storage/
├── storage.module.ts              # Module definition with factory
├── index.ts                       # Public exports
├── interfaces/
│   ├── index.ts                   # Interface exports
│   └── storage-provider.interface.ts  # Provider contract & types
├── providers/
│   ├── index.ts                   # Provider exports
│   ├── aws-storage.provider.ts    # AWS S3 implementation
│   ├── azure-storage.provider.ts  # Azure Blob implementation
│   ├── gcp-storage.provider.ts    # GCP Storage implementation
│   └── local-storage.provider.ts  # Local filesystem implementation
└── services/
    ├── index.ts                   # Service exports
    └── storage.service.ts         # Facade service
```

### 2.2 Module Definition

```typescript
// storage.module.ts
@Module({
  imports: [ConfigModule],
  providers: [StorageProviderFactory, StorageService],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
```

### 2.3 Provider Factory

The module uses a factory pattern to instantiate the appropriate provider:

```typescript
// Provider selection logic
const StorageProviderFactory = {
  provide: STORAGE_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const providerType = configService.get('app.storage.provider', 'local');

    switch (providerType) {
      case 'aws':
        return new AwsStorageProvider(configService);
      case 'azure':
        return new AzureStorageProvider(configService);
      case 'gcp':
        return new GcpStorageProvider(configService);
      case 'local':
      default:
        return new LocalStorageProvider(configService);
    }
  },
};
```

---

## 3. Provider Architecture

### 3.1 Provider Interface

```typescript
// storage-provider.interface.ts
interface IStorageProvider {
  // Provider identity
  readonly providerType: StorageProviderType;

  // Lifecycle
  initialize(): Promise<void>;

  // Core operations
  upload(bucket, userId, fileName, data, options): Promise<StorageUploadResult>;
  download(bucket, userId, fileName): Promise<StorageDownloadResult>;
  delete(bucket, userId, fileName): Promise<StorageDeleteResult>;
  list(bucket, userId, options): Promise<StorageListResult>;
  exists(bucket, userId, fileName): Promise<StorageExistsResult>;

  // Signed URL operations
  getSignedUploadUrl(bucket, userId, fileName, options): Promise<StorageSignedUrlResult>;
  getSignedDownloadUrl(bucket, userId, fileName, options): Promise<StorageSignedUrlResult>;

  // GDPR compliance
  deleteUserData(userId: string): Promise<StorageDeleteResult>;

  // Utility
  getStoragePath(bucket, userId, fileName): string;
}
```

### 3.2 Provider Types

```typescript
enum StorageProviderType {
  AWS = 'aws',
  GCP = 'gcp',
  AZURE = 'azure',
  LOCAL = 'local',
}
```

### 3.3 Storage Buckets

Documents are organized into three logical buckets:

```typescript
enum StorageBucket {
  KYC = 'kyc',           // KYC verification documents
  POLICIES = 'policies', // Generated policy PDFs
  CLAIMS = 'claims',     // Claims-related documents
}
```

---

## 4. Data Models

### 4.1 Upload Options & Result

```typescript
interface StorageUploadOptions {
  contentType?: string;           // MIME type
  metadata?: Record<string, string>;  // Custom metadata
  acl?: 'private' | 'public-read';    // Access control
}

interface StorageUploadResult {
  success: boolean;
  key: string;          // Storage path
  url?: string;         // Access URL (if public)
  etag: string;         // File hash for integrity
  size: number;         // File size in bytes
  error?: string;       // Error message if failed
}
```

### 4.2 Download Result

```typescript
interface StorageDownloadResult {
  success: boolean;
  data?: Buffer;                      // File content
  contentType?: string;               // MIME type
  metadata?: Record<string, string>;  // Custom metadata
  error?: string;                     // Error message if failed
}
```

### 4.3 List Options & Result

```typescript
interface StorageListOptions {
  prefix?: string;            // Filter by filename prefix
  maxKeys?: number;           // Max items (default 1000)
  continuationToken?: string; // Pagination token
}

interface StorageListResult {
  success: boolean;
  items: StorageListItem[];
  isTruncated: boolean;          // More results available
  continuationToken?: string;    // Token for next page
  error?: string;
}

interface StorageListItem {
  key: string;           // File path
  size: number;          // File size in bytes
  lastModified: Date;    // Modification timestamp
  etag?: string;         // File hash
}
```

### 4.4 Signed URL Types

```typescript
interface StorageSignedUrlOptions {
  expiresIn?: number;    // Expiration in seconds (default 3600)
  contentType?: string;  // Required for upload URLs
}

interface StorageSignedUrlResult {
  success: boolean;
  url?: string;          // Generated signed URL
  expiresAt?: Date;      // Expiration timestamp
  error?: string;
}
```

---

## 5. Storage Service

### 5.1 Service Overview

The `StorageService` acts as a facade, providing domain-specific methods for each document type while delegating to the configured provider.

**Location:** `src/server/src/modules/storage/services/storage.service.ts`

### 5.2 Public API

```typescript
@Injectable()
class StorageService implements OnModuleInit {
  // Provider info
  getProviderType(): StorageProviderType;

  // KYC Documents
  uploadKycDocument(userId, fileName, data, options): Promise<StorageUploadResult>;
  downloadKycDocument(userId, fileName): Promise<StorageDownloadResult>;
  listKycDocuments(userId, options): Promise<StorageListResult>;

  // Policy Documents
  uploadPolicyDocument(userId, fileName, data, options): Promise<StorageUploadResult>;
  downloadPolicyDocument(userId, fileName): Promise<StorageDownloadResult>;
  listPolicyDocuments(userId, options): Promise<StorageListResult>;

  // Claims Documents
  uploadClaimDocument(userId, fileName, data, options): Promise<StorageUploadResult>;
  downloadClaimDocument(userId, fileName): Promise<StorageDownloadResult>;
  listClaimDocuments(userId, options): Promise<StorageListResult>;

  // Generic Operations
  upload(bucket, userId, fileName, data, options): Promise<StorageUploadResult>;
  download(bucket, userId, fileName): Promise<StorageDownloadResult>;
  list(bucket, userId, options): Promise<StorageListResult>;
  deleteDocument(bucket, userId, fileName): Promise<StorageDeleteResult>;
  documentExists(bucket, userId, fileName): Promise<StorageExistsResult>;
  getStoragePath(bucket, userId, fileName): string;

  // Signed URLs
  getSignedUploadUrl(bucket, userId, fileName, options): Promise<StorageSignedUrlResult>;
  getSignedDownloadUrl(bucket, userId, fileName, options): Promise<StorageSignedUrlResult>;

  // GDPR Compliance
  deleteAllUserDocuments(userId): Promise<StorageDeleteResult>;
}
```

### 5.3 Service Implementation Pattern

```
┌───────────────────────────────────────────────────────────────┐
│                    StorageService                             │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  uploadKycDocument(userId, fileName, data, options)           │
│          │                                                    │
│          │  Transforms to:                                    │
│          │  bucket = StorageBucket.KYC                        │
│          │                                                    │
│          ▼                                                    │
│  provider.upload(bucket, userId, fileName, data, options)     │
│                                                               │
│  Logging includes masked userId (last 8 chars only)           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. Provider Implementations

### 6.1 AWS S3 Provider

**Location:** `src/server/src/modules/storage/providers/aws-storage.provider.ts`

**Dependencies:**
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

**Configuration:**
```typescript
interface AwsConfig {
  region: string;           // Default: 'eu-west-1'
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;        // Custom endpoint for MinIO/LocalStack
  forcePathStyle?: boolean; // For S3-compatible services
  buckets: {
    kyc: string;
    policies: string;
    claims: string;
  };
}
```

**Key Features:**
- Compatible with MinIO and LocalStack for development
- Automatic bucket creation during initialization
- Signed URL generation using S3 presigner
- ACL support (private/public-read)

**Storage Path Format:**
```
s3://{bucket-name}/{user-id-guid}/{sanitized-filename}
```

### 6.2 Azure Blob Storage Provider

**Location:** `src/server/src/modules/storage/providers/azure-storage.provider.ts`

**Dependencies:**
- `@azure/storage-blob`

**Configuration:**
```typescript
interface AzureConfig {
  connectionString?: string;  // Preferred authentication method
  accountName?: string;       // Alternative auth
  accountKey?: string;        // Alternative auth
  buckets: {
    kyc: string;
    policies: string;
    claims: string;
  };
}
```

**Key Features:**
- Connection string or account key authentication
- SAS token generation for signed URLs
- Automatic container creation
- Container client caching

**Storage Path Format:**
```
https://{account}.blob.core.windows.net/{container}/{user-id-guid}/{filename}
```

**Signed URL Permissions:**
- Upload: `cw` (create, write)
- Download: `r` (read)

### 6.3 GCP Cloud Storage Provider

**Location:** `src/server/src/modules/storage/providers/gcp-storage.provider.ts`

**Dependencies:**
- `@google-cloud/storage`

**Configuration:**
```typescript
interface GcpConfig {
  projectId?: string;       // Auto-detected from credentials if missing
  keyFilePath?: string;     // Path to service account JSON
  credentials?: string;     // JSON credentials as string
  buckets: {
    kyc: string;
    policies: string;
    claims: string;
  };
}
```

**Key Features:**
- Key file or JSON credentials authentication
- V4 signed URL generation
- Automatic bucket creation
- Bucket reference caching

**Storage Path Format:**
```
gs://{bucket-name}/{user-id-guid}/{sanitized-filename}
```

### 6.4 Local Filesystem Provider

**Location:** `src/server/src/modules/storage/providers/local-storage.provider.ts`

**Dependencies:**
- Node.js `fs/promises`
- Node.js `crypto` (for MD5 etag)

**Configuration:**
```typescript
interface LocalConfig {
  basePath: string;  // Default: './docstore'
  buckets: {
    kyc: string;
    policies: string;
    claims: string;
  };
}
```

**Storage Structure:**
```
./docstore/
├── kyc-documents/
│   └── {user-id-guid}/
│       ├── national_id_front.jpg
│       ├── national_id_front.jpg.meta.json  # Metadata file
│       └── national_id_back.jpg
├── policy-documents/
│   └── {user-id-guid}/
│       └── policy_12345.pdf
└── claim-documents/
    └── {user-id-guid}/
        └── claim_photo.jpg
```

**Metadata File Format:**
```json
{
  "contentType": "image/jpeg",
  "metadata": {
    "documentType": "ID_FRONT"
  },
  "uploadedAt": "2024-12-15T10:30:00Z",
  "size": 245678
}
```

**Limitations:**
- No signed URL support (returns error)
- Single-machine only (no horizontal scaling)
- Intended for development/testing only

### 6.5 Provider Comparison

| Feature | AWS S3 | Azure Blob | GCP Storage | Local FS |
|---------|--------|------------|-------------|----------|
| Signed Upload URLs | Yes | Yes (SAS) | Yes (V4) | No |
| Signed Download URLs | Yes | Yes (SAS) | Yes (V4) | No |
| Auto-bucket Creation | Yes | Yes | Yes | Yes |
| Public ACL | Yes | Yes | Yes | N/A |
| Metadata Storage | Native | Native | Native | JSON file |
| Production Ready | Yes | Yes | Yes | No |
| S3-Compatible | Yes | No | No | No |

---

## 7. Sequence Diagrams

### 7.1 Document Upload Flow

```
┌────────┐     ┌─────────────┐     ┌─────────────────┐     ┌──────────┐
│ Client │     │   KYC Svc   │     │ Storage Service │     │ Provider │
└───┬────┘     └──────┬──────┘     └────────┬────────┘     └────┬─────┘
    │                 │                     │                   │
    │ Upload Document │                     │                   │
    │────────────────>│                     │                   │
    │                 │                     │                   │
    │                 │ uploadKycDocument() │                   │
    │                 │────────────────────>│                   │
    │                 │                     │                   │
    │                 │                     │ Validate userId   │
    │                 │                     │ (GUID format)     │
    │                 │                     │                   │
    │                 │                     │ Sanitize fileName │
    │                 │                     │ (remove path chars)│
    │                 │                     │                   │
    │                 │                     │ upload(KYC, ...)  │
    │                 │                     │──────────────────>│
    │                 │                     │                   │
    │                 │                     │                   │ Store file
    │                 │                     │                   │ to backend
    │                 │                     │                   │
    │                 │                     │ StorageUploadResult│
    │                 │                     │<──────────────────│
    │                 │                     │                   │
    │                 │ { key, etag, size } │                   │
    │                 │<────────────────────│                   │
    │                 │                     │                   │
    │   Document ID   │                     │                   │
    │<────────────────│                     │                   │
    │                 │                     │                   │
```

### 7.2 Signed URL Flow

```
┌────────┐     ┌───────────┐     ┌─────────────────┐     ┌──────────┐
│ Client │     │  API Svc  │     │ Storage Service │     │ Provider │
└───┬────┘     └─────┬─────┘     └────────┬────────┘     └────┬─────┘
    │                │                    │                   │
    │ Request Upload │                    │                   │
    │ URL            │                    │                   │
    │───────────────>│                    │                   │
    │                │                    │                   │
    │                │ getSignedUploadUrl │                   │
    │                │───────────────────>│                   │
    │                │                    │                   │
    │                │                    │ getSignedUploadUrl│
    │                │                    │──────────────────>│
    │                │                    │                   │
    │                │                    │                   │ Generate
    │                │                    │                   │ signed URL
    │                │                    │                   │
    │                │                    │ { url, expiresAt }│
    │                │                    │<──────────────────│
    │                │                    │                   │
    │                │ Signed URL         │                   │
    │                │<───────────────────│                   │
    │                │                    │                   │
    │   { url,       │                    │                   │
    │     expiresAt }│                    │                   │
    │<───────────────│                    │                   │
    │                │                    │                   │
    │ Upload directly│                    │                   │
    │ to storage     │                    │                   │
    │─────────────────────────────────────────────────────────>
    │                │                    │                   │
```

### 7.3 GDPR User Data Deletion

```
┌────────────┐     ┌────────────┐     ┌─────────────────┐     ┌──────────┐
│ Admin User │     │ User Svc   │     │ Storage Service │     │ Provider │
└─────┬──────┘     └─────┬──────┘     └────────┬────────┘     └────┬─────┘
      │                  │                     │                   │
      │ Delete User      │                     │                   │
      │ Account          │                     │                   │
      │─────────────────>│                     │                   │
      │                  │                     │                   │
      │                  │ deleteAllUserDocs() │                   │
      │                  │────────────────────>│                   │
      │                  │                     │                   │
      │                  │                     │ deleteUserData()  │
      │                  │                     │──────────────────>│
      │                  │                     │                   │
      │                  │                     │                   │ For each bucket:
      │                  │                     │                   │  - List files
      │                  │                     │                   │  - Delete all
      │                  │                     │                   │
      │                  │                     │ DeleteResult      │
      │                  │                     │<──────────────────│
      │                  │                     │                   │
      │                  │ Result              │                   │
      │                  │<────────────────────│                   │
      │                  │                     │                   │
      │                  │ Delete user record  │                   │
      │                  │ from database       │                   │
      │                  │                     │                   │
      │   Success        │                     │                   │
      │<─────────────────│                     │                   │
      │                  │                     │                   │
```

---

## 8. Security & Data Protection

### 8.1 Path Traversal Prevention

All providers implement strict validation to prevent path traversal attacks:

```typescript
private validateUserId(userId: string): boolean {
  // Only allow valid UUID v4 format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

private sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\/\\]/g, '')  // Remove path separators
    .replace(/\.\./g, '')    // Remove parent directory refs
    .replace(/^\./, '');     // Remove leading dots
}
```

### 8.2 User Data Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA ISOLATION MODEL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Storage Root                                                   │
│  └── kyc-documents/                                             │
│      ├── a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d/  ← User A       │
│      │   ├── national_id_front.jpg                              │
│      │   └── drivers_license.jpg                                │
│      │                                                          │
│      └── 12345678-1234-4567-8901-234567890abc/  ← User B       │
│          ├── national_id_front.jpg                              │
│          └── passport_photo.jpg                                 │
│                                                                 │
│  User A CANNOT access User B's documents:                       │
│  - Path construction requires valid UUID                        │
│  - No wildcard or glob operations exposed                       │
│  - No directory listing without user ID                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 PII Masking in Logs

All logging masks user IDs to prevent PII exposure:

```typescript
private maskUserId(userId: string): string {
  // Show only last 8 characters
  return '...' + userId.slice(-8);
}

// Log output: "Uploading document for user ...7c8d to bucket kyc"
```

### 8.4 Access Control

| ACL Setting | AWS S3 | Azure Blob | GCP Storage |
|-------------|--------|------------|-------------|
| `private` | Private | Private | Private |
| `public-read` | Public Read | Public Blob | allUsers:READER |

Default ACL is `private` for all document types.

### 8.5 Signed URL Security

```typescript
interface SignedUrlSecurity {
  // Default expiration: 1 hour
  defaultExpiresIn: 3600;

  // Maximum allowed expiration
  maxExpiresIn: 86400;  // 24 hours

  // Upload URLs require content-type
  uploadRequiresContentType: true;

  // URLs are single-use (for uploads)
  singleUse: true;
}
```

---

## 9. Configuration

### 9.1 Environment Variables

```bash
# Provider Selection
STORAGE_PROVIDER=aws  # aws | azure | gcp | local

# Bucket Names (shared across providers)
STORAGE_BUCKET_KYC=bodainsure-kyc-documents
STORAGE_BUCKET_POLICIES=bodainsure-policy-documents
STORAGE_BUCKET_CLAIMS=bodainsure-claim-documents

# AWS S3 Configuration
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_ENDPOINT=http://localhost:9000  # Optional: for MinIO

# Azure Blob Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
# Or:
AZURE_STORAGE_ACCOUNT_NAME=bodainsurestorage
AZURE_STORAGE_ACCOUNT_KEY=your-account-key

# GCP Cloud Storage Configuration
GCP_PROJECT_ID=bodainsure-prod
GCP_KEY_FILE_PATH=/etc/secrets/gcp-service-account.json
# Or:
GCP_CREDENTIALS='{"type":"service_account",...}'

# Local Storage Configuration (development)
STORAGE_LOCAL_BASE_PATH=./docstore
```

### 9.2 App Config Structure

```typescript
// config/app.config.ts
export default {
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    buckets: {
      kyc: process.env.STORAGE_BUCKET_KYC || 'kyc-documents',
      policies: process.env.STORAGE_BUCKET_POLICIES || 'policy-documents',
      claims: process.env.STORAGE_BUCKET_CLAIMS || 'claim-documents',
    },
    aws: {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      forcePathStyle: !!process.env.AWS_S3_ENDPOINT,
    },
    azure: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
      keyFilePath: process.env.GCP_KEY_FILE_PATH,
      credentials: process.env.GCP_CREDENTIALS,
    },
    local: {
      basePath: process.env.STORAGE_LOCAL_BASE_PATH || './docstore',
    },
  },
};
```

### 9.3 Development Configuration (MinIO)

For local development, MinIO provides S3-compatible storage:

```yaml
# docker-compose.yml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  ports:
    - "9000:9000"   # S3 API
    - "9001:9001"   # Console UI
```

```bash
# .env for MinIO
STORAGE_PROVIDER=aws
AWS_S3_ENDPOINT=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_REGION=us-east-1
```

---

## 10. Integration Points

### 10.1 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                   STORAGE MODULE INTEGRATIONS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │   KYC Module    │                                            │
│  │                 │───────▶  KYC document upload/download      │
│  │                 │          - ID documents                    │
│  │                 │          - License scans                   │
│  │                 │          - Profile photos                  │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  Policy Module  │                                            │
│  │                 │───────▶  Policy PDF storage                │
│  │                 │          - Generated certificates          │
│  │                 │          - Terms documents                 │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │ Identity Module │                                            │
│  │                 │───────▶  GDPR data deletion                │
│  │                 │          - deleteAllUserDocuments()        │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  Claims Module  │                                            │
│  │   (Future)      │───────▶  Claims evidence storage           │
│  │                 │          - Accident photos                 │
│  │                 │          - Medical documents               │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 KYC Module Integration

```typescript
// kyc/services/document.service.ts
@Injectable()
export class DocumentService {
  constructor(private readonly storageService: StorageService) {}

  async uploadDocument(
    userId: string,
    documentType: DocumentType,
    file: Express.Multer.File
  ): Promise<Document> {
    // Generate unique filename
    const fileName = `${documentType}_${Date.now()}_${file.originalname}`;

    // Upload to storage
    const result = await this.storageService.uploadKycDocument(
      userId,
      fileName,
      file.buffer,
      {
        contentType: file.mimetype,
        metadata: { documentType, originalName: file.originalname }
      }
    );

    if (!result.success) {
      throw new InternalServerErrorException(result.error);
    }

    // Create database record with storage reference
    return this.documentRepository.save({
      userId,
      documentType,
      storageKey: result.key,
      storagePath: result.key,
      fileHash: result.etag,
      fileSize: result.size,
      mimeType: file.mimetype,
    });
  }
}
```

### 10.3 Policy Module Integration

```typescript
// policy/services/pdf-generation.service.ts
@Injectable()
export class PdfGenerationService {
  constructor(private readonly storageService: StorageService) {}

  async storePolicyPdf(
    userId: string,
    policyNumber: string,
    pdfBuffer: Buffer
  ): Promise<string> {
    const fileName = `policy_${policyNumber}.pdf`;

    const result = await this.storageService.uploadPolicyDocument(
      userId,
      fileName,
      pdfBuffer,
      {
        contentType: 'application/pdf',
        metadata: { policyNumber, generatedAt: new Date().toISOString() }
      }
    );

    if (!result.success) {
      throw new Error(`Failed to store policy PDF: ${result.error}`);
    }

    return result.key;
  }
}
```

---

## 11. Error Handling

### 11.1 Error Response Pattern

All provider methods return result objects instead of throwing exceptions:

```typescript
interface StorageResult {
  success: boolean;
  error?: string;
  // ... other fields
}
```

### 11.2 Common Error Scenarios

| Error | Cause | Handling |
|-------|-------|----------|
| Invalid User ID | Non-UUID format | Return `{ success: false, error: 'Invalid user ID format' }` |
| File Not Found | Key doesn't exist | Return `{ success: false, error: 'File not found' }` |
| Permission Denied | Invalid credentials | Return `{ success: false, error: 'Access denied' }` |
| Bucket Not Found | Bucket doesn't exist | Auto-create during init, or error |
| Upload Failed | Network/quota issues | Return with error message |

### 11.3 Initialization Errors

Providers create buckets/containers during initialization. If this fails:

```typescript
async initialize(): Promise<void> {
  try {
    for (const bucket of Object.values(this.buckets)) {
      await this.createBucketIfNotExists(bucket);
    }
    this.logger.log('Storage provider initialized successfully');
  } catch (error) {
    this.logger.error(`Failed to initialize storage: ${error.message}`);
    throw error;  // Prevent app startup with broken storage
  }
}
```

### 11.4 Retry Strategy

For transient failures, calling code should implement retry logic:

```typescript
async uploadWithRetry(
  userId: string,
  fileName: string,
  data: Buffer,
  maxRetries = 3
): Promise<StorageUploadResult> {
  let lastError: string;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await this.storageService.uploadKycDocument(
      userId, fileName, data, {}
    );

    if (result.success) {
      return result;
    }

    lastError = result.error;
    await this.delay(attempt * 1000);  // Exponential backoff
  }

  return { success: false, error: `Failed after ${maxRetries} attempts: ${lastError}` };
}
```

---

## Business Rules

| Rule ID | Rule | Implementation |
|---------|------|----------------|
| BR-001 | All user documents must be isolated by user ID | Path format: `{bucket}/{userId}/{filename}` |
| BR-002 | User IDs must be valid UUIDs | GUID validation before all operations |
| BR-003 | Filenames must be sanitized | Remove path separators, parent refs, leading dots |
| BR-004 | Signed URLs expire in 1 hour by default | Configurable via `expiresIn` option |
| BR-005 | All documents default to private ACL | Only explicitly set public-read |
| BR-006 | GDPR deletion must remove all user documents | `deleteUserData()` iterates all buckets |
| BR-007 | PII must be masked in logs | Only show last 8 chars of user ID |
| BR-008 | Provider selection via config only | No code changes to switch providers |

---

## Related Documentation

- [KYC Module Architecture](./KYC_MODULE.md) - Document upload integration
- [Policy Module Architecture](./POLICY_MODULE.md) - Policy PDF storage
- [High-Level Architecture](../HIGH_LEVEL_ARCHITECTURE.md) - System overview
