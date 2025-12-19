/**
 * Core TypeScript types for BodaInsure Admin Portal
 */

// User types
export interface User {
  id: string;
  phone: string;
  username?: string;
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

export type UserRole = 'rider' | 'sacco_admin' | 'kba_admin' | 'insurance_admin' | 'platform_admin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type Language = 'en' | 'sw';

// KYC types
// Server uses uppercase status values
export type KycStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface KycDocument {
  id: string;
  userId: string;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Server document types (uppercase)
export type DocumentType = 'ID_FRONT' | 'ID_BACK' | 'LICENSE' | 'LOGBOOK' | 'KRA_PIN' | 'PHOTO';

// Legacy document type mapping (for older code)
export type LegacyDocumentType = 'national_id_front' | 'national_id_back' | 'driving_license' | 'selfie';

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
  code: string;
  type: OrganizationType;
  parentId?: string;
  description?: string;
  registrationNumber?: string;
  kraPin?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  countyCode?: string;
  county?: string;
  subCounty?: string;
  ward?: string;
  leaderName?: string;
  leaderPhone?: string;
  secretaryName?: string;
  secretaryPhone?: string;
  treasurerName?: string;
  treasurerPhone?: string;
  estimatedMembers?: number;
  verifiedMembers?: number;
  memberCount: number;
  commissionRate?: number;
  status: OrganizationStatus;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  code: string;
  type: OrganizationType;
  parentId?: string;
  description?: string;
  registrationNumber?: string;
  kraPin?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  countyCode?: string;
  subCounty?: string;
  ward?: string;
  leaderName?: string;
  leaderPhone?: string;
  secretaryName?: string;
  secretaryPhone?: string;
  treasurerName?: string;
  treasurerPhone?: string;
  estimatedMembers?: number;
  commissionRate?: number;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  registrationNumber?: string;
  kraPin?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  countyCode?: string;
  subCounty?: string;
  ward?: string;
  leaderName?: string;
  leaderPhone?: string;
  secretaryName?: string;
  secretaryPhone?: string;
  treasurerName?: string;
  treasurerPhone?: string;
  estimatedMembers?: number;
  commissionRate?: number;
  status?: OrganizationStatus;
}

export type OrganizationType = 'UMBRELLA_BODY' | 'SACCO' | 'ASSOCIATION' | 'STAGE';

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';

// Policy Terms types
export interface PolicyTerms {
  id: string;
  version: string;
  type: PolicyTermsType;
  title: string;
  content: string;
  contentSw?: string;
  summary: string;
  summarySw?: string;
  keyTerms: string[];
  keyTermsSw?: string[];
  inclusions: string[];
  exclusions: string[];
  freeLookDays: number;
  underwriterName: string;
  cancellationPolicy: string;
  claimsProcess: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PolicyTermsType = 'TPO' | 'COMPREHENSIVE';

export interface CreatePolicyTermsRequest {
  version: string;
  type: PolicyTermsType;
  title: string;
  content: string;
  contentSw?: string;
  summary: string;
  summarySw?: string;
  keyTerms: string[];
  keyTermsSw?: string[];
  inclusions: string[];
  exclusions: string[];
  freeLookDays: number;
  underwriterName: string;
  cancellationPolicy: string;
  claimsProcess: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

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
  newToday?: number;
  newThisWeek?: number;
  newThisMonth?: number;
  trend?: TrendData[];
}

export interface PaymentMetrics {
  // Fields expected by PaymentDashboard component
  todayRevenue: number;
  todayTransactions: number;
  successRate: number;
  deposits: number;
  dailyPayments: number;
  complianceRate: number;
  atRiskUsers: number;
  // Additional fields from server
  totalTransactions: number;
  totalAmount: number;
  averagePaymentAmount: number;
  failedTransactions: number;
  pendingTransactions: number;
}

export interface PolicyMetrics {
  // Fields expected by PolicyDashboard component
  activePolicies: number;
  expiringIn30Days: number;
  lapsedPolicies: number;
  initialPolicies: number;
  extendedPolicies: number;
  // Additional fields from server
  totalPolicies: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
  issuedToday: number;
  issuedThisWeek: number;
  issuedThisMonth: number;
  averageDaysToCompletion: number;
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

// Admin login types
export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  status: 'SUCCESS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_INACTIVE';
  message: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    id: string;
    username: string;
    role: string;
    status: string;
  };
  lockedUntil?: string;
}
