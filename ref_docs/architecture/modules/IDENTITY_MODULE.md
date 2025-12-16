# Identity Module Architecture

**Module Location:** `src/server/src/modules/identity/`
**Last Updated:** December 2024

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Internal Components](#2-internal-components)
3. [Data Models](#3-data-models)
4. [Service Methods](#4-service-methods)
5. [API Endpoints](#5-api-endpoints)
6. [Authentication Flows](#6-authentication-flows)
7. [Security Features](#7-security-features)
8. [Dependencies](#8-dependencies)
9. [Error Handling](#9-error-handling)
10. [Configuration](#10-configuration)

---

## 1. Module Overview

### 1.1 Purpose

The Identity module handles all authentication, authorization, session management, and user lifecycle operations for the BodaInsure platform. It implements a dual authentication strategy:

- **OTP-based authentication** for bodaboda riders (phone-only, no passwords)
- **Username/password authentication** for administrative users

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| User registration and activation | Payment processing |
| OTP generation and verification | KYC document management |
| JWT token management | Policy management |
| Session lifecycle | Organization membership |
| Password authentication (admin) | Notification delivery |
| Account lockout and security | |
| Data export (GDPR compliance) | |
| Superuser seeding | |

### 1.3 Key Features

- Phone-based registration with terms acceptance
- OTP authentication with rate limiting and expiry
- JWT tokens with RS256/HS256 signing
- Device-specific session expiry (mobile: 30 days, web: 30 min)
- Account lockout after failed attempts
- Data Protection Act compliance (export, deletion)

---

## 2. Internal Components

### 2.1 File Structure

```
identity/
├── controllers/
│   ├── auth.controller.ts          # API endpoints
│   └── index.ts
├── decorators/
│   ├── current-user.decorator.ts   # @CurrentUser() parameter decorator
│   └── index.ts
├── dto/
│   ├── register.dto.ts             # Registration request/response
│   ├── login.dto.ts                # Login request/response
│   ├── verify-otp.dto.ts           # OTP verification
│   ├── resend-otp.dto.ts           # OTP resend
│   ├── refresh-token.dto.ts        # Token refresh
│   ├── admin-login.dto.ts          # Admin authentication
│   └── index.ts
├── entities/
│   ├── user.entity.ts              # User model with enums
│   ├── otp.entity.ts               # OTP model
│   ├── session.entity.ts           # Session model
│   └── index.ts
├── guards/
│   ├── jwt-auth.guard.ts           # JWT validation guard
│   └── index.ts
├── services/
│   ├── auth.service.ts             # Authentication orchestration
│   ├── user.service.ts             # User CRUD operations
│   ├── otp.service.ts              # OTP generation/verification
│   ├── session.service.ts          # Session management
│   ├── data-export.service.ts      # GDPR data export
│   ├── seeder.service.ts           # Superuser initialization
│   └── index.ts
├── strategies/
│   ├── jwt.strategy.ts             # Passport JWT strategy
│   └── index.ts
└── identity.module.ts              # Module definition
```

### 2.2 Component Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        IDENTITY MODULE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      AuthController                                 │ │
│  │  Routes: /auth/register, /auth/login, /auth/otp/verify, etc.       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       AuthService                                   │ │
│  │  Orchestrates authentication flows, token generation               │ │
│  │  Methods: register, verifyOtp, login, adminLogin, refreshToken     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│           │                    │                    │                    │
│           ▼                    ▼                    ▼                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   UserService   │  │   OtpService    │  │ SessionService  │         │
│  │                 │  │                 │  │                 │         │
│  │ - createUser    │  │ - generateOtp   │  │ - createSession │         │
│  │ - findByPhone   │  │ - verifyOtp     │  │ - validateToken │         │
│  │ - activateUser  │  │ - canResendOtp  │  │ - revokeSession │         │
│  │ - updateProfile │  │ - cleanupExpired│  │ - rotateToken   │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  Support Services:                                                       │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │DataExportService│  │  SeederService  │                               │
│  │ - exportUserData│  │ - seedSuperuser │                               │
│  │ - consentStatus │  │ - resetPassword │                               │
│  └─────────────────┘  └─────────────────┘                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 User Entity

```typescript
// Enums
enum UserStatus { PENDING, ACTIVE, SUSPENDED, LOCKED, DEACTIVATED }
enum UserRole { RIDER, SACCO_ADMIN, KBA_ADMIN, INSURANCE_ADMIN, PLATFORM_ADMIN }
enum KycStatus { PENDING, IN_REVIEW, APPROVED, REJECTED, INCOMPLETE }
enum Language { ENGLISH = 'en', SWAHILI = 'sw' }
enum Gender { MALE, FEMALE, OTHER }

// Entity Fields
interface User {
  id: string;                    // UUID primary key
  phone: string;                 // E.164 format (+254...), unique

  // PII Fields (encrypted)
  nationalId?: string;           // HIGH PII - encrypted
  fullName?: string;             // MEDIUM PII - encrypted
  email?: string;                // MEDIUM PII - encrypted
  kraPin?: string;               // HIGH PII - encrypted
  dateOfBirth?: Date;            // MEDIUM PII
  gender?: Gender;               // LOW PII

  // Status & Role
  status: UserStatus;            // Default: PENDING
  role: UserRole;                // Default: RIDER
  kycStatus: KycStatus;          // Default: PENDING
  language: Language;            // Default: ENGLISH

  // Consent (DPA Compliance)
  termsAcceptedAt?: Date;
  consentGivenAt?: Date;

  // Authentication
  lastLoginAt?: Date;
  failedLoginAttempts: number;   // Default: 0
  lockedUntil?: Date;

  // Admin Authentication
  username?: string;             // Unique, for admins only
  passwordHash?: string;         // bcrypt hashed
  isSystemAccount: boolean;      // Default: false

  // Organization
  organizationId?: string;
  reminderOptOut: boolean;       // Default: false

  // Audit
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;              // Soft delete
}
```

### 3.2 OTP Entity

```typescript
enum OtpPurpose { REGISTRATION, LOGIN, PASSWORD_RESET, PHONE_CHANGE }
enum OtpStatus { PENDING, VERIFIED, EXPIRED, EXHAUSTED }

interface Otp {
  id: string;                    // UUID
  phone: string;                 // E.164 format
  codeHash: string;              // SHA-256 hash of 6-digit code
  purpose: OtpPurpose;
  status: OtpStatus;             // Default: PENDING
  attempts: number;              // Default: 0, max: 5
  expiresAt: Date;               // 5 minutes from creation
  verifiedAt?: Date;
  userId?: string;               // FK to User
  ipAddress?: string;            // IPv6 compatible (45 chars)
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Methods
otp.isValid(): boolean           // status=PENDING, not expired, attempts<5
otp.getRemainingAttempts(): number
```

### 3.3 Session Entity

```typescript
enum DeviceType { MOBILE_APP, WEB, USSD }
enum SessionStatus { ACTIVE, EXPIRED, REVOKED }

interface Session {
  id: string;                    // UUID
  userId: string;                // FK to User
  refreshTokenHash: string;      // SHA-256 hash, unique
  deviceType: DeviceType;
  status: SessionStatus;         // Default: ACTIVE
  expiresAt: Date;               // Device-specific expiry
  lastActivityAt: Date;          // For idle timeout
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;             // Mobile device identifier
  deviceName?: string;
  revokedReason?: string;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Session Expiry by Device Type
MOBILE_APP: 30 days
WEB: 30 minutes (idle timeout)
USSD: 180 seconds

// Methods
session.isValid(): boolean       // ACTIVE and not expired
session.isIdleExpired(minutes): boolean  // WEB only
```

### 3.4 Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ENTITY RELATIONSHIPS                          │
└─────────────────────────────────────────────────────────────────────┘

User (1) ──────────────────────── (Many) OTP
  │                                  │
  │  phone (lookup)                  │  userId (FK, optional)
  │                                  │  phone (E.164)
  │                                  │  purpose (REGISTRATION/LOGIN/...)
  │
  └──────────────────────────── (Many) Session
                                     │
                                     │  userId (FK)
                                     │  deviceType (MOBILE/WEB/USSD)
                                     │  refreshTokenHash (unique)
```

---

## 4. Service Methods

### 4.1 AuthService

```typescript
class AuthService {
  // Registration Flow
  register(dto: RegisterDto, ipAddress?, userAgent?): Promise<RegisterResponseDto>
  // - Validates terms acceptance
  // - Normalizes phone to E.164
  // - Creates user if new, resends OTP if PENDING
  // - Generates OTP, sends via SMS

  // OTP Verification
  verifyOtp(dto: VerifyOtpDto, deviceType?, ipAddress?, userAgent?): Promise<VerifyOtpResponseDto>
  // - Tries REGISTRATION then LOGIN purpose
  // - Activates user if REGISTRATION and PENDING
  // - Creates session, generates JWT

  // Rider Login
  login(dto: LoginDto, ipAddress?, userAgent?): Promise<LoginResponseDto>
  // - Finds user by phone
  // - Checks status and lockout
  // - Generates OTP, sends via SMS

  // Admin Login
  adminLogin(dto: AdminLoginDto, deviceType?, ipAddress?, userAgent?): Promise<AdminLoginResponseDto>
  // - Finds user by username
  // - Verifies admin role
  // - Validates password with bcrypt
  // - Records failed attempts, locks after 5

  // Token Management
  refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto>
  // - Validates refresh token
  // - Checks user status
  // - Generates new access token

  // Session Management
  logout(refreshToken: string): Promise<void>
  logoutAll(userId: string): Promise<number>

  // JWT Validation (called by strategy)
  validateJwtPayload(payload: JwtPayload): Promise<User | null>
}
```

### 4.2 UserService

```typescript
class UserService {
  // CRUD Operations
  createUser(data: CreateUserData): Promise<User>
  findByPhone(phone: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  existsByPhone(phone: string): Promise<boolean>

  // Status Management
  activateUser(userId: string): Promise<User>
  updateLastLogin(userId: string): Promise<void>
  recordFailedLogin(userId: string): Promise<{ isLocked, lockedUntil? }>
  isAccountLocked(userId: string): Promise<{ isLocked, lockedUntil? }>

  // Profile Updates
  updateKycStatus(userId: string, kycStatus: KycStatus): Promise<User>
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<User>
  softDeleteUser(userId: string): Promise<void>
}
```

### 4.3 OtpService

```typescript
class OtpService {
  // OTP Generation
  generateOtp(phone, purpose, userId?, ipAddress?, userAgent?): Promise<GenerateOtpResult>
  // - Checks rate limit (3/hour)
  // - Invalidates existing pending OTPs
  // - Generates 6-digit code cryptographically
  // - Returns plaintext OTP for SMS sending

  // OTP Verification
  verifyOtp(phone, otpCode, purpose): Promise<VerifyOtpResult>
  // - Finds latest pending OTP
  // - Checks expiry and attempts
  // - Compares SHA-256 hashes

  // Rate Limiting
  canResendOtp(phone, purpose): Promise<{ allowed, retryAfter? }>
  // - Enforces 60-second cooldown

  // Cleanup
  cleanupExpiredOtps(): Promise<number>
  // - Deletes OTPs older than 24 hours
}
```

### 4.4 SessionService

```typescript
class SessionService {
  // Session Lifecycle
  createSession(data: CreateSessionData): Promise<SessionTokens>
  // - Generates 64-byte refresh token
  // - Hashes token with SHA-256
  // - Calculates expiry by device type

  validateRefreshToken(refreshToken: string): Promise<Session | null>
  // - Hashes and finds session
  // - Checks expiry, marks EXPIRED if needed
  // - Updates lastActivityAt

  // Session Management
  revokeSession(sessionId, reason?): Promise<void>
  revokeAllUserSessions(userId, reason?): Promise<number>
  getActiveSessions(userId): Promise<Session[]>
  rotateRefreshToken(sessionId): Promise<SessionTokens | null>

  // Cleanup
  cleanupExpiredSessions(): Promise<number>
  // - Deletes sessions expired >90 days
}
```

### 4.5 DataExportService (GDPR Compliance)

```typescript
class DataExportService {
  // Data Access Rights
  exportUserData(userId: string): Promise<UserDataExport>
  // - Returns structured export with:
  //   - Personal data (masked where appropriate)
  //   - Account data (status, consent dates)
  //   - Data processing info (purposes, retention)
  //   - User rights info (access, correction, deletion)

  getConsentStatus(userId: string): Promise<ConsentStatus>

  // Account Deletion
  requestAccountDeletion(userId, reason?): Promise<DeletionRequest>
  // - Sets 30-day grace period
  // - Returns scheduled deletion date

  cancelAccountDeletion(userId): Promise<CancelResult>
}
```

---

## 5. API Endpoints

### 5.1 Public Endpoints (No Auth Required)

| Method | Endpoint | Purpose | Rate Limit |
|--------|----------|---------|------------|
| POST | `/auth/register` | User registration | 10/min |
| POST | `/auth/login` | Rider login (OTP) | 10/min |
| POST | `/auth/admin/login` | Admin login | 10/min |
| POST | `/auth/otp/verify` | OTP verification | 10/min |
| POST | `/auth/otp/resend` | Resend OTP | 3/hour |
| POST | `/auth/token/refresh` | Refresh access token | 100/min |

### 5.2 Protected Endpoints (JWT Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/logout` | Logout current session |
| POST | `/auth/logout/all` | Logout all sessions |

### 5.3 Request/Response DTOs

**Registration:**
```typescript
// Request
{ phone: string, termsAccepted: boolean, language?: 'en' | 'sw' }

// Response
{ status: 'SUCCESS' | 'DUPLICATE' | 'RATE_LIMITED' | 'ERROR',
  userId?: string, otpSent: boolean, message: string }
```

**OTP Verification:**
```typescript
// Request
{ phone: string, otp: string }  // otp: 6 digits

// Response (Success)
{ status: 'SUCCESS', accessToken: string, refreshToken: string,
  expiresIn: number, user: { id, phone, status, kycStatus }, message: string }

// Response (Failure)
{ status: 'INVALID_OTP' | 'EXPIRED_OTP' | 'MAX_ATTEMPTS',
  attemptsRemaining?: number, message: string }
```

**Admin Login:**
```typescript
// Request
{ username: string, password: string }

// Response
{ status: 'SUCCESS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED',
  accessToken?: string, refreshToken?: string, expiresIn?: number,
  user?: { id, username, role, status }, lockedUntil?: Date, message: string }
```

---

## 6. Authentication Flows

### 6.1 Rider Registration Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       RIDER REGISTRATION FLOW                            │
└──────────────────────────────────────────────────────────────────────────┘

 User              AuthController     AuthService      OtpService    SmsService
  │                     │                 │                │              │
  │ POST /register      │                 │                │              │
  │ {phone, terms}      │                 │                │              │
  │────────────────────►│                 │                │              │
  │                     │ register()      │                │              │
  │                     │────────────────►│                │              │
  │                     │                 │                │              │
  │                     │                 │ Validate terms │              │
  │                     │                 │ Normalize phone│              │
  │                     │                 │                │              │
  │                     │                 │ Check existing │              │
  │                     │                 │ user           │              │
  │                     │                 │                │              │
  │                     │                 │    ┌───────────┴───────────┐  │
  │                     │                 │    │ If PENDING: resend OTP│  │
  │                     │                 │    │ If ACTIVE: return DUP │  │
  │                     │                 │    │ If none: create user  │  │
  │                     │                 │    └───────────┬───────────┘  │
  │                     │                 │                │              │
  │                     │                 │ generateOtp()  │              │
  │                     │                 │───────────────►│              │
  │                     │                 │                │              │
  │                     │                 │                │ Check rate   │
  │                     │                 │                │ limit (3/hr) │
  │                     │                 │                │              │
  │                     │                 │                │ Invalidate   │
  │                     │                 │                │ existing OTPs│
  │                     │                 │                │              │
  │                     │                 │                │ Generate 6-  │
  │                     │                 │                │ digit code   │
  │                     │                 │                │              │
  │                     │                 │◄───────────────│              │
  │                     │                 │ {otp, otpId}   │              │
  │                     │                 │                │              │
  │                     │                 │ sendOtpSms()   │              │
  │                     │                 │───────────────────────────────►│
  │                     │                 │                │              │
  │                     │◄────────────────│                │              │
  │◄────────────────────│ {SUCCESS, userId, otpSent}      │              │
  │                     │                 │                │              │

User receives SMS: "Your BodaInsure OTP is: 123456. Valid for 5 minutes."
```

### 6.2 OTP Verification Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       OTP VERIFICATION FLOW                              │
└──────────────────────────────────────────────────────────────────────────┘

 User              AuthController     AuthService      OtpService   SessionService
  │                     │                 │                │              │
  │ POST /otp/verify    │                 │                │              │
  │ {phone, otp}        │                 │                │              │
  │────────────────────►│                 │                │              │
  │                     │ verifyOtp()     │                │              │
  │                     │────────────────►│                │              │
  │                     │                 │                │              │
  │                     │                 │ verifyOtp()    │              │
  │                     │                 │───────────────►│              │
  │                     │                 │                │              │
  │                     │                 │                │ Find latest  │
  │                     │                 │                │ PENDING OTP  │
  │                     │                 │                │              │
  │                     │                 │                │ Check expiry │
  │                     │                 │                │ (5 min)      │
  │                     │                 │                │              │
  │                     │                 │                │ Check attempts│
  │                     │                 │                │ (max 5)      │
  │                     │                 │                │              │
  │                     │                 │                │ Compare hash │
  │                     │                 │                │ SHA256(otp)  │
  │                     │                 │                │              │
  │                     │                 │◄───────────────│              │
  │                     │                 │ {success, userId}             │
  │                     │                 │                │              │
  │                     │                 │    ┌───────────┴───────────┐  │
  │                     │                 │    │ If REGISTRATION:      │  │
  │                     │                 │    │ - Activate user       │  │
  │                     │                 │    │   (PENDING → ACTIVE)  │  │
  │                     │                 │    └───────────┬───────────┘  │
  │                     │                 │                │              │
  │                     │                 │ createSession()│              │
  │                     │                 │───────────────────────────────►│
  │                     │                 │                │              │
  │                     │                 │                │ Generate     │
  │                     │                 │                │ refresh token│
  │                     │                 │                │ (64 bytes)   │
  │                     │                 │                │              │
  │                     │                 │                │ Hash & store │
  │                     │                 │◄───────────────────────────────│
  │                     │                 │ {refreshToken, sessionId}     │
  │                     │                 │                │              │
  │                     │                 │ Generate JWT   │              │
  │                     │                 │ {sub, phone,   │              │
  │                     │                 │  role, orgId}  │              │
  │                     │                 │                │              │
  │                     │◄────────────────│                │              │
  │◄────────────────────│ {SUCCESS, accessToken, refreshToken, user}     │
  │                     │                 │                │              │
```

### 6.3 Admin Login Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ADMIN LOGIN FLOW                                 │
└──────────────────────────────────────────────────────────────────────────┘

 Admin             AuthController     AuthService       UserService
  │                     │                 │                  │
  │ POST /admin/login   │                 │                  │
  │ {username, password}│                 │                  │
  │────────────────────►│                 │                  │
  │                     │ adminLogin()    │                  │
  │                     │────────────────►│                  │
  │                     │                 │                  │
  │                     │                 │ findByUsername() │
  │                     │                 │─────────────────►│
  │                     │                 │◄─────────────────│
  │                     │                 │ {user}           │
  │                     │                 │                  │
  │                     │                 │ Verify admin role│
  │                     │                 │ (PLATFORM_ADMIN, │
  │                     │                 │  INSURANCE_ADMIN,│
  │                     │                 │  KBA_ADMIN,      │
  │                     │                 │  SACCO_ADMIN)    │
  │                     │                 │                  │
  │                     │                 │ Check status     │
  │                     │                 │ (not SUSPENDED)  │
  │                     │                 │                  │
  │                     │                 │ isAccountLocked()│
  │                     │                 │─────────────────►│
  │                     │                 │◄─────────────────│
  │                     │                 │                  │
  │                     │                 │ bcrypt.compare() │
  │                     │                 │ (password, hash) │
  │                     │                 │                  │
  │                     │                 │    ┌─────────────┴─────────────┐
  │                     │                 │    │ If mismatch:              │
  │                     │                 │    │ recordFailedLogin()       │
  │                     │                 │    │ Lock after 5 failures     │
  │                     │                 │    │ (30 min lockout)          │
  │                     │                 │    └─────────────┬─────────────┘
  │                     │                 │                  │
  │                     │                 │ Create session   │
  │                     │                 │ Generate JWT     │
  │                     │                 │                  │
  │                     │◄────────────────│                  │
  │◄────────────────────│ {SUCCESS, accessToken, refreshToken, user}
  │                     │                 │                  │
```

### 6.4 Token Refresh Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        TOKEN REFRESH FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

 Client            AuthController     AuthService     SessionService
  │                     │                 │                │
  │ POST /token/refresh │                 │                │
  │ {refreshToken}      │                 │                │
  │────────────────────►│                 │                │
  │                     │ refreshToken()  │                │
  │                     │────────────────►│                │
  │                     │                 │                │
  │                     │                 │ validateRefresh│
  │                     │                 │ Token()        │
  │                     │                 │───────────────►│
  │                     │                 │                │
  │                     │                 │                │ Hash token
  │                     │                 │                │ Find session
  │                     │                 │                │ Check ACTIVE
  │                     │                 │                │ Check expiry
  │                     │                 │                │ Check idle
  │                     │                 │                │ (WEB only)
  │                     │                 │                │ Update
  │                     │                 │                │ lastActivity
  │                     │                 │◄───────────────│
  │                     │                 │ {session}      │
  │                     │                 │                │
  │                     │                 │ Check user     │
  │                     │                 │ status=ACTIVE  │
  │                     │                 │                │
  │                     │                 │ Generate new   │
  │                     │                 │ JWT (same      │
  │                     │                 │ payload)       │
  │                     │                 │                │
  │                     │◄────────────────│                │
  │◄────────────────────│ {accessToken, expiresIn}        │
  │                     │                 │                │
```

---

## 7. Security Features

### 7.1 OTP Security

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          OTP SECURITY                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  GENERATION                                                             │
│  ├─ 6-digit code generated using crypto.randomInt()                    │
│  ├─ Cryptographically secure random number                             │
│  └─ Range: 100000 - 999999                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  STORAGE                                                                │
│  ├─ Plaintext OTP never stored                                         │
│  ├─ SHA-256 hash stored in database                                    │
│  └─ Plaintext returned only for SMS sending (one-time use)             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  RATE LIMITING                                                          │
│  ├─ Max 3 OTP requests per phone per hour                              │
│  ├─ 60-second cooldown between resends                                 │
│  └─ Max 5 verification attempts per OTP                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  EXPIRY                                                                 │
│  ├─ OTP expires after 5 minutes                                        │
│  ├─ Expired OTPs marked as EXPIRED                                     │
│  └─ Old OTPs cleaned up after 24 hours                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Session Security

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SESSION SECURITY                                  │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  REFRESH TOKEN GENERATION                                               │
│  ├─ 64 random bytes using crypto.randomBytes()                         │
│  ├─ Base64URL encoded (86 characters)                                  │
│  └─ SHA-256 hash stored, plaintext returned to client once             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  DEVICE-SPECIFIC EXPIRY                                                 │
│  ├─ MOBILE_APP: 30 days absolute expiry                                │
│  ├─ WEB: 30 minutes idle timeout, 90 days absolute                     │
│  └─ USSD: 180 seconds (3 minutes)                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  SESSION MANAGEMENT                                                     │
│  ├─ Single session revocation with reason                              │
│  ├─ All-sessions revocation for security events                        │
│  ├─ Optional token rotation for enhanced security                      │
│  └─ Sessions cleaned up after 90 days                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Account Lockout

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       ACCOUNT LOCKOUT                                    │
└──────────────────────────────────────────────────────────────────────────┘

Trigger: 5 consecutive failed login attempts (admin only)

┌─────────────────────────────────────────────────────────────────────────┐
│  LOCKOUT PROCESS                                                        │
│                                                                         │
│  Attempt 1-4: Increment failedLoginAttempts                            │
│               Return INVALID_CREDENTIALS                                │
│                                                                         │
│  Attempt 5:   status = LOCKED                                          │
│               lockedUntil = now + 30 minutes                           │
│               Return ACCOUNT_LOCKED with unlock time                    │
│                                                                         │
│  Auto-Unlock: When lockedUntil has passed                              │
│               isAccountLocked() clears lock automatically              │
│                                                                         │
│  Manual Reset: Via SeederService.resetSuperuserPassword()              │
│                or admin intervention                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.4 JWT Token Security

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        JWT TOKEN SECURITY                                │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  ALGORITHM SELECTION                                                    │
│  ├─ Preferred: RS256 (asymmetric, public/private key pair)             │
│  ├─ Fallback: HS256 (symmetric, shared secret)                         │
│  └─ Auto-detected based on available keys                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  JWT PAYLOAD                                                            │
│  {                                                                      │
│    "sub": "user-uuid",           // User ID                            │
│    "phone": "+254712345678",     // Phone number                        │
│    "role": "RIDER",              // User role                           │
│    "organizationId": "org-uuid", // Optional org context               │
│    "iat": 1702742400,            // Issued at                          │
│    "exp": 1705334400             // Expiry (30 days)                   │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  TOKEN VALIDATION (JwtStrategy)                                         │
│  ├─ Signature verification (RS256/HS256)                               │
│  ├─ Expiry check                                                        │
│  ├─ User exists check                                                   │
│  └─ User status = ACTIVE check                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Dependencies

### 8.1 Internal Module Dependencies

| Module | Purpose | Reference |
|--------|---------|-----------|
| **NotificationModule** | SMS delivery for OTP | forwardRef (circular) |
| **CommonModule** | EncryptionService for PII | Global module |

### 8.2 External Package Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @nestjs/jwt | Latest | JWT generation/validation |
| @nestjs/passport | Latest | Authentication middleware |
| passport-jwt | Latest | JWT strategy for Passport |
| bcrypt | ^5.0+ | Password hashing |
| class-validator | Latest | DTO validation |
| class-transformer | Latest | DTO transformation |

### 8.3 Internal Utilities

| Utility | Purpose |
|---------|---------|
| `normalizePhoneToE164()` | Phone number normalization |
| `EncryptedColumnTransformer` | PII field encryption |
| `BaseEntity` | id, createdAt, updatedAt, deletedAt |

---

## 9. Error Handling

### 9.1 Exception Types

| Exception | HTTP Code | Scenario |
|-----------|-----------|----------|
| `BadRequestException` | 400 | Invalid input, terms not accepted |
| `UnauthorizedException` | 401 | Invalid OTP, invalid token, wrong password |
| `ForbiddenException` | 403 | Account not active |
| `NotFoundException` | 404 | User not found |
| `ConflictException` | 409 | Phone already registered |

### 9.2 Response Status Codes

```typescript
// Registration Statuses
'SUCCESS' | 'DUPLICATE' | 'INVALID_PHONE' | 'TERMS_NOT_ACCEPTED' | 'ERROR' | 'RATE_LIMITED'

// Login Statuses
'OTP_SENT' | 'USER_NOT_FOUND' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'RATE_LIMITED'

// OTP Verification Statuses
'SUCCESS' | 'INVALID_OTP' | 'EXPIRED_OTP' | 'MAX_ATTEMPTS' | 'ERROR'

// Admin Login Statuses
'SUCCESS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_INACTIVE'
```

### 9.3 Error Handling Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING STRATEGY                             │
└──────────────────────────────────────────────────────────────────────────┘

1. VALIDATION ERRORS (400)
   ├─ class-validator catches in DTO
   ├─ Custom messages for each field
   └─ Aggregated into single response

2. AUTHENTICATION ERRORS (401)
   ├─ Invalid OTP → Increment attempts, return remaining
   ├─ Invalid token → Clear session, redirect to login
   └─ Wrong password → Record failed attempt

3. AUTHORIZATION ERRORS (403)
   ├─ Non-admin accessing admin endpoint
   └─ Inactive user attempting action

4. NOT FOUND ERRORS (404)
   ├─ User not found by phone/ID
   └─ Session not found

5. CONFLICT ERRORS (409)
   ├─ Duplicate phone registration
   └─ Duplicate username

6. RATE LIMIT ERRORS (429 via status field)
   ├─ OTP generation rate exceeded
   └─ Returns retryAfter in seconds
```

---

## 10. Configuration

### 10.1 OTP Configuration

```typescript
OTP_CONFIG = {
  LENGTH: 6,                    // 6-digit code
  EXPIRY_MINUTES: 5,            // Expires in 5 minutes
  MAX_ATTEMPTS: 5,              // Max verification attempts
  MAX_REQUESTS_PER_HOUR: 3,     // Rate limit
  RESEND_COOLDOWN_SECONDS: 60,  // Cooldown between resends
}
```

### 10.2 Session Configuration

```typescript
SESSION_CONFIG = {
  MOBILE_EXPIRY_DAYS: 30,       // Mobile app sessions
  WEB_EXPIRY_MINUTES: 30,       // Web idle timeout
  USSD_TIMEOUT_SECONDS: 180,    // USSD session timeout
}
```

### 10.3 JWT Configuration (app.config.ts)

```typescript
jwt: {
  algorithm: 'RS256' | 'HS256',  // Auto-detected
  privateKey: string,            // For RS256
  publicKey: string,             // For RS256
  secret: string,                // For HS256 (fallback)
  expiresIn: '30d',              // Default token expiry
  refreshExpiresIn: '90d',       // Refresh token expiry
  mobileExpiresIn: '30d',        // Mobile-specific
  webExpiresIn: '30m',           // Web-specific
}
```

### 10.4 Superuser Configuration

```typescript
// Default credentials (must change in production)
SUPERUSER_USERNAME: 'SUPERUSER'
SUPERUSER_PASSWORD: 'ChangeMe123!'
SUPERUSER_PHONE: '+254000000000'
```

---

## Appendix: Database Indexes

```sql
-- User table indexes
CREATE UNIQUE INDEX idx_users_phone ON users(phone);
CREATE UNIQUE INDEX idx_users_national_id ON users(national_id) WHERE national_id IS NOT NULL;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- OTP table indexes
CREATE INDEX idx_otps_phone_purpose_status ON otps(phone, purpose, status);
CREATE INDEX idx_otps_expires_at ON otps(expires_at);
CREATE INDEX idx_otps_created_at ON otps(created_at);

-- Session table indexes
CREATE INDEX idx_sessions_user_id_status ON sessions(user_id, status);
CREATE UNIQUE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
```

---

*This document describes the Identity module architecture. For integration with other modules, refer to the High-Level Architecture document.*
