import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { InitiatePaymentRequest, InitiatePaymentResponse, Payment, PaymentStatus } from '@/types';
import * as Crypto from 'expo-crypto';

/**
 * Generate a unique idempotency key for payment requests
 * Format: user-timestamp-random
 */
export const generateIdempotencyKey = async (): Promise<string> => {
  const timestamp = Date.now();
  const randomBytes = await Crypto.getRandomBytesAsync(8);
  const randomHex = Array.from(randomBytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pay-${timestamp}-${randomHex}`;
};

export const paymentApi = {
  /**
   * Initiate M-Pesa STK Push payment
   * Per CLAUDE.md Section 7.3: All payment endpoints must be idempotent
   */
  initiatePayment: async (
    data: InitiatePaymentRequest,
    idempotencyKey?: string
  ): Promise<InitiatePaymentResponse> => {
    // Generate idempotency key if not provided
    const key = idempotencyKey || (await generateIdempotencyKey());

    const response = await apiClient.post<InitiatePaymentResponse>(
      API_ENDPOINTS.PAYMENT_INITIATE,
      data,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
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
