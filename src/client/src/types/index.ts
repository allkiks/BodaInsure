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
  fullName?: string;
  email?: string;
  nationalId?: string;
  dateOfBirth?: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  language: Language;
  organizationId?: string; // For role-based access control
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'rider' | 'sacco_admin' | 'kba_admin' | 'insurance_admin' | 'platform_admin';

// GAP-015: Standardized to UPPERCASE (matching server)
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

export type Language = 'en' | 'sw';

// KYC types
// GAP-015: Standardized to UPPERCASE (matching server)
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
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
  mpesaReceiptNumber?: string;
  phone: string;
  idempotencyKey: string;
  failureReason?: string;
  resultCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentType = 'deposit' | 'daily' | 'bulk';

// GAP-015: Standardized to UPPERCASE (matching server)
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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

// GAP-015: Standardized to UPPERCASE (matching server)
export type PolicyStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'LAPSED';

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

// Membership types - matches server entity
export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  organizationName?: string;
  organizationCode?: string;
  role: MembershipRole;
  status: MembershipStatus;
  memberNumber?: string;
  isPrimary: boolean;
  joinedAt?: string;
  expiresAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  suspendedBy?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  feePaid?: number;
  feeReference?: string;
  createdAt: string;
  updatedAt: string;
}

// Member with user details (for organization member lists)
// This matches what organizationsApi.getMembers returns: User & { membership: Membership }
export type OrganizationMember = User & { membership: Membership };

// Server uses uppercase role values
export type MembershipRole = 'MEMBER' | 'OFFICIAL' | 'ADMIN' | 'CHAIRPERSON' | 'SECRETARY' | 'TREASURER';

// Server uses uppercase status values
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

// Request types for membership operations
export interface CreateMembershipRequest {
  userId: string;
  organizationId: string;
  role?: MembershipRole;
  memberNumber?: string;
  isPrimary?: boolean;
}

export interface UpdateMembershipRequest {
  role?: MembershipRole;
  memberNumber?: string;
  isPrimary?: boolean;
  expiresAt?: string;
}

export interface SuspendMembershipRequest {
  reason?: string;
}

export interface BulkAddMembersRequest {
  userIds: string[];
  role?: MembershipRole;
}

export interface BulkAddMembersResponse {
  created: number;
  errors: number;
  results: {
    userId: string;
    status: 'created' | 'existing' | 'error';
    membershipId?: string;
    error?: string;
  }[];
}

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
  defaultFormat: ReportFormat;
  availableFormats: ReportFormat[];
  frequency: ReportFrequency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReportType = 'ENROLLMENT' | 'PAYMENT' | 'POLICY' | 'ORGANIZATION' | 'FINANCIAL' | 'CUSTOM';
export type ReportFormat = 'JSON' | 'CSV' | 'EXCEL' | 'PDF';
export type ReportFrequency = 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
}

export interface GeneratedReport {
  id: string;
  definitionId: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  startDate: string;
  endDate: string;
  format: ReportFormat;
  fileUrl?: string;
  recordCount?: number;
  createdAt: string;
}

// Cash Flow Report types
export interface CashFlowLineItem {
  id: string;
  label: string;
  indent: number;
  isTotal: boolean;
  isBold: boolean;
  currentPeriod: number | null;
  priorPeriod: number | null;
  variance: number | null;
}

export interface CashFlowPeriod {
  startDate: string;
  endDate: string;
}

export interface CashFlowReportData {
  reportTitle: string;
  organizationName: string;
  currentPeriod: CashFlowPeriod;
  priorPeriod: CashFlowPeriod;
  lineItems: CashFlowLineItem[];
  metadata?: {
    generatedAt: string;
    generatedBy?: string;
    organizationId?: string;
  };
}

export interface CashFlowReportMetadata {
  reportTitle: string;
  organizationName: string;
  currentPeriod: CashFlowPeriod;
  priorPeriod: CashFlowPeriod;
  lineItems: CashFlowLineItem[];
  isCashFlowReport: boolean;
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

// Registration request - GAP-004: All riders must belong to a SACCO
export interface RegisterRequest {
  phone: string;
  organizationId: string;
  termsAccepted: boolean;
  language?: 'en' | 'sw';
  role?: UserRole;
  useDefaultPassword?: boolean; // Skip OTP and use default password (ChangeMe123!)
}

export interface RegisterResponse {
  status: 'SUCCESS' | 'DUPLICATE' | 'INVALID_PHONE' | 'TERMS_NOT_ACCEPTED' | 'RATE_LIMITED' | 'ERROR';
  userId?: string;
  otpSent: boolean;
  message: string;
}

// Admin user creation request
export interface CreateUserRequest {
  phone: string;
  organizationId: string;
  role?: UserRole;
  termsAccepted?: boolean;
  language?: Language;
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
