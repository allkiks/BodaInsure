/**
 * Core TypeScript types for BodaInsure Admin Portal
 */

// User types
export interface User {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  nationalId?: string;
  dateOfBirth?: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  language: Language;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'super_admin' | 'admin' | 'support' | 'viewer' | 'rider';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type Language = 'en' | 'sw';

// KYC types
export type KycStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface KycDocument {
  id: string;
  userId: string;
  type: DocumentType;
  status: KycStatus;
  fileUrl: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType = 'national_id_front' | 'national_id_back' | 'driving_license' | 'selfie';

// Payment types
export interface Payment {
  id: string;
  userId: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  mpesaRef?: string;
  phone: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentType = 'deposit' | 'daily' | 'bulk';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  totalDeposited: number;
  totalDailyPayments: number;
  daysCompleted: number;
  createdAt: string;
  updatedAt: string;
}

// Policy types
export interface Policy {
  id: string;
  userId: string;
  policyNumber: string;
  type: PolicyType;
  status: PolicyStatus;
  startDate: string;
  endDate: string;
  vehicleRegistration?: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type PolicyType = 'initial' | 'extended';

export type PolicyStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'lapsed';

// Organization types
export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  parentId?: string;
  contactPhone?: string;
  contactEmail?: string;
  county?: string;
  subCounty?: string;
  status: OrganizationStatus;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationType = 'umbrella' | 'sacco' | 'association';

export type OrganizationStatus = 'active' | 'inactive' | 'pending';

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type MembershipRole = 'member' | 'official' | 'admin';

export type MembershipStatus = 'active' | 'inactive' | 'pending';

// Dashboard types
export interface DashboardMetrics {
  enrollment: EnrollmentMetrics;
  payments: PaymentMetrics;
  policies: PolicyMetrics;
}

export interface EnrollmentMetrics {
  target: number;
  current: number;
  progress: number;
  registered: number;
  kycComplete: number;
  depositPaid: number;
  trend: TrendData[];
}

export interface PaymentMetrics {
  todayRevenue: number;
  todayTransactions: number;
  successRate: number;
  deposits: number;
  dailyPayments: number;
  complianceRate: number;
  atRiskUsers: number;
}

export interface PolicyMetrics {
  activePolicies: number;
  expiringIn30Days: number;
  lapsedPolicies: number;
  initialPolicies: number;
  extendedPolicies: number;
}

export interface TrendData {
  date: string;
  value: number;
}

// Report types
export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  columns: ReportColumn[];
}

export type ReportType = 'enrollment' | 'payment' | 'policy' | 'kyc';

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
}

export interface GeneratedReport {
  id: string;
  definitionId: string;
  status: 'pending' | 'completed' | 'failed';
  startDate: string;
  endDate: string;
  format: 'csv' | 'xlsx';
  downloadUrl?: string;
  createdAt: string;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
    request_id?: string;
  };
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  phone: string;
}

export interface LoginResponse {
  sessionId: string;
  expiresAt: string;
}

export interface OtpVerifyRequest {
  sessionId: string;
  otp: string;
}

export interface OtpVerifyResponse {
  token: string;
  user: User;
  expiresAt: string;
}
