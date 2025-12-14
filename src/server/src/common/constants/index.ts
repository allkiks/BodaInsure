/**
 * BodaInsure Platform Constants
 * These values are fixed per business requirements
 */

// Payment amounts (FIXED per CLAUDE.md)
export const DEPOSIT_AMOUNT = 1048; // KES
export const DAILY_AMOUNT = 87; // KES
export const TOTAL_DAILY_PAYMENTS = 30;
export const TOTAL_ANNUAL = 3658; // KES (1048 + 87*30)

// Payment configuration object (for services)
export const PAYMENT_CONFIG = {
  DEPOSIT_AMOUNT,
  DAILY_AMOUNT,
  TOTAL_DAILY_PAYMENTS,
  TOTAL_ANNUAL,
} as const;

// Policy types
export const POLICY_TYPE_1_MONTH = '1_MONTH';
export const POLICY_TYPE_11_MONTH = '11_MONTH';

// User roles
export const ROLES = {
  RIDER: 'rider',
  SACCO_ADMIN: 'sacco_admin',
  KBA_ADMIN: 'kba_admin',
  INSURANCE_ADMIN: 'insurance_admin',
  PLATFORM_ADMIN: 'platform_admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// KYC statuses
export const KYC_STATUS = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  INCOMPLETE: 'INCOMPLETE',
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

// Policy statuses
export const POLICY_STATUS = {
  PENDING_DEPOSIT: 'PENDING_DEPOSIT',
  PENDING_ISSUANCE: 'PENDING_ISSUANCE',
  ACTIVE: 'ACTIVE',
  EXPIRING: 'EXPIRING',
  EXPIRED: 'EXPIRED',
  LAPSED: 'LAPSED',
  CANCELLED: 'CANCELLED',
} as const;

export type PolicyStatus = (typeof POLICY_STATUS)[keyof typeof POLICY_STATUS];

// Transaction types
export const TRANSACTION_TYPE = {
  DEPOSIT: 'DEPOSIT',
  DAILY_PAYMENT: 'DAILY_PAYMENT',
  PREMIUM_DEBIT: 'PREMIUM_DEBIT',
  REFUND: 'REFUND',
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

// Transaction statuses
export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

// Document types for KYC
export const DOCUMENT_TYPE = {
  ID_FRONT: 'ID_FRONT',
  ID_BACK: 'ID_BACK',
  LICENSE: 'LICENSE',
  LOGBOOK: 'LOGBOOK',
  KRA_PIN: 'KRA_PIN',
  PHOTO: 'PHOTO',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE];

// SLA targets (in milliseconds unless noted)
export const SLA = {
  USSD_RESPONSE_TIME_MS: 2000,
  API_RESPONSE_TIME_MS: 500,
  BATCH_PROCESSING_TIME_MIN: 30,
  POLICY_DELIVERY_HOURS: 6,
  SYSTEM_UPTIME_PERCENT: 99.5,
} as const;

// OTP configuration
export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 5,
  MAX_REQUESTS_PER_HOUR: 3,
  RESEND_COOLDOWN_SECONDS: 60,
} as const;

// Session configuration
export const SESSION_CONFIG = {
  MOBILE_EXPIRY_DAYS: 30,
  WEB_EXPIRY_MINUTES: 30,
  USSD_TIMEOUT_SECONDS: 180,
} as const;

// Batch processing schedule (times in EAT)
export const BATCH_SCHEDULE = {
  BATCH_1: '08:00',
  BATCH_2: '14:00',
  BATCH_3: '20:00',
} as const;
