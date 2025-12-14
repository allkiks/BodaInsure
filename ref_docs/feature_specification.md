# BodaInsure Platform — Feature Specification

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Document Owner:** Product & Engineering  
**Status:** Draft  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Feature Index](#2-feature-index)
3. [User Registration & Authentication Features](#3-user-registration--authentication-features)
4. [KYC & Document Management Features](#4-kyc--document-management-features)
5. [Payment & Wallet Features](#5-payment--wallet-features)
6. [Policy Management Features](#6-policy-management-features)
7. [Organization Management Features](#7-organization-management-features)
8. [Notification Features](#8-notification-features)
9. [Reporting & Analytics Features](#9-reporting--analytics-features)
10. [Administrative Features](#10-administrative-features)
11. [USSD Channel Features](#11-ussd-channel-features)
12. [Gaps & Missing Specifications](#12-gaps--missing-specifications)
13. [Related Documents](#13-related-documents)

---

## 1. Introduction

### 1.1 Purpose

This document provides detailed feature specifications for the BodaInsure platform. Each feature is defined with inputs, outputs, UI states, backend interactions, edge cases, and constraints.

### 1.2 Audience

- Product Managers
- UX/UI Designers
- Software Engineers
- QA Engineers

### 1.3 Feature Specification Template

Each feature follows this structure:

| Section | Description |
|---------|-------------|
| **Feature ID** | Unique identifier (FEAT-XXX-NNN) |
| **Name** | Descriptive feature name |
| **Priority** | P1 (MVP), P2 (Important), P3 (Enhancement) |
| **Description** | What the feature does |
| **User Story** | As a [role], I want [capability] so that [benefit] |
| **Inputs** | Data/actions required from user or system |
| **Outputs** | Results produced by the feature |
| **UI States** | Visual states and transitions |
| **Backend Interactions** | API calls and data flows |
| **Business Rules** | Logic governing feature behavior |
| **Edge Cases** | Exceptional scenarios and handling |
| **Constraints** | Technical or business limitations |
| **Acceptance Criteria** | Testable conditions for completion |
| **Dependencies** | Related features or systems |

### 1.4 Related Documents

| Document | Link |
|----------|------|
| Product Description | [product_description.md](product_description.md) |
| Module Architecture | [module_architecture.md](module_architecture.md) |
| Requirements Specification | [requirements_specification.md](requirements_specification.md) |

---

## 2. Feature Index

### 2.1 Feature Summary by Module

| Module | Feature ID | Feature Name | Priority |
|--------|------------|--------------|----------|
| **Authentication** | FEAT-AUTH-001 | Phone Number Registration | P1 |
| **Authentication** | FEAT-AUTH-002 | OTP Verification | P1 |
| **Authentication** | FEAT-AUTH-003 | User Login | P1 |
| **Authentication** | FEAT-AUTH-004 | Session Management | P1 |
| **KYC** | FEAT-KYC-001 | Document Capture | P1 |
| **KYC** | FEAT-KYC-002 | Document Upload | P1 |
| **KYC** | FEAT-KYC-003 | KYC Status Display | P1 |
| **KYC** | FEAT-KYC-004 | Document Re-submission | P1 |
| **Payment** | FEAT-PAY-001 | Initial Deposit Payment | P1 |
| **Payment** | FEAT-PAY-002 | Daily Payment | P1 |
| **Payment** | FEAT-PAY-003 | Wallet Balance View | P1 |
| **Payment** | FEAT-PAY-004 | Transaction History | P1 |
| **Payment** | FEAT-PAY-005 | Payment Reminder Settings | P2 |
| **Policy** | FEAT-POL-001 | Policy Status View | P1 |
| **Policy** | FEAT-POL-002 | Policy Document Download | P1 |
| **Policy** | FEAT-POL-003 | Policy Expiry Notification | P1 |
| **Organization** | FEAT-ORG-001 | SACCO Member List | P1 |
| **Organization** | FEAT-ORG-002 | Bulk Member Import | P2 |
| **Organization** | FEAT-ORG-003 | Member Compliance Dashboard | P1 |
| **Notification** | FEAT-NOT-001 | Payment Reminder | P1 |
| **Notification** | FEAT-NOT-002 | Policy Delivery | P1 |
| **Reporting** | FEAT-RPT-001 | Enrollment Dashboard | P1 |
| **Reporting** | FEAT-RPT-002 | Payment Dashboard | P1 |
| **Reporting** | FEAT-RPT-003 | Report Export | P2 |
| **Admin** | FEAT-ADM-001 | User Lookup | P1 |
| **Admin** | FEAT-ADM-002 | Manual Adjustment | P2 |
| **USSD** | FEAT-USSD-001 | USSD Balance Check | P1 |
| **USSD** | FEAT-USSD-002 | USSD Payment | P1 |
| **USSD** | FEAT-USSD-003 | USSD Policy Status | P1 |

---

## 3. User Registration & Authentication Features

### FEAT-AUTH-001: Phone Number Registration

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-AUTH-001 |
| **Priority** | P1 |
| **Description** | Allows new users to register using their mobile phone number as the primary identifier |
| **User Story** | As a bodaboda rider, I want to register with my phone number so that I can create an account without needing email or passwords |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Phone Number | String | Kenyan format (07xx/01xx), 10 digits | Yes |
| Terms Acceptance | Boolean | Must be true | Yes |
| Language Preference | Enum | en, sw | No (default: en) |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Registration Status | Enum | SUCCESS, DUPLICATE, INVALID_PHONE, ERROR |
| User ID | UUID | Generated on success |
| OTP Sent | Boolean | Indicates OTP dispatch |

#### UI States

```
┌─────────────────────────────────────────┐
│           REGISTRATION SCREEN           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🇰🇪  +254 │ 712 345 678        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ☑ I accept the Terms of Service        │
│    and Privacy Policy                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         CONTINUE                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Already have an account? Log in        │
│                                         │
└─────────────────────────────────────────┘

State Transitions:
─────────────────
INITIAL → PHONE_ENTERED → TERMS_ACCEPTED → SUBMITTING → OTP_SCREEN
                                              │
                                              ├── ERROR (invalid phone)
                                              └── ERROR (duplicate)
```

#### Backend Interactions

```
Mobile App                    API Gateway                   Identity Service
    │                              │                              │
    │  POST /auth/register         │                              │
    │  {phone: "0712345678"}       │                              │
    │─────────────────────────────▶│                              │
    │                              │   Validate phone format      │
    │                              │─────────────────────────────▶│
    │                              │                              │
    │                              │   Check duplicate            │
    │                              │─────────────────────────────▶│
    │                              │                              │
    │                              │   Create user (PENDING)      │
    │                              │─────────────────────────────▶│
    │                              │                              │
    │                              │   Trigger OTP                │
    │                              │─────────────────────────────▶│
    │                              │                              │
    │  {status: "SUCCESS",         │                              │
    │   user_id: "uuid",           │                              │
    │   otp_sent: true}            │                              │
    │◀─────────────────────────────│                              │
    │                              │                              │
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Phone number must be unique across all users |
| BR-002 | Phone number must be valid Kenyan mobile format |
| BR-003 | Terms must be accepted before registration proceeds |
| BR-004 | User created in PENDING status until OTP verified |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate phone number | Display "Phone already registered. Log in instead" |
| Invalid phone format | Display "Please enter a valid Kenyan phone number" |
| Network timeout | Display "Connection error. Please try again" with retry button |
| SMS delivery failure | Allow retry after 60 seconds |
| User abandons mid-flow | User record remains PENDING, can resume |

#### Constraints

- Phone numbers stored in E.164 format internally (+254...)
- Registration rate limited to 5 attempts per phone per hour
- OTP auto-triggered on successful registration (no separate action)

#### Acceptance Criteria

- [ ] AC1: User can enter 10-digit phone number (07xx or 01xx format)
- [ ] AC2: System validates phone format before submission
- [ ] AC3: System rejects duplicate phone numbers with clear message
- [ ] AC4: User must accept terms to proceed
- [ ] AC5: OTP sent within 10 seconds of successful registration
- [ ] AC6: Swahili language option available

#### Dependencies

- SMS Gateway integration
- FEAT-AUTH-002 (OTP Verification)

---

### FEAT-AUTH-002: OTP Verification

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-AUTH-002 |
| **Priority** | P1 |
| **Description** | Verifies user phone ownership via One-Time Password |
| **User Story** | As a new user, I want to verify my phone number so that my account is activated securely |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| OTP Code | String | 6 digits | Yes |
| Phone Number | String | From previous screen (hidden) | Yes |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Verification Status | Enum | SUCCESS, INVALID_OTP, EXPIRED_OTP, MAX_ATTEMPTS |
| Auth Token | JWT | Returned on success |
| Refresh Token | String | For session extension |

#### UI States

```
┌─────────────────────────────────────────┐
│          VERIFY YOUR NUMBER             │
├─────────────────────────────────────────┤
│                                         │
│  We sent a code to 0712 345 678         │
│                                         │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │  │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘  │
│                                         │
│  Didn't receive code?                   │
│  Resend in 45 seconds                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │          VERIFY                 │   │  ← Disabled until 6 digits
│  └─────────────────────────────────┘   │
│                                         │
│  ← Change phone number                  │
│                                         │
└─────────────────────────────────────────┘

Error State:
┌─────────────────────────────────────────┐
│  ⚠ Incorrect code. 2 attempts left.    │
└─────────────────────────────────────────┘

Expired State:
┌─────────────────────────────────────────┐
│  ⚠ Code expired. Request a new one.    │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
POST /auth/otp/verify
Request:
{
  "phone": "+254712345678",
  "otp": "123456"
}

Response (Success):
{
  "status": "SUCCESS",
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "expires_in": 2592000,
  "user": {
    "id": "uuid",
    "phone": "+254712345678",
    "status": "ACTIVE",
    "kyc_status": "PENDING"
  }
}

Response (Failure):
{
  "status": "INVALID_OTP",
  "attempts_remaining": 2,
  "message": "Incorrect verification code"
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | OTP valid for 5 minutes from generation |
| BR-002 | Maximum 5 verification attempts per OTP |
| BR-003 | Maximum 3 OTP requests per phone per hour |
| BR-004 | Successful verification activates user account |
| BR-005 | Resend allowed after 60-second cooldown |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| OTP expired | Display "Code expired" + enable resend |
| Max attempts exceeded | Lock for 30 minutes, display message |
| User closes app mid-verification | OTP remains valid; can resume |
| Multiple OTPs requested | Only latest OTP is valid |
| Copy-paste OTP | Supported; auto-submit on 6 digits |

#### Constraints

- OTP is 6 numeric digits
- OTP stored hashed, compared server-side
- Rate limiting enforced at API gateway level
- Auto-read OTP from SMS supported on Android

#### Acceptance Criteria

- [ ] AC1: 6-digit OTP input with auto-advance between boxes
- [ ] AC2: Invalid OTP shows error with remaining attempts
- [ ] AC3: Expired OTP shows expiry message with resend option
- [ ] AC4: Resend button disabled for 60 seconds after send
- [ ] AC5: Successful verification navigates to KYC flow
- [ ] AC6: Change phone number option returns to registration

#### Dependencies

- FEAT-AUTH-001 (Registration)
- SMS Gateway

---

### FEAT-AUTH-003: User Login

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-AUTH-003 |
| **Priority** | P1 |
| **Description** | Authenticates returning users via phone number and OTP |
| **User Story** | As a returning rider, I want to log in with my phone number so that I can access my account |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Phone Number | String | Kenyan format, 10 digits | Yes |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Login Status | Enum | OTP_SENT, USER_NOT_FOUND, ACCOUNT_LOCKED |

#### UI States

```
┌─────────────────────────────────────────┐
│              WELCOME BACK               │
├─────────────────────────────────────────┤
│                                         │
│  Enter your phone number                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🇰🇪  +254 │ 712 345 678        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         SEND CODE               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  New to BodaInsure? Register            │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
POST /auth/login
Request:
{
  "phone": "+254712345678"
}

Response:
{
  "status": "OTP_SENT",
  "message": "Verification code sent to your phone"
}
```

*After OTP entry, same flow as FEAT-AUTH-002*

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | User must exist in system |
| BR-002 | Account must not be locked/suspended |
| BR-003 | OTP sent to registered phone number |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Unregistered phone | Display "Account not found. Register instead" |
| Suspended account | Display "Account suspended. Contact support" |
| Locked account (too many attempts) | Display lockout duration |

#### Acceptance Criteria

- [ ] AC1: Registered user receives OTP on login request
- [ ] AC2: Unregistered phone shows registration prompt
- [ ] AC3: Locked account shows appropriate message

#### Dependencies

- FEAT-AUTH-002 (OTP Verification)

---

### FEAT-AUTH-004: Session Management

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-AUTH-004 |
| **Priority** | P1 |
| **Description** | Manages user sessions across app lifecycle |
| **User Story** | As a user, I want to stay logged in so that I don't have to enter OTP every time |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Access Token | JWT | From login/registration |
| Refresh Token | String | For token renewal |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| New Access Token | JWT | When refreshed |
| Session Status | Enum | ACTIVE, EXPIRED, REVOKED |

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Mobile app sessions valid for 30 days |
| BR-002 | Web portal sessions valid for 30 minutes (idle) |
| BR-003 | USSD sessions timeout after 180 seconds |
| BR-004 | Token refresh extends session without re-auth |
| BR-005 | Logout revokes all tokens for user |

#### Backend Interactions

```
POST /auth/token/refresh
Request:
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 2592000
}
```

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Token expired | Redirect to login |
| Refresh token expired | Require full re-authentication |
| Concurrent sessions | All sessions remain valid |
| Force logout (admin) | All sessions invalidated |

#### Acceptance Criteria

- [ ] AC1: User stays logged in for 30 days on mobile
- [ ] AC2: Token auto-refreshes before expiry
- [ ] AC3: Logout clears all local session data
- [ ] AC4: Expired session redirects to login gracefully

---

## 4. KYC & Document Management Features

### FEAT-KYC-001: Document Capture

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-KYC-001 |
| **Priority** | P1 |
| **Description** | Captures KYC documents using device camera with quality guidance |
| **User Story** | As a rider, I want to take photos of my documents so that I can complete registration without visiting an office |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Camera Frame | Image | Live preview | Yes |
| Document Type | Enum | ID_FRONT, ID_BACK, LICENSE, LOGBOOK, KRA_PIN, PHOTO | Yes |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Captured Image | JPEG | Processed image file |
| Quality Score | Number | 0-100 quality assessment |
| Quality Warnings | Array | Issues detected (blur, lighting, etc.) |

#### UI States

```
┌─────────────────────────────────────────┐
│         CAPTURE NATIONAL ID             │
│              (Front Side)               │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │    ┌───────────────────────┐    │   │
│  │    │                       │    │   │
│  │    │   [Camera Preview]    │    │   │
│  │    │                       │    │   │
│  │    │   ┌─────────────┐     │    │   │
│  │    │   │  ID OUTLINE │     │    │   │  ← Alignment guide
│  │    │   └─────────────┘     │    │   │
│  │    │                       │    │   │
│  │    └───────────────────────┘    │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  💡 Tips:                               │
│  • Ensure good lighting                 │
│  • Keep document flat                   │
│  • Fill the frame                       │
│                                         │
│           ┌─────────┐                   │
│           │   📷    │                   │  ← Capture button
│           └─────────┘                   │
│                                         │
└─────────────────────────────────────────┘

Quality Warning State:
┌─────────────────────────────────────────┐
│  ⚠ Image appears blurry                │
│  ┌─────────┐  ┌─────────┐              │
│  │  Retry  │  │  Use    │              │
│  └─────────┘  └─────────┘              │
└─────────────────────────────────────────┘
```

#### Backend Interactions

*Capture is client-side only. Image processed locally before upload.*

```
Client-side processing:
1. Capture raw image from camera
2. Crop to document bounds (edge detection)
3. Adjust perspective (deskew)
4. Enhance contrast/brightness
5. Compress to <2MB JPEG
6. Calculate quality score
7. Store locally pending upload
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Camera permission required |
| BR-002 | Minimum image resolution: 1280x720 |
| BR-003 | Quality score <50 triggers warning |
| BR-004 | User can override quality warnings |
| BR-005 | Flash available for low-light conditions |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Camera permission denied | Show settings prompt |
| Low light detected | Enable flash toggle, show warning |
| Blurry image | Show warning, suggest retry |
| Document not detected | Show alignment guidance |
| Storage full | Prompt to free space |

#### Constraints

- Supported devices: Android 5.0+, iOS 12.0+
- Output format: JPEG, max 2MB
- Processing time: <3 seconds on mid-range device

#### Acceptance Criteria

- [ ] AC1: Camera opens with document type frame overlay
- [ ] AC2: Visual guidance shows alignment hints
- [ ] AC3: Quality issues detected and warned
- [ ] AC4: User can retake or accept with warnings
- [ ] AC5: Captured images stored locally for upload

#### Dependencies

- Device camera
- FEAT-KYC-002 (Document Upload)

---

### FEAT-KYC-002: Document Upload

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-KYC-002 |
| **Priority** | P1 |
| **Description** | Uploads captured documents to server with progress tracking |
| **User Story** | As a rider, I want to upload my documents so that my identity can be verified |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Document Image | File | JPEG/PNG, <10MB | Yes |
| Document Type | Enum | ID_FRONT, ID_BACK, LICENSE, LOGBOOK, KRA_PIN, PHOTO | Yes |
| User ID | UUID | From session | Yes |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Upload Status | Enum | SUCCESS, FAILED, PROCESSING |
| Document ID | UUID | Reference for uploaded document |
| Validation Result | Object | Preliminary validation feedback |

#### UI States

```
Document Checklist Screen:
┌─────────────────────────────────────────┐
│          UPLOAD DOCUMENTS               │
├─────────────────────────────────────────┤
│                                         │
│  Complete all documents to proceed      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ✅ National ID (Front)     [✓] │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ✅ National ID (Back)      [✓] │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ⏳ Driver's License    [Uploading] │   │
│  │    ████████░░░░░░░░░░░░  45%   │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ⭕ Motorcycle Logbook   [Add]  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ⭕ KRA PIN Certificate  [Add]  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ⭕ Passport Photo       [Add]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      SUBMIT FOR REVIEW          │   │  ← Disabled until all uploaded
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
POST /kyc/documents
Content-Type: multipart/form-data

Request:
{
  "document_type": "ID_FRONT",
  "file": <binary>,
  "metadata": {
    "captured_at": "2024-12-01T10:30:00Z",
    "device": "Samsung A52",
    "quality_score": 85
  }
}

Response:
{
  "document_id": "uuid",
  "status": "PROCESSING",
  "validation": {
    "quality": "PASS",
    "type_match": "PASS",
    "readability": "PROCESSING"
  }
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | All 6 document types required before payment |
| BR-002 | Upload retries automatically on network failure |
| BR-003 | Offline queue: documents stored locally until connectivity |
| BR-004 | Previous document replaced if same type uploaded again |
| BR-005 | Maximum 3 versions per document type |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Network loss during upload | Queue locally, retry when online |
| Upload timeout | Retry with exponential backoff |
| Server rejects file (too large) | Compress and retry |
| Duplicate upload | Replace previous version |
| All uploads complete | Enable submission button |

#### Constraints

- Maximum file size: 10MB per document
- Supported formats: JPEG, PNG
- Concurrent uploads: max 2
- Offline queue: max 20MB total

#### Acceptance Criteria

- [ ] AC1: Progress bar shows upload percentage
- [ ] AC2: Failed uploads retry automatically
- [ ] AC3: Offline uploads queued and synced
- [ ] AC4: User can replace uploaded documents
- [ ] AC5: All documents required before proceeding

#### Dependencies

- FEAT-KYC-001 (Document Capture)
- Object Storage (S3/GCS)

---

### FEAT-KYC-003: KYC Status Display

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-KYC-003 |
| **Priority** | P1 |
| **Description** | Shows user their current KYC verification status |
| **User Story** | As a rider, I want to see my verification status so that I know if I can proceed to payment |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| User ID | UUID | From session |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| KYC Status | Enum | PENDING, IN_REVIEW, APPROVED, REJECTED, INCOMPLETE |
| Document Status | Array | Per-document status |
| Rejection Reasons | Array | If rejected, specific issues |

#### UI States

```
APPROVED State:
┌─────────────────────────────────────────┐
│          VERIFICATION STATUS            │
├─────────────────────────────────────────┤
│                                         │
│            ✅                           │
│       VERIFIED                          │
│                                         │
│  Your documents have been verified.     │
│  You can now make your first payment.   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      CONTINUE TO PAYMENT        │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘

IN_REVIEW State:
┌─────────────────────────────────────────┐
│          VERIFICATION STATUS            │
├─────────────────────────────────────────┤
│                                         │
│            ⏳                           │
│       IN REVIEW                         │
│                                         │
│  We're reviewing your documents.        │
│  This usually takes 1-2 hours.          │
│                                         │
│  We'll notify you when complete.        │
│                                         │
└─────────────────────────────────────────┘

REJECTED State:
┌─────────────────────────────────────────┐
│          VERIFICATION STATUS            │
├─────────────────────────────────────────┤
│                                         │
│            ❌                           │
│    ACTION REQUIRED                      │
│                                         │
│  Some documents need attention:         │
│                                         │
│  ⚠ National ID (Front)                 │
│    Image is too blurry to read          │
│    [Re-upload]                          │
│                                         │
│  ⚠ Driver's License                    │
│    License appears expired              │
│    [Re-upload]                          │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
GET /kyc/status

Response:
{
  "status": "REJECTED",
  "updated_at": "2024-12-01T12:00:00Z",
  "documents": [
    {
      "type": "ID_FRONT",
      "status": "REJECTED",
      "reason": "Image is too blurry to read"
    },
    {
      "type": "ID_BACK",
      "status": "APPROVED"
    },
    {
      "type": "LICENSE",
      "status": "REJECTED",
      "reason": "License appears expired"
    }
    // ... other documents
  ]
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | KYC must be APPROVED before payment allowed |
| BR-002 | Status updates trigger push notification |
| BR-003 | Rejected documents can be re-uploaded |
| BR-004 | Three rejections trigger manual review flag |

#### Acceptance Criteria

- [ ] AC1: Status displayed prominently on dashboard
- [ ] AC2: Rejection reasons clearly shown per document
- [ ] AC3: Re-upload option available for rejected documents
- [ ] AC4: Notification sent on status change

#### Dependencies

- FEAT-KYC-002 (Document Upload)
- Notification Module

---

### FEAT-KYC-004: Document Re-submission

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-KYC-004 |
| **Priority** | P1 |
| **Description** | Allows users to re-upload rejected documents |
| **User Story** | As a rider with rejected documents, I want to re-upload so that I can complete verification |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Document Type | Enum | Type being re-submitted |
| New Image | File | Replacement document |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Submission Status | Enum | SUCCESS, FAILED |
| New Document ID | UUID | Reference for new upload |

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Only rejected or incomplete documents can be re-submitted |
| BR-002 | Re-submission resets document status to IN_REVIEW |
| BR-003 | Previous versions retained for audit |
| BR-004 | Maximum 5 re-submissions per document type |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Max re-submissions reached | Prompt to contact support |
| Upload same image again | Accept but likely rejected again |
| Re-submit approved document | Not allowed; greyed out |

#### Acceptance Criteria

- [ ] AC1: Re-upload available only for rejected/incomplete documents
- [ ] AC2: Previous rejection reason displayed during re-upload
- [ ] AC3: Status updates to IN_REVIEW after re-submission
- [ ] AC4: Notification sent when re-reviewed

---

## 5. Payment & Wallet Features

### FEAT-PAY-001: Initial Deposit Payment

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-PAY-001 |
| **Priority** | P1 |
| **Description** | Processes the 1,048 KES initial deposit to activate first policy |
| **User Story** | As a verified rider, I want to pay my initial deposit so that I get my first month's policy |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Payment Amount | Number | Fixed at 1,048 KES | Yes |
| Phone Number | String | User's registered number | Yes (pre-filled) |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Payment Status | Enum | PENDING, COMPLETED, FAILED, CANCELLED |
| Transaction ID | UUID | Internal reference |
| M-Pesa Reference | String | Safaricom reference |
| Policy Trigger | Boolean | Whether policy generation triggered |

#### UI States

```
Payment Initiation:
┌─────────────────────────────────────────┐
│          INITIAL DEPOSIT                │
├─────────────────────────────────────────┤
│                                         │
│  Pay your deposit to get your           │
│  first month's insurance policy         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │     Amount: KES 1,048           │   │
│  │                                 │   │
│  │     Phone: 0712 345 678         │   │
│  │     (M-Pesa payment)            │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         PAY NOW                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  By paying, you agree to the            │
│  insurance terms and conditions.        │
│                                         │
└─────────────────────────────────────────┘

Awaiting Confirmation:
┌─────────────────────────────────────────┐
│          COMPLETE PAYMENT               │
├─────────────────────────────────────────┤
│                                         │
│            ⏳                           │
│                                         │
│  Check your phone for the               │
│  M-Pesa prompt and enter your PIN       │
│                                         │
│  Waiting for confirmation...            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │       CANCEL PAYMENT            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘

Success:
┌─────────────────────────────────────────┐
│          PAYMENT SUCCESSFUL             │
├─────────────────────────────────────────┤
│                                         │
│            ✅                           │
│                                         │
│  Your deposit has been received!        │
│                                         │
│  Transaction: QWE1234567                │
│  Amount: KES 1,048                      │
│                                         │
│  Your policy is being generated.        │
│  We'll send it via WhatsApp within      │
│  6 hours.                               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         CONTINUE                │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
Payment Flow:

┌──────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ App  │     │  API     │     │ Payment  │     │  M-Pesa  │
└──┬───┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
   │              │                │                │
   │ POST /payments/deposit        │                │
   │─────────────────────────────▶│                │
   │              │                │                │
   │              │  Create pending│                │
   │              │  transaction   │                │
   │              │───────────────▶│                │
   │              │                │                │
   │              │                │ STK Push       │
   │              │                │───────────────▶│
   │              │                │                │
   │ {status: "PENDING",          │                │
   │  message: "Check phone"}     │                │
   │◀─────────────────────────────│                │
   │              │                │                │
   │              │                │  Callback      │
   │              │                │◀───────────────│
   │              │                │                │
   │              │  Update status │                │
   │              │◀───────────────│                │
   │              │                │                │
   │ Push: "Payment successful"   │                │
   │◀─────────────────────────────│                │
```

```
POST /payments/deposit

Response (immediate):
{
  "transaction_id": "uuid",
  "status": "PENDING",
  "message": "Check your phone for M-Pesa prompt"
}

Callback processing updates:
{
  "transaction_id": "uuid",
  "status": "COMPLETED",
  "mpesa_ref": "QWE1234567",
  "amount": 1048,
  "wallet_balance": 1048,
  "policy_queued": true
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Deposit amount fixed at 1,048 KES |
| BR-002 | KYC must be APPROVED before deposit |
| BR-003 | Only one active deposit per user |
| BR-004 | Successful deposit triggers Policy 1 generation |
| BR-005 | Failed payment allows immediate retry |
| BR-006 | Transaction timeout after 120 seconds |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| M-Pesa timeout | Show timeout message, allow retry |
| Insufficient M-Pesa balance | Show M-Pesa error, suggest top-up |
| User cancels on phone | Status becomes CANCELLED, allow retry |
| Duplicate payment attempt | Block until previous completes/fails |
| Network loss after initiation | Poll for status on reconnect |
| M-Pesa system down | Show service unavailable, suggest retry later |

#### Constraints

- Payment only via M-Pesa (no card, bank transfer)
- Single phone number for payment (registered number)
- Minimum M-Pesa balance required: 1,048 KES + fees

#### Acceptance Criteria

- [ ] AC1: STK push received within 5 seconds of initiation
- [ ] AC2: Payment status updates in real-time
- [ ] AC3: Success confirmation shows M-Pesa reference
- [ ] AC4: Failed payment shows clear error and retry option
- [ ] AC5: Wallet balance updated on success
- [ ] AC6: Policy generation triggered on success

#### Dependencies

- M-Pesa Daraja API
- FEAT-KYC-003 (KYC Status must be APPROVED)
- Policy Module (FEAT-POL-001)

---

### FEAT-PAY-002: Daily Payment

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-PAY-002 |
| **Priority** | P1 |
| **Description** | Processes daily payments of 87 KES toward annual coverage completion |
| **User Story** | As a rider with active policy, I want to make daily payments so that I maintain my coverage |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Payment Amount | Number | Minimum 87 KES, multiples allowed | Yes |
| Days to Pay | Number | 1-30 remaining days | Yes |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Payment Status | Enum | PENDING, COMPLETED, FAILED |
| Days Paid | Number | Total days now paid |
| Days Remaining | Number | Days left in 30-day cycle |
| Policy 2 Triggered | Boolean | True if 30th payment |

#### UI States

```
Daily Payment Screen:
┌─────────────────────────────────────────┐
│          DAILY PAYMENT                  │
├─────────────────────────────────────────┤
│                                         │
│  Payment Progress                       │
│  ████████████░░░░░░░░░░░░░░  12/30     │
│                                         │
│  Days remaining: 18                     │
│  Amount to complete: KES 1,566          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Pay for how many days?         │   │
│  │                                 │   │
│  │    ┌───┐         ┌─────────┐   │   │
│  │    │ 1 │ day  =  │ KES  87 │   │   │
│  │    └───┘         └─────────┘   │   │
│  │                                 │   │
│  │    ─────────●─────────────     │   │  ← Slider
│  │    1         5           18    │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     PAY KES 87 (1 day)          │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘

Quick Pay Options:
┌─────────────────────────────────────────┐
│  Quick options:                         │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ 1 day  │ │ 7 days │ │  All   │      │
│  │ KES 87 │ │KES 609 │ │KES1566 │      │
│  └────────┘ └────────┘ └────────┘      │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
POST /payments/daily
Request:
{
  "days": 1,
  "amount": 87
}

Response:
{
  "transaction_id": "uuid",
  "status": "PENDING",
  "message": "Check phone for M-Pesa prompt"
}

On callback success:
{
  "transaction_id": "uuid",
  "status": "COMPLETED",
  "days_paid_total": 13,
  "days_remaining": 17,
  "wallet_balance": 2179,
  "policy_2_triggered": false
}

On 30th day payment:
{
  "transaction_id": "uuid",
  "status": "COMPLETED",
  "days_paid_total": 30,
  "days_remaining": 0,
  "wallet_balance": 3658,
  "policy_2_triggered": true,
  "message": "Congratulations! Your 11-month policy will be issued."
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Daily amount is 87 KES per day |
| BR-002 | User can pay multiple days at once |
| BR-003 | Maximum payment: remaining days × 87 KES |
| BR-004 | 30th payment triggers Policy 2 (11-month) generation |
| BR-005 | Payments accepted even if previous day missed |
| BR-006 | No overpayment beyond 30 days allowed |

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| Payment for more than remaining days | Adjust to maximum remaining |
| Payment after 1-month policy expires | Accept if within grace period |
| 30th payment exactly | Trigger Policy 2 immediately |
| Partial day amount | Round up to full days |

#### Acceptance Criteria

- [ ] AC1: Daily payment count displayed correctly
- [ ] AC2: Multi-day payment option available
- [ ] AC3: Quick-pay buttons for common amounts
- [ ] AC4: Progress bar updates after payment
- [ ] AC5: 30th payment triggers celebration UI + Policy 2 queue

#### Dependencies

- FEAT-PAY-001 (Deposit must be completed)
- M-Pesa Daraja API

---

### FEAT-PAY-003: Wallet Balance View

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-PAY-003 |
| **Priority** | P1 |
| **Description** | Displays user's wallet balance and payment progress |
| **User Story** | As a rider, I want to see my balance and payment progress so that I know my coverage status |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| User ID | UUID | From session |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Total Balance | Number | Sum of all payments (KES) |
| Deposit Status | Boolean | Whether deposit paid |
| Daily Payments | Number | Count of daily payments (0-30) |
| Days Remaining | Number | Days left in cycle |
| Next Payment Due | Date | Suggested next payment date |

#### UI States

```
Wallet Screen:
┌─────────────────────────────────────────┐
│              MY WALLET                  │
├─────────────────────────────────────────┤
│                                         │
│  Total Paid                             │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │      KES 2,179                  │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ✅ Deposit         KES 1,048  │   │
│  │  📊 Daily (13/30)   KES 1,131  │   │
│  │  ⏳ Remaining       KES 1,479  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Progress to full coverage:             │
│  █████████████░░░░░░░░░░░░  59%        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │        MAKE PAYMENT             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Transaction History →                  │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
GET /wallets/me

Response:
{
  "wallet_id": "uuid",
  "balance": 2179,
  "deposit": {
    "paid": true,
    "amount": 1048,
    "date": "2024-12-01"
  },
  "daily_payments": {
    "count": 13,
    "total": 1131,
    "target": 30,
    "remaining_amount": 1479
  },
  "coverage_percentage": 59,
  "next_payment_suggestion": {
    "date": "2024-12-15",
    "amount": 87
  }
}
```

#### Acceptance Criteria

- [ ] AC1: Balance displayed prominently
- [ ] AC2: Breakdown shows deposit vs daily payments
- [ ] AC3: Progress indicator shows percentage to full coverage
- [ ] AC4: Quick action to make payment
- [ ] AC5: Link to transaction history

---

### FEAT-PAY-004: Transaction History

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-PAY-004 |
| **Priority** | P1 |
| **Description** | Shows list of all payment transactions |
| **User Story** | As a rider, I want to see my payment history so that I can track my payments |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| User ID | UUID | From session |
| Date Range | Object | Optional filter |
| Page | Number | Pagination |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Transactions | Array | List of transactions |
| Total Count | Number | For pagination |

#### UI States

```
Transaction History:
┌─────────────────────────────────────────┐
│          TRANSACTION HISTORY            │
├─────────────────────────────────────────┤
│                                         │
│  December 2024                          │
│  ┌─────────────────────────────────┐   │
│  │ 14 Dec  Daily Payment   +87    │   │
│  │         QWE7654321      ✅     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 13 Dec  Daily Payment   +87    │   │
│  │         QWE6543210      ✅     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 12 Dec  Daily Payment   +87    │   │
│  │         QWE5432109      ❌     │   │  ← Failed
│  └─────────────────────────────────┘   │
│  ...                                    │
│  ┌─────────────────────────────────┐   │
│  │ 01 Dec  Initial Deposit +1,048 │   │
│  │         QWE1234567      ✅     │   │
│  └─────────────────────────────────┘   │
│                                         │
│         Load More                       │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
GET /wallets/me/transactions?page=1&limit=20

Response:
{
  "transactions": [
    {
      "id": "uuid",
      "type": "DAILY_PAYMENT",
      "amount": 87,
      "status": "COMPLETED",
      "mpesa_ref": "QWE7654321",
      "created_at": "2024-12-14T08:30:00Z"
    },
    // ... more transactions
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

#### Acceptance Criteria

- [ ] AC1: Transactions listed in reverse chronological order
- [ ] AC2: Each shows date, type, amount, status
- [ ] AC3: Failed transactions clearly marked
- [ ] AC4: M-Pesa reference visible
- [ ] AC5: Pagination loads more on scroll

---

### FEAT-PAY-005: Payment Reminder Settings

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-PAY-005 |
| **Priority** | P2 |
| **Description** | Allows users to configure payment reminder preferences |
| **User Story** | As a rider, I want to control when I receive payment reminders so that they fit my schedule |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| Reminder Enabled | Boolean | - | Yes |
| Reminder Time | Time | Valid 24h time | No |
| Channels | Array | SMS, WhatsApp, Push | No |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Settings Status | Enum | UPDATED, FAILED |

#### UI States

```
Reminder Settings:
┌─────────────────────────────────────────┐
│        PAYMENT REMINDERS                │
├─────────────────────────────────────────┤
│                                         │
│  Daily Reminder           ┌────────┐   │
│                          │   ON   │   │
│                          └────────┘   │
│                                         │
│  Reminder Time                          │
│  ┌─────────────────────────────────┐   │
│  │     07:00 AM                    │ ▼ │
│  └─────────────────────────────────┘   │
│                                         │
│  Send via:                              │
│  ☑ SMS                                  │
│  ☑ WhatsApp                             │
│  ☐ Push Notification                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │       SAVE SETTINGS             │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: User can toggle reminders on/off
- [ ] AC2: User can set preferred time
- [ ] AC3: User can select notification channels
- [ ] AC4: Settings persist across sessions

---

## 6. Policy Management Features

### FEAT-POL-001: Policy Status View

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-POL-001 |
| **Priority** | P1 |
| **Description** | Displays user's current policy status and details |
| **User Story** | As a rider, I want to see my policy status so that I know if I'm covered |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| User ID | UUID | From session |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Policies | Array | List of user's policies |
| Active Policy | Object | Currently active policy details |

#### UI States

```
Policy Status (Active):
┌─────────────────────────────────────────┐
│            MY POLICY                    │
├─────────────────────────────────────────┤
│                                         │
│            ✅ ACTIVE                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │  Policy Number:                 │   │
│  │  DEF/TPO/2024/123456            │   │
│  │                                 │   │
│  │  Coverage Period:               │   │
│  │  01 Dec 2024 - 30 Nov 2025      │   │
│  │                                 │   │
│  │  Vehicle:                       │   │
│  │  KMXX 123A (Honda CB125)        │   │
│  │                                 │   │
│  │  Days Remaining: 351            │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     VIEW POLICY DOCUMENT        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     SHARE VIA WHATSAPP          │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘

Policy Status (Pending):
┌─────────────────────────────────────────┐
│            MY POLICY                    │
├─────────────────────────────────────────┤
│                                         │
│            ⏳ PENDING                   │
│                                         │
│  Your policy is being generated.        │
│  Expected within 6 hours.               │
│                                         │
│  We'll send it via WhatsApp when        │
│  ready.                                 │
│                                         │
└─────────────────────────────────────────┘

Policy Status (Expiring Soon):
┌─────────────────────────────────────────┐
│            MY POLICY                    │
├─────────────────────────────────────────┤
│                                         │
│            ⚠ EXPIRING SOON             │
│                                         │
│  Your policy expires in 15 days.        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │        RENEW NOW                │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
GET /policies/me

Response:
{
  "policies": [
    {
      "id": "uuid",
      "policy_number": "DEF/TPO/2024/123456",
      "type": "11_MONTH",
      "status": "ACTIVE",
      "start_date": "2024-12-01",
      "end_date": "2025-11-30",
      "days_remaining": 351,
      "vehicle": {
        "registration": "KMXX 123A",
        "make": "Honda",
        "model": "CB125"
      },
      "document_url": "/policies/uuid/document"
    }
  ],
  "active_policy": {
    "id": "uuid",
    "status": "ACTIVE"
  }
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Only one active policy displayed prominently |
| BR-002 | Expiring <30 days shows warning |
| BR-003 | Expired policies shown in history |

#### Acceptance Criteria

- [ ] AC1: Active policy status shown prominently
- [ ] AC2: Policy number, dates, vehicle clearly displayed
- [ ] AC3: Days remaining countdown visible
- [ ] AC4: View document option available
- [ ] AC5: Share via WhatsApp option available

---

### FEAT-POL-002: Policy Document Download

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-POL-002 |
| **Priority** | P1 |
| **Description** | Allows users to view and download their policy document |
| **User Story** | As a rider, I want to access my policy document so that I can show it at traffic stops |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Policy ID | UUID | Policy to download |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| PDF Document | File | Policy certificate |

#### UI States

```
Document Viewer:
┌─────────────────────────────────────────┐
│         POLICY DOCUMENT                 │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │  ╔═════════════════════════╗   │   │
│  │  ║   DEFINITE ASSURANCE    ║   │   │
│  │  ║                         ║   │   │
│  │  ║  THIRD PARTY POLICY     ║   │   │
│  │  ║                         ║   │   │
│  │  ║  Policy: DEF/TPO/...    ║   │   │
│  │  ║  Name: JAMES OCHIENG    ║   │   │
│  │  ║  Vehicle: KMXX 123A     ║   │   │
│  │  ║                         ║   │   │
│  │  ║  Valid: 01/12/24-30/11/25║   │   │
│  │  ║                         ║   │   │
│  │  ╚═════════════════════════╝   │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ Download │  │  Share   │            │
│  └──────────┘  └──────────┘            │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
GET /policies/{policy_id}/document

Response: application/pdf (binary)

Or for cached/offline:
GET /policies/{policy_id}/document?format=base64

Response:
{
  "document": "base64-encoded-pdf",
  "filename": "policy_DEF_TPO_2024_123456.pdf"
}
```

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | Document available offline (cached) |
| BR-002 | Can be shared via WhatsApp, email |
| BR-003 | Document cannot be edited |

#### Acceptance Criteria

- [ ] AC1: PDF opens within app
- [ ] AC2: Download to device option
- [ ] AC3: Share via WhatsApp/email options
- [ ] AC4: Document cached for offline access

---

### FEAT-POL-003: Policy Expiry Notification

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-POL-003 |
| **Priority** | P1 |
| **Description** | Sends reminders before policy expiration |
| **User Story** | As a rider, I want to be reminded before my policy expires so that I can renew on time |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Policy ID | UUID | Policy approaching expiry |
| Days Until Expiry | Number | Days remaining |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Notification | Object | SMS/WhatsApp message sent |

#### Notification Schedule

| Days Before | Channel | Message Tone |
|-------------|---------|--------------|
| 30 | SMS | Informational |
| 15 | SMS + WhatsApp | Advisory |
| 7 | SMS + WhatsApp | Urgent |
| 3 | SMS + WhatsApp | Critical |
| 1 | SMS + WhatsApp | Final warning |

#### Message Templates

```
30-Day Reminder (English):
"BodaInsure: Your policy DEF/TPO/2024/123456 expires in 30 days 
(30 Dec 2024). Renew early to stay covered. Reply RENEW to start."

1-Day Reminder (English):
"⚠️ BodaInsure: Your policy expires TOMORROW! Ride uninsured = 
fines + impoundment. Renew NOW: [link] or dial *xxx*xxx#"

30-Day Reminder (Swahili):
"BodaInsure: Bima yako DEF/TPO/2024/123456 itaisha baada ya siku 30 
(30 Dec 2024). Fanya upya mapema. Jibu RENEW kuanza."
```

#### Acceptance Criteria

- [ ] AC1: Notifications sent at 30, 15, 7, 3, 1 day intervals
- [ ] AC2: Messages in user's preferred language
- [ ] AC3: Renewal link/action included
- [ ] AC4: Notifications logged for audit

---

## 7. Organization Management Features

### FEAT-ORG-001: SACCO Member List

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-ORG-001 |
| **Priority** | P1 |
| **Description** | Displays list of SACCO members with status for SACCO admins |
| **User Story** | As a SACCO admin, I want to see all my members so that I can track their insurance status |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| SACCO ID | UUID | Admin's SACCO |
| Filters | Object | Status, search term |
| Pagination | Object | Page, limit |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Members | Array | List of SACCO members |
| Summary | Object | Aggregate statistics |

#### UI States

```
SACCO Member List:
┌─────────────────────────────────────────┐
│         NAKURU RIDERS SACCO             │
├─────────────────────────────────────────┤
│                                         │
│  Summary:                               │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │  145   │ │  112   │ │   33   │      │
│  │ Total  │ │ Active │ │ At Risk│      │
│  └────────┘ └────────┘ └────────┘      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔍 Search members...            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Filter: [All ▼] [Status ▼] [Sort ▼]   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ James Ochieng         ✅ Active │   │
│  │ 0712 345 678    Policy: 351 days│   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Mary Wanjiku          ⚠ At Risk│   │
│  │ 0723 456 789    15/30 payments  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Peter Mutua           ⏳ Pending│   │
│  │ 0734 567 890    KYC in review   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      EXPORT TO EXCEL            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Backend Interactions

```
GET /organizations/{sacco_id}/members?status=all&page=1&limit=20

Response:
{
  "summary": {
    "total": 145,
    "active": 112,
    "at_risk": 33,
    "pending": 15
  },
  "members": [
    {
      "id": "uuid",
      "name": "James Ochieng",
      "phone": "0712345678",
      "status": "ACTIVE",
      "kyc_status": "APPROVED",
      "policy": {
        "status": "ACTIVE",
        "days_remaining": 351
      },
      "payments": {
        "deposit_paid": true,
        "daily_count": 30
      }
    },
    // ... more members
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145
  }
}
```

#### Acceptance Criteria

- [ ] AC1: Summary counts displayed prominently
- [ ] AC2: Search by name or phone works
- [ ] AC3: Filter by status functional
- [ ] AC4: Member details expandable
- [ ] AC5: Export to Excel available

---

### FEAT-ORG-002: Bulk Member Import

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-ORG-002 |
| **Priority** | P2 |
| **Description** | Allows SACCO admins to pre-register members via CSV upload |
| **User Story** | As a SACCO admin, I want to upload a list of members so that onboarding is faster |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| CSV File | File | Valid format, <5MB | Yes |
| SACCO ID | UUID | Admin's SACCO | Yes |

#### Required CSV Columns

| Column | Type | Required |
|--------|------|----------|
| full_name | String | Yes |
| phone | String | Yes |
| national_id | String | No |
| motorcycle_reg | String | No |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Import Result | Object | Success/failure counts |
| Errors | Array | Row-level errors |

#### UI States

```
Bulk Import:
┌─────────────────────────────────────────┐
│         BULK MEMBER IMPORT              │
├─────────────────────────────────────────┤
│                                         │
│  1. Download template                   │
│     ┌─────────────────────────────┐    │
│     │   📥 Download CSV Template  │    │
│     └─────────────────────────────┘    │
│                                         │
│  2. Fill in member details              │
│                                         │
│  3. Upload completed file               │
│     ┌─────────────────────────────┐    │
│     │                             │    │
│     │   📁 Drop file here or      │    │
│     │      click to upload        │    │
│     │                             │    │
│     └─────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

Import Results:
┌─────────────────────────────────────────┐
│         IMPORT COMPLETE                 │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Successfully imported: 45           │
│  ❌ Failed: 5                           │
│                                         │
│  Errors:                                │
│  • Row 12: Invalid phone format         │
│  • Row 23: Duplicate phone number       │
│  • Row 34: Missing required field       │
│  ...                                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │    DOWNLOAD ERROR REPORT        │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Template download available
- [ ] AC2: Drag-drop upload supported
- [ ] AC3: Validation errors shown per row
- [ ] AC4: Successful imports create pending users
- [ ] AC5: SMS sent to imported users with app link

---

### FEAT-ORG-003: Member Compliance Dashboard

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-ORG-003 |
| **Priority** | P1 |
| **Description** | Dashboard showing SACCO compliance metrics |
| **User Story** | As a SACCO admin, I want to see compliance rates so that I can report to leadership |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| SACCO ID | UUID | Admin's SACCO |
| Date Range | Object | Reporting period |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Compliance Metrics | Object | Key statistics |
| Trends | Array | Historical data |

#### UI States

```
Compliance Dashboard:
┌─────────────────────────────────────────┐
│       SACCO COMPLIANCE DASHBOARD        │
├─────────────────────────────────────────┤
│                                         │
│  Overall Compliance: 77%                │
│  ████████████████████░░░░░░             │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │   77%   │ │   85%   │ │   92%   │   │
│  │ Active  │ │Deposits │ │   KYC   │   │
│  │Policies │ │  Paid   │ │Complete │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  Payment Compliance Trend:              │
│  ┌─────────────────────────────────┐   │
│  │     ____                        │   │
│  │    /    \      /\               │   │
│  │   /      \____/  \              │   │
│  │  /                 \            │   │
│  │ Nov    Dec    Jan    Feb        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  At-Risk Members (33):                  │
│  [View List →]                          │
│                                         │
└─────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Overall compliance percentage displayed
- [ ] AC2: Breakdown by KYC, deposit, policy status
- [ ] AC3: Trend chart over time
- [ ] AC4: Link to at-risk member list

---

## 8. Notification Features

### FEAT-NOT-001: Payment Reminder

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-NOT-001 |
| **Priority** | P1 |
| **Description** | Sends daily payment reminders to users in payment cycle |
| **User Story** | As a rider, I want to receive reminders so that I don't forget my daily payment |

#### Trigger

Scheduled job runs daily at 07:00 EAT

#### Target Users

- Has active 1-month policy
- Has not completed 30 daily payments
- Has not paid today
- Has reminder preference enabled

#### Message Templates

```
Standard Reminder (English):
"BodaInsure: Time for your daily payment! 
Pay KES 87 to stay on track. 
Progress: 15/30 days ✓
Dial *xxx*xxx# or open app to pay."

Standard Reminder (Swahili):
"BodaInsure: Wakati wa malipo ya kila siku!
Lipa KES 87 kuendelea vizuri.
Maendeleo: siku 15/30 ✓
Piga *xxx*xxx# au fungua app kulipa."
```

#### Acceptance Criteria

- [ ] AC1: Reminders sent at configured time
- [ ] AC2: Include payment progress
- [ ] AC3: Include action (USSD, app)
- [ ] AC4: Skip if already paid today
- [ ] AC5: Respect opt-out preference

---

### FEAT-NOT-002: Policy Delivery

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-NOT-002 |
| **Priority** | P1 |
| **Description** | Delivers policy document via WhatsApp and email |
| **User Story** | As a rider, I want to receive my policy document so that I have proof of insurance |

#### Trigger

Policy batch processing completes and policy is issued

#### Delivery Channels

| Channel | Priority | Content |
|---------|----------|---------|
| WhatsApp | Primary | PDF attachment + summary |
| SMS | Backup | Notification + link |
| Email | Optional | PDF attachment (if email provided) |

#### Message Template

```
WhatsApp Message:
"🎉 Congratulations! Your BodaInsure policy is ready!

Policy Number: DEF/TPO/2024/123456
Valid: 01 Dec 2024 - 30 Nov 2025
Vehicle: KMXX 123A

📄 Your policy document is attached below.

Keep this message handy for traffic stops.
Questions? Call 0800-XXX-XXX"

[Attachment: policy_document.pdf]
```

#### Acceptance Criteria

- [ ] AC1: WhatsApp message with PDF sent
- [ ] AC2: SMS backup if WhatsApp fails
- [ ] AC3: Email sent if address available
- [ ] AC4: Delivery within 1 hour of policy issuance

---

## 9. Reporting & Analytics Features

### FEAT-RPT-001: Enrollment Dashboard

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-RPT-001 |
| **Priority** | P1 |
| **Description** | Real-time dashboard showing enrollment metrics |
| **User Story** | As a KBA admin, I want to see enrollment progress so that I can track against targets |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Date Range | Object | Period to analyze |
| Region | String | Optional filter |
| SACCO | UUID | Optional filter |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Metrics | Object | Key enrollment numbers |
| Trends | Array | Time series data |
| Regional Breakdown | Array | By county/SACCO |

#### Dashboard Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENROLLMENT DASHBOARD                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Target: 700,000 │ Current: 125,430 │ Progress: 17.9%           │
│  █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │   125,430     │ │    98,250     │ │    89,100     │          │
│  │  Registered   │ │  KYC Complete │ │ Deposit Paid  │          │
│  │    +2,340     │ │    +1,890     │ │    +1,650     │          │
│  │   this week   │ │   this week   │ │   this week   │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│                                                                  │
│  Daily Registrations (Last 30 Days)                             │
│  ┌─────────────────────────────────────────────────────┐        │
│  │          ∧                                          │        │
│  │   ∧     /\    /\                 ∧                  │        │
│  │  / \   /  \  /  \     /\        / \                 │        │
│  │ /   \_/    \/    \___/  \______/   \____           │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  Top Performing Regions:                                         │
│  1. Nairobi     - 35,200 (28%)                                  │
│  2. Nakuru      - 18,400 (15%)                                  │
│  3. Kisumu      - 12,300 (10%)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Total registrations vs target displayed
- [ ] AC2: KYC and deposit conversion rates shown
- [ ] AC3: Daily/weekly trend chart
- [ ] AC4: Regional breakdown available
- [ ] AC5: Data refreshes automatically (5-min interval)

---

### FEAT-RPT-002: Payment Dashboard

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-RPT-002 |
| **Priority** | P1 |
| **Description** | Dashboard showing payment collection metrics |
| **User Story** | As a finance admin, I want to see payment metrics so that I can monitor revenue |

#### Dashboard Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT DASHBOARD                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Today's Collections                                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │ KES 2.3M      │ │    3,450      │ │     98%       │          │
│  │  Revenue      │ │ Transactions  │ │ Success Rate  │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│                                                                  │
│  Revenue Breakdown:                                              │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  Deposits:        KES 1.2M  (52%)  ████████████    │        │
│  │  Daily Payments:  KES 1.1M  (48%)  ███████████     │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  Payment Compliance (Active Users):                             │
│  ████████████████████████░░░░░░░░░░  72%                        │
│                                                                  │
│  At-Risk Users (missed 3+ days): 4,230                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Daily revenue total displayed
- [ ] AC2: Transaction count and success rate
- [ ] AC3: Deposit vs daily payment breakdown
- [ ] AC4: Payment compliance rate
- [ ] AC5: At-risk user count with drill-down

---

### FEAT-RPT-003: Report Export

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-RPT-003 |
| **Priority** | P2 |
| **Description** | Export dashboard data to Excel/CSV |
| **User Story** | As an admin, I want to export data so that I can analyze it externally |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Report Type | Enum | enrollment, payments, policies |
| Date Range | Object | Start and end dates |
| Format | Enum | CSV, Excel |
| Columns | Array | Fields to include |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| Download File | File | CSV or XLSX |

#### Acceptance Criteria

- [ ] AC1: Export available from all dashboards
- [ ] AC2: Date range selectable
- [ ] AC3: Column selection available
- [ ] AC4: Progress indicator for large exports
- [ ] AC5: Export logged for audit

---

## 10. Administrative Features

### FEAT-ADM-001: User Lookup

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-ADM-001 |
| **Priority** | P1 |
| **Description** | Search and view user details for support purposes |
| **User Story** | As a support admin, I want to find users so that I can help resolve their issues |

#### Inputs

| Input | Type | Description |
|-------|------|-------------|
| Search Term | String | Phone, name, ID, policy number |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| User Profile | Object | Complete user details |
| History | Array | Activity timeline |

#### UI States

```
User Lookup:
┌─────────────────────────────────────────────────────────────────┐
│                      USER SUPPORT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search by phone, name, ID, or policy number...       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  User: James Ochieng                      Status: ✅ Active     │
│  Phone: 0712 345 678                      Since: 01 Dec 2024   │
│  ID: 12345678                                                   │
│                                                                  │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │   Profile   │     KYC     │  Payments   │   Policy    │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                                  │
│  [Profile Tab Content]                                          │
│  Name: James Ochieng                                            │
│  Phone: +254712345678                                           │
│  Email: james@email.com                                         │
│  SACCO: Nakuru Riders SACCO                                     │
│  Registered: 01 Dec 2024, 10:30 AM                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Actions:                                                │   │
│  │  [Resend Policy] [Reset Auth] [Add Note] [View Logs]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Search by phone, name, ID, policy number
- [ ] AC2: View all user details in tabs
- [ ] AC3: View payment and policy history
- [ ] AC4: Action buttons for common support tasks
- [ ] AC5: Activity log visible

---

### FEAT-ADM-002: Manual Adjustment

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-ADM-002 |
| **Priority** | P2 |
| **Description** | Apply manual adjustments to user accounts |
| **User Story** | As a senior admin, I want to make adjustments so that I can resolve exceptional cases |

#### Inputs

| Input | Type | Validation | Required |
|-------|------|------------|----------|
| User ID | UUID | Must exist | Yes |
| Adjustment Type | Enum | CREDIT, DEBIT, STATUS_CHANGE | Yes |
| Amount | Number | If financial | Conditional |
| Reason | String | Min 20 characters | Yes |
| Approval | UUID | Supervisor approval | Yes |

#### Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | All adjustments require supervisor approval |
| BR-002 | Adjustments logged to immutable audit trail |
| BR-003 | Maximum adjustment amount: 10,000 KES |
| BR-004 | Reason must be documented |

#### Acceptance Criteria

- [ ] AC1: Adjustment form with required fields
- [ ] AC2: Supervisor approval workflow
- [ ] AC3: Confirmation dialog before submission
- [ ] AC4: Full audit trail maintained

---

## 11. USSD Channel Features

### FEAT-USSD-001: USSD Balance Check

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-USSD-001 |
| **Priority** | P1 |
| **Description** | Check wallet balance via USSD |
| **User Story** | As a rider with a feature phone, I want to check my balance via USSD so that I know my payment status |

#### USSD Flow

```
*xxx*xxx#
    │
    ▼
┌─────────────────────────────────────┐
│ Welcome to BodaInsure               │
│                                     │
│ 1. Check Balance                    │
│ 2. Make Payment                     │
│ 3. Policy Status                    │
│ 4. Help                             │
└─────────────────────────────────────┘
    │
    │ User selects 1
    ▼
┌─────────────────────────────────────┐
│ Your Balance:                       │
│                                     │
│ Total Paid: KES 2,179               │
│ Daily Payments: 13/30               │
│ Remaining: KES 1,479                │
│                                     │
│ 0. Back                             │
└─────────────────────────────────────┘
```

#### Backend Interactions

```
USSD Request:
{
  "sessionId": "ATxxxx",
  "phoneNumber": "+254712345678",
  "text": "1"
}

USSD Response:
{
  "response": "END Your Balance:\n\nTotal Paid: KES 2,179\nDaily Payments: 13/30\nRemaining: KES 1,479"
}
```

#### Constraints

- Maximum 182 characters per screen
- Session timeout: 180 seconds
- Response time: <2 seconds

#### Acceptance Criteria

- [ ] AC1: Balance displayed within 2 seconds
- [ ] AC2: Shows total paid, daily count, remaining
- [ ] AC3: Works on all basic phones
- [ ] AC4: Swahili option available

---

### FEAT-USSD-002: USSD Payment

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-USSD-002 |
| **Priority** | P1 |
| **Description** | Initiate payment via USSD |
| **User Story** | As a rider with a feature phone, I want to pay via USSD so that I can maintain my coverage |

#### USSD Flow

```
*xxx*xxx#
    │
    ▼
[Main Menu - select 2]
    │
    ▼
┌─────────────────────────────────────┐
│ Make Payment                        │
│                                     │
│ Daily payment: KES 87               │
│ Remaining days: 17                  │
│                                     │
│ Pay for how many days?              │
│ 1. 1 day (KES 87)                   │
│ 2. 7 days (KES 609)                 │
│ 3. All remaining (KES 1,479)        │
│ 0. Back                             │
└─────────────────────────────────────┘
    │
    │ User selects 1
    ▼
┌─────────────────────────────────────┐
│ Confirm Payment                     │
│                                     │
│ Amount: KES 87                      │
│ Phone: 0712345678                   │
│                                     │
│ 1. Confirm                          │
│ 0. Cancel                           │
└─────────────────────────────────────┘
    │
    │ User selects 1
    ▼
┌─────────────────────────────────────┐
│ Payment initiated!                  │
│                                     │
│ Check your phone for M-Pesa         │
│ prompt and enter PIN.               │
└─────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Payment options displayed clearly
- [ ] AC2: Confirmation step before payment
- [ ] AC3: STK push triggered after confirmation
- [ ] AC4: Clear instructions for M-Pesa completion

---

### FEAT-USSD-003: USSD Policy Status

| Attribute | Specification |
|-----------|---------------|
| **Feature ID** | FEAT-USSD-003 |
| **Priority** | P1 |
| **Description** | Check policy status via USSD |
| **User Story** | As a rider, I want to check my policy status via USSD so that I know if I'm covered |

#### USSD Flow

```
*xxx*xxx#
    │
    ▼
[Main Menu - select 3]
    │
    ▼
┌─────────────────────────────────────┐
│ Policy Status: ACTIVE ✓             │
│                                     │
│ Policy: DEF/TPO/2024/123456         │
│ Expires: 30 Nov 2025                │
│ Days left: 351                      │
│                                     │
│ 0. Back                             │
└─────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] AC1: Policy status (ACTIVE/EXPIRED/PENDING) shown
- [ ] AC2: Policy number displayed
- [ ] AC3: Expiry date and days remaining
- [ ] AC4: Response within 2 seconds

---

## 12. Gaps & Missing Specifications

### 12.1 Features Requiring Additional Definition

| Feature Area | Gap | Required Information |
|--------------|-----|---------------------|
| **Claims** | No claims flow defined | Claims process, required documents, timeline |
| **Renewals** | Renewal workflow unclear | Pricing, timing, simplified flow |
| **Refunds** | Refund rules incomplete | Eligibility criteria, processing time |
| **Grace Period** | Exact rules missing | Duration, penalty, reinstatement |
| **Commission** | Commission tracking undefined | Calculation, disbursement, reporting |
| **Support Tickets** | No ticketing system specified | Tool selection, SLAs, escalation |

### 12.2 Integration Specifications Pending

| Integration | Missing Information |
|-------------|---------------------|
| **USSD Shortcode** | Actual shortcode allocation |
| **M-Pesa** | Paybill/Till number, credentials |
| **Underwriter API** | Phase 2 API specification |
| **WhatsApp Business** | Template approval status |

### 12.3 Assumptions Made

| # | Assumption | Needs Validation |
|---|------------|------------------|
| 1 | Payment amounts (1,048 / 87) are fixed | Business confirmation |
| 2 | Three daily batches are sufficient | Underwriter capacity |
| 3 | Feature phone users ~30% of base | User research |
| 4 | English and Swahili cover all users | Regional assessment |
| 5 | Offline capability needed | Connectivity analysis |

---

## 13. Related Documents

| Document | Description | Link |
|----------|-------------|------|
| Product Description | Business context | [product_description.md](product_description.md) |
| Module Architecture | Technical design | [module_architecture.md](module_architecture.md) |
| Requirements Specification | Requirements | [requirements_specification.md](requirements_specification.md) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Product & Engineering | Initial draft |

---

*End of Document*
