import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { User, Wallet, PaymentProgress, Policy, Payment, KycDocument, Language } from '@/types';

export const userApi = {
  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>(API_ENDPOINTS.USER_PROFILE);
    return response.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    language?: Language;
  }): Promise<User> => {
    const response = await apiClient.patch<User>(API_ENDPOINTS.USER_UPDATE, data);
    return response.data;
  },

  /**
   * Get wallet info
   */
  getWallet: async (): Promise<Wallet> => {
    const response = await apiClient.get<Wallet>(API_ENDPOINTS.WALLET);
    return response.data;
  },

  /**
   * Get payment progress
   */
  getPaymentProgress: async (): Promise<PaymentProgress> => {
    const response = await apiClient.get<PaymentProgress>(API_ENDPOINTS.WALLET_PROGRESS);
    return response.data;
  },

  /**
   * Get user's policies
   */
  getPolicies: async (): Promise<Policy[]> => {
    const response = await apiClient.get<Policy[]>(API_ENDPOINTS.POLICIES);
    return response.data;
  },

  /**
   * Get active policy
   */
  getActivePolicy: async (): Promise<Policy | null> => {
    try {
      const response = await apiClient.get<Policy>(API_ENDPOINTS.POLICY_ACTIVE);
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Get payment history
   */
  getPayments: async (): Promise<Payment[]> => {
    const response = await apiClient.get<Payment[]>(API_ENDPOINTS.PAYMENTS);
    return response.data;
  },

  /**
   * Get KYC status and documents
   */
  getKycStatus: async (): Promise<{
    status: string;
    documents: KycDocument[];
  }> => {
    const response = await apiClient.get<{
      status: string;
      documents: KycDocument[];
    }>(API_ENDPOINTS.KYC_STATUS);
    return response.data;
  },
};
