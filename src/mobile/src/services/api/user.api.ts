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
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    language?: Language;
  }): Promise<User> => {
    const response = await apiClient.patch<User>(API_ENDPOINTS.USER_UPDATE, data);
    return response.data;
  },

  /**
   * Update user preferences
   */
  updatePreferences: async (data: {
    reminderOptOut?: boolean;
    language?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      API_ENDPOINTS.USER_PREFERENCES,
      data
    );
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

  /**
   * Get policy document download URL
   */
  getPolicyDocument: async (policyId: string): Promise<{
    downloadUrl: string | null;
    message: string;
  }> => {
    const endpoint = API_ENDPOINTS.POLICY_DOCUMENT.replace(':policyId', policyId);
    const response = await apiClient.get<{
      downloadUrl: string | null;
      message: string;
    }>(endpoint);
    return response.data;
  },

  /**
   * Cancel a policy (within free-look period)
   */
  cancelPolicy: async (policyId: string, reason: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const endpoint = API_ENDPOINTS.POLICY_CANCEL.replace(':policyId', policyId);
    const response = await apiClient.post<{
      success: boolean;
      message: string;
    }>(endpoint, { reason });
    return response.data;
  },

  /**
   * Request account deletion (30-day grace period)
   * Per Data Protection Act 2019: Right to Deletion
   */
  requestDeletion: async (reason?: string): Promise<{
    success: boolean;
    message: string;
    deletionScheduledFor: string;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      deletionScheduledFor: string;
    }>('/users/me/request-deletion', { reason });
    return response.data;
  },

  /**
   * Get account deletion status
   */
  getDeletionStatus: async (): Promise<{
    isScheduled: boolean;
    deletionScheduledFor?: string;
    daysRemaining?: number;
    reason?: string;
  }> => {
    const response = await apiClient.get<{
      isScheduled: boolean;
      deletionScheduledFor?: string;
      daysRemaining?: number;
      reason?: string;
    }>('/users/me/deletion-status');
    return response.data;
  },

  /**
   * Cancel account deletion request
   */
  cancelDeletion: async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
    }>('/users/me/cancel-deletion');
    return response.data;
  },

  /**
   * Export user data (GDPR/DPA compliance)
   */
  exportData: async (): Promise<{
    exportedAt: string;
    data: Record<string, unknown>;
  }> => {
    const response = await apiClient.get<{
      exportedAt: string;
      data: Record<string, unknown>;
    }>('/users/me/data-export');
    return response.data;
  },
};
