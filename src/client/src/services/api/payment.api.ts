import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { Payment, PaginatedResponse } from '@/types';

export interface StkPushRequest {
  amount: number;
  phone: string;
  type: 'deposit' | 'daily';
}

export interface StkPushResponse {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment?: Payment;
  message: string;
}

export interface PaymentHistoryFilters {
  page?: number;
  limit?: number;
  type?: 'deposit' | 'daily' | 'bulk';
  status?: 'pending' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
}

export const paymentApi = {
  /**
   * Initiate M-Pesa STK Push payment
   */
  initiateStkPush: async (data: StkPushRequest): Promise<StkPushResponse> => {
    const response = await apiClient.post<{ data: StkPushResponse }>(
      API_ENDPOINTS.PAYMENTS_STK_PUSH,
      data
    );
    return response.data.data;
  },

  /**
   * Check payment status by checkout request ID
   */
  checkStatus: async (checkoutRequestId: string): Promise<PaymentStatusResponse> => {
    const response = await apiClient.get<{ data: PaymentStatusResponse }>(
      `${API_ENDPOINTS.PAYMENTS_STATUS}/${checkoutRequestId}`
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
