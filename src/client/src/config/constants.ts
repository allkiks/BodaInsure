/**
 * Application constants
 * Per CLAUDE.md: No magic numbers - use named constants
 */

// Payment amounts (KES)
// TODO: Change back to production values (1048, 87, 3658) for production
export const PAYMENT_AMOUNTS = {
  INITIAL_DEPOSIT: 5, // DEV ONLY (production: 1048)
  DAILY_PAYMENT: 1, // DEV ONLY (production: 87)
  TOTAL_ANNUAL: 35, // DEV ONLY (production: 3658)
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
  AUTH_REGISTER: '/auth/register',
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

// GAP-015: Policy statuses - standardized to UPPERCASE (matching server)
export const POLICY_STATUSES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  LAPSED: 'LAPSED',
} as const;

// GAP-015: KYC statuses - standardized to UPPERCASE (matching server)
export const KYC_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

// GAP-015: Payment statuses - standardized to UPPERCASE (matching server)
export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// GAP-015: User statuses - standardized to UPPERCASE (matching server)
export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING: 'PENDING',
} as const;

/**
 * GAP-015: Status normalization utility
 * Use this to compare statuses that may come in different cases
 */
export function normalizeStatus<T extends string>(status: T | undefined | null): string {
  return (status ?? '').toUpperCase();
}

/**
 * GAP-015: Status comparison utility for case-insensitive matching
 */
export function statusEquals(status1: string | undefined | null, status2: string): boolean {
  return normalizeStatus(status1) === status2.toUpperCase();
}

// Membership statuses (matches server enum)
export const MEMBERSHIP_STATUSES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;

// Membership roles (matches server enum)
export const MEMBERSHIP_ROLES = {
  MEMBER: 'MEMBER',
  OFFICIAL: 'OFFICIAL',
  ADMIN: 'ADMIN',
  CHAIRPERSON: 'CHAIRPERSON',
  SECRETARY: 'SECRETARY',
  TREASURER: 'TREASURER',
} as const;

// Human-readable labels for membership roles
export const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Member',
  OFFICIAL: 'Official',
  ADMIN: 'Admin',
  CHAIRPERSON: 'Chairperson',
  SECRETARY: 'Secretary',
  TREASURER: 'Treasurer',
};

// Human-readable labels for membership statuses
export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

// Navigation items
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Users', path: '/users', icon: 'Users' },
  { label: 'Organizations', path: '/organizations', icon: 'Building2' },
  { label: 'KYC Review', path: '/kyc', icon: 'FileCheck' },
  { label: 'Reports', path: '/reports', icon: 'FileText' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;
