/**
 * Application constants
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
  WEB_TIMEOUT_MINUTES: 30,
  MOBILE_TIMEOUT_DAYS: 30,
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000, // 5 minutes before expiry
} as const;

// OTP configuration
export const OTP_CONFIG = {
  MAX_ATTEMPTS: 5,
  RATE_LIMIT_PER_HOUR: 3,
  EXPIRY_MINUTES: 10,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_ADMIN_LOGIN: '/auth/admin/login',
  AUTH_VERIFY_OTP: '/auth/otp/verify',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',

  // Admin
  ADMIN_USERS_SEARCH: '/admin/users/search',
  ADMIN_USER_BY_ID: '/admin/users',
  ADMIN_USER_BY_PHONE: '/admin/users/phone',

  // Dashboard
  DASHBOARD: '/dashboard',
  DASHBOARD_ENROLLMENT: '/dashboard/enrollment',
  DASHBOARD_PAYMENTS: '/dashboard/payments',
  DASHBOARD_POLICIES: '/dashboard/policies',

  // Organizations
  ORGANIZATIONS: '/organizations',
  MEMBERSHIPS: '/memberships',

  // KYC (Admin)
  KYC_PENDING: '/kyc/admin/pending',
  KYC_DOCUMENTS: '/kyc/admin/documents',

  // KYC (User self-service)
  KYC_STATUS: '/kyc/status',
  KYC_UPLOAD: '/kyc/documents',
  KYC_MY_DOCUMENTS: '/kyc/documents',

  // Wallet
  WALLET: '/wallet',
  WALLET_TRANSACTIONS: '/wallet/transactions',

  // Payments
  PAYMENTS: '/payments',
  PAYMENTS_STK_PUSH: '/payments/stk-push',
  PAYMENTS_STATUS: '/payments/status',
  PAYMENTS_HISTORY: '/payments/history',

  // Policies
  POLICIES: '/policies',
  POLICIES_MY: '/policies/my',

  // User Profile
  USER_PROFILE: '/users/me',
  USER_UPDATE_PROFILE: '/users/me',
  USER_DELETE_ACCOUNT: '/users/me/delete-request',

  // Reports
  REPORTS: '/reports',
  REPORT_DEFINITIONS: '/reports/definitions',
  REPORT_GENERATE: '/reports/generate',

  // Settings
  SETTINGS: '/settings',
} as const;

// User roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUPPORT: 'support',
  VIEWER: 'viewer',
} as const;

// Policy statuses
export const POLICY_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  LAPSED: 'lapsed',
} as const;

// KYC statuses
export const KYC_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

// Payment statuses
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// Navigation items
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Users', path: '/users', icon: 'Users' },
  { label: 'Organizations', path: '/organizations', icon: 'Building2' },
  { label: 'KYC Review', path: '/kyc', icon: 'FileCheck' },
  { label: 'Reports', path: '/reports', icon: 'FileText' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;
