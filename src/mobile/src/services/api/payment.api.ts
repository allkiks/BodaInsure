import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { InitiatePaymentRequest, InitiatePaymentResponse, Payment, PaymentStatus } from '@/types';

export const paymentApi = {
  /**
   * Initiate M-Pesa STK Push payment
   */
  initiatePayment: async (data: InitiatePaymentRequest): Promise<InitiatePaymentResponse> => {
    const response = await apiClient.post<InitiatePaymentResponse>(
      API_ENDPOINTS.PAYMENT_INITIATE,
      data
    );
    return response.data;
  },

  /**
   * Check payment status
   */
  getPaymentStatus: async (paymentId: string): Promise<{
    status: PaymentStatus;
    mpesaRef?: string;
    message?: string;
  }> => {
    const response = await apiClient.get<{
      status: PaymentStatus;
      mpesaRef?: string;
      message?: string;
    }>(`${API_ENDPOINTS.PAYMENT_STATUS}/${paymentId}`);
    return response.data;
  },

  /**
   * Get payment history
   */
  getPayments: async (): Promise<Payment[]> => {
    const response = await apiClient.get<Payment[]>(API_ENDPOINTS.PAYMENTS);
    return response.data;
  },

  /**
   * Get payment by ID
   */
  getPayment: async (id: string): Promise<Payment> => {
    const response = await apiClient.get<Payment>(`${API_ENDPOINTS.PAYMENTS}/${id}`);
    return response.data;
  },
};
