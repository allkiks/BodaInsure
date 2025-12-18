/**
 * Core TypeScript types for BodaInsure Mobile App
 */

// User types
export interface User {
  id: string;
  phone: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  nationalId?: string;
  dateOfBirth?: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  language: Language;
  organizationId?: string;
  reminderOptOut?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'rider' | 'sacco_admin' | 'sacco_official';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type Language = 'en' | 'sw';

// KYC types
export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface KycDocument {
  id: string;
  type: DocumentType;
  status: KycStatus;
  fileUrl?: string;
  rejectionReason?: string;
  uploadedAt: string;
}

export type DocumentType = 'national_id_front' | 'national_id_back' | 'driving_license' | 'dl_front' | 'dl_back' | 'selfie';

// Payment types
export interface Payment {
  id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  mpesaRef?: string;
  createdAt: string;
}

export type PaymentType = 'deposit' | 'daily' | 'bulk';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

// Wallet types
export interface Wallet {
  balance: number;
  totalDeposited: number;
  totalDailyPayments: number;
  daysCompleted: number;
  daysRemaining: number;
  nextPaymentDue?: string;
}

export interface PaymentProgress {
  depositPaid: boolean;
  daysCompleted: number;
  daysRequired: number;
  progress: number;
  amountPaid: number;
  amountRemaining: number;
  eligibleForPolicy2: boolean;
}

// Policy types
export interface Policy {
  id: string;
  policyNumber: string;
  type: PolicyType;
  status: PolicyStatus;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  vehicleRegistration?: string;
  documentUrl?: string;
}

export type PolicyType = 'initial' | 'extended';

export type PolicyStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'lapsed';

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RegisterRequest {
  phone: string;
  firstName?: string;
  lastName?: string;
  language?: Language;
}

export interface RegisterResponse {
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

// Payment initiation
export interface InitiatePaymentRequest {
  amount: number;
  type: PaymentType;
  days?: number; // For daily payments, number of days to pay for
}

export interface InitiatePaymentResponse {
  paymentId: string;
  checkoutRequestId: string;
  status: 'pending';
  message: string;
}
