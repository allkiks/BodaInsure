/**
 * Application constants for BodaInsure Mobile
 * Per CLAUDE.md: No magic numbers - use named constants
 */

// Payment amounts (KES)
export const PAYMENT_AMOUNTS = {
  INITIAL_DEPOSIT: 1048,
  DAILY_PAYMENT: 87,
  TOTAL_ANNUAL: 3658,
  DAYS_REQUIRED: 30,
} as const;

// Policy durations (months)
export const POLICY_DURATIONS = {
  INITIAL_POLICY: 1,
  EXTENDED_POLICY: 11,
  TOTAL_COVERAGE: 12,
} as const;

// Session configuration
export const SESSION_CONFIG = {
  MOBILE_TIMEOUT_DAYS: 30,
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000, // 5 minutes before expiry
} as const;

// OTP configuration
export const OTP_CONFIG = {
  MAX_ATTEMPTS: 5,
  RATE_LIMIT_PER_HOUR: 3,
  EXPIRY_MINUTES: 10,
  LENGTH: 6,
} as const;

// KYC document types
export const KYC_DOCUMENT_TYPES = {
  NATIONAL_ID_FRONT: 'national_id_front',
  NATIONAL_ID_BACK: 'national_id_back',
  DRIVING_LICENSE: 'driving_license',
  SELFIE: 'selfie',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGIN: '/auth/login',
  AUTH_VERIFY_OTP: '/auth/otp/verify',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',

  // User
  USER_PROFILE: '/users/me',
  USER_UPDATE: '/users/me',

  // KYC
  KYC_UPLOAD: '/kyc/documents',
  KYC_STATUS: '/kyc/status',

  // Wallet
  WALLET: '/wallet',
  WALLET_PROGRESS: '/wallet/progress',

  // Payments
  PAYMENTS: '/payments',
  PAYMENT_INITIATE: '/payments/initiate',
  PAYMENT_STATUS: '/payments/status',

  // Policies
  POLICIES: '/policies',
  POLICY_ACTIVE: '/policies/active',
} as const;

// Colors (matching brand)
export const COLORS = {
  primary: '#16a34a', // Green
  primaryLight: '#22c55e',
  primaryDark: '#15803d',
  secondary: '#64748b',
  background: '#ffffff',
  surface: '#f8fafc',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  text: '#0f172a',
  textLight: '#64748b',
  border: '#e2e8f0',
} as const;

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Font sizes
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;
