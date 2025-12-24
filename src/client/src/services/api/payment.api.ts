import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { Payment, PaginatedResponse } from '@/types';

export interface StkPushRequest {
  amount: number;
  phone: string;
  type: 'deposit' | 'daily';
  daysCount?: number;
}

export interface StkPushResponse {
  success: boolean;
  paymentRequestId: string;
  checkoutRequestId: string;
  amount: number;
  message: string;
  status: string;
}

// GAP-015: Status types use UPPERCASE to match server
export interface PaymentStatusResponse {
  paymentRequestId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  transactionId?: string;
  mpesaReceiptNumber?: string;
  amount: number;
  type: string;
  failureReason?: string;
  resultCode?: string | number; // GAP-007: M-Pesa result code for specific error messages
  createdAt: string;
  message?: string;
}

export interface PaymentEligibility {
  allowed: boolean;
  reason?: string;
  remainingDays?: number;
}

export interface PaymentHistoryFilters {
  page?: number;
  limit?: number;
  type?: 'deposit' | 'daily' | 'bulk';
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  startDate?: string;
  endDate?: string;
}

export const paymentApi = {
  /**
   * Check if user can make deposit payment (includes KYC check)
   */
  checkDepositEligibility: async (): Promise<PaymentEligibility> => {
    const response = await apiClient.get<{ data: PaymentEligibility }>(
      `${API_ENDPOINTS.PAYMENTS}/eligibility/deposit`
    );
    return response.data.data;
  },

  /**
   * Check if user can make daily payment (includes KYC check)
   */
  checkDailyEligibility: async (): Promise<PaymentEligibility> => {
    const response = await apiClient.get<{ data: PaymentEligibility }>(
      `${API_ENDPOINTS.PAYMENTS}/eligibility/daily`
    );
    return response.data.data;
  },

  /**
   * Initiate M-Pesa STK Push payment
   */
  initiateStkPush: async (data: StkPushRequest): Promise<StkPushResponse> => {
    // Call the correct endpoint based on payment type
    const endpoint = data.type === 'deposit'
      ? `${API_ENDPOINTS.PAYMENTS}/deposit`
      : `${API_ENDPOINTS.PAYMENTS}/daily`;

    const response = await apiClient.post<{ data: StkPushResponse }>(
      endpoint,
      {
        phone: data.phone,
        idempotencyKey: `${data.type}-${Date.now()}`,
        ...(data.type === 'daily' && data.daysCount ? { daysCount: data.daysCount } : {}),
      }
    );
    return response.data.data;
  },

  /**
   * Check payment status by payment request ID
   */
  checkStatus: async (paymentRequestId: string): Promise<PaymentStatusResponse> => {
    const response = await apiClient.get<{ data: PaymentStatusResponse }>(
      `${API_ENDPOINTS.PAYMENTS}/status/${paymentRequestId}`
    );
    return response.data.data;
  },

  /**
   * Refresh payment status by querying M-Pesa directly
   * Use when callback may have been missed (timeout scenarios)
   */
  refreshStatus: async (paymentRequestId: string): Promise<PaymentStatusResponse> => {
    const response = await apiClient.post<{ data: PaymentStatusResponse }>(
      `${API_ENDPOINTS.PAYMENTS}/status/${paymentRequestId}/refresh`
    );
    return response.data.data;
  },

  /**
   * Get payment history for current user
   */
  getHistory: async (filters?: PaymentHistoryFilters): Promise<PaginatedResponse<Payment>> => {
    const response = await apiClient.get<PaginatedResponse<Payment>>(
      API_ENDPOINTS.PAYMENTS_HISTORY,
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get payment by ID
   */
  getById: async (paymentId: string): Promise<Payment> => {
    const response = await apiClient.get<{ data: Payment }>(
      `${API_ENDPOINTS.PAYMENTS}/${paymentId}`
    );
    return response.data.data;
  },

  /**
   * Initiate payment on behalf of user (admin only)
   */
  initiateForUser: async (userId: string, data: StkPushRequest): Promise<StkPushResponse> => {
    const response = await apiClient.post<{ data: StkPushResponse }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/payments/stk-push`,
      data
    );
    return response.data.data;
  },
};
