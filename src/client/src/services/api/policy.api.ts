import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { Policy, PaginatedResponse } from '@/types';

export interface PolicyFilters {
  page?: number;
  limit?: number;
  status?: 'pending' | 'active' | 'expired' | 'cancelled' | 'lapsed';
  type?: 'initial' | 'extended';
}

export interface PolicyWithProgress extends Policy {
  daysCompleted?: number;
  daysRemaining?: number;
  progress?: number;
}

// Server response shape for policy document download
interface ServerDocumentResponse {
  downloadUrl: string | null;
  message: string;
}

export const policyApi = {
  /**
   * Get current user's policies
   */
  getMyPolicies: async (filters?: PolicyFilters): Promise<PaginatedResponse<PolicyWithProgress>> => {
    const response = await apiClient.get<{ data: PolicyWithProgress[] }>(
      API_ENDPOINTS.POLICIES_MY,
      { params: filters }
    );
    // Server returns { data: PolicyWithProgress[] }, transform to PaginatedResponse
    const policies = response.data.data ?? [];
    return {
      data: policies,
      meta: {
        total: policies.length,
        page: 1,
        limit: policies.length,
        totalPages: 1,
      },
    };
  },

  /**
   * Get policy by ID
   */
  getById: async (policyId: string): Promise<PolicyWithProgress> => {
    const response = await apiClient.get<{ data: PolicyWithProgress }>(
      `${API_ENDPOINTS.POLICIES}/${policyId}`
    );
    return response.data.data;
  },

  /**
   * Download policy document
   */
  downloadDocument: async (policyId: string): Promise<{ url: string | null; message: string }> => {
    const response = await apiClient.get<{ data: ServerDocumentResponse }>(
      `${API_ENDPOINTS.POLICIES}/${policyId}/document`
    );
    return {
      url: response.data.data.downloadUrl,
      message: response.data.data.message,
    };
  },

  /**
   * Get policies for a specific user (admin only)
   */
  getByUserId: async (userId: string, filters?: PolicyFilters): Promise<PaginatedResponse<PolicyWithProgress>> => {
    const response = await apiClient.get<{ data: { policies: PolicyWithProgress[] } }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/policies`,
      { params: filters }
    );
    const policies = response.data.data.policies ?? [];
    return {
      data: policies,
      meta: {
        total: policies.length,
        page: 1,
        limit: policies.length,
        totalPages: 1,
      },
    };
  },

  /**
   * Get all policies (admin only)
   */
  getAll: async (filters?: PolicyFilters & { userId?: string; search?: string }): Promise<PaginatedResponse<PolicyWithProgress>> => {
    const response = await apiClient.get<{ data: { policies: PolicyWithProgress[] } }>(
      API_ENDPOINTS.POLICIES,
      { params: filters }
    );
    const policies = response.data.data.policies ?? [];
    return {
      data: policies,
      meta: {
        total: policies.length,
        page: 1,
        limit: policies.length,
        totalPages: 1,
      },
    };
  },
};
