import { apiClient } from './client';
import type { PolicyTerms, CreatePolicyTermsRequest, PaginatedResponse } from '@/types';

const ENDPOINTS = {
  POLICY_TERMS: '/policy-terms',
};

interface PolicyTermsSearchParams {
  type?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// Server response shape for policy terms list
interface ServerPolicyTermsListResponse {
  policyTerms: PolicyTerms[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const policyTermsApi = {
  /**
   * Get current active policy terms by type
   */
  getCurrent: async (type: string = 'TPO'): Promise<PolicyTerms> => {
    const response = await apiClient.get<{ data: PolicyTerms }>(
      `${ENDPOINTS.POLICY_TERMS}/current`,
      { params: { type } }
    );
    return response.data.data;
  },

  /**
   * List all policy terms with filters
   */
  list: async (params: PolicyTermsSearchParams = {}): Promise<PaginatedResponse<PolicyTerms>> => {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const response = await apiClient.get<{ data: ServerPolicyTermsListResponse }>(
      ENDPOINTS.POLICY_TERMS,
      {
        params: {
          type: params.type,
          isActive: params.isActive,
          page,
          limit,
        },
      }
    );

    const serverData = response.data.data;
    return {
      data: serverData.policyTerms,
      meta: {
        total: serverData.total,
        page: serverData.page,
        limit: serverData.limit,
        totalPages: serverData.totalPages,
      },
    };
  },

  /**
   * Get policy terms by ID
   */
  getById: async (id: string): Promise<PolicyTerms> => {
    const response = await apiClient.get<{ data: PolicyTerms }>(
      `${ENDPOINTS.POLICY_TERMS}/${id}`
    );
    return response.data.data;
  },

  /**
   * Create new policy terms
   */
  create: async (data: CreatePolicyTermsRequest): Promise<PolicyTerms> => {
    const response = await apiClient.post<{ data: PolicyTerms }>(
      ENDPOINTS.POLICY_TERMS,
      data
    );
    return response.data.data;
  },

  /**
   * Update policy terms
   */
  update: async (id: string, data: Partial<CreatePolicyTermsRequest>): Promise<PolicyTerms> => {
    const response = await apiClient.put<{ data: PolicyTerms }>(
      `${ENDPOINTS.POLICY_TERMS}/${id}`,
      data
    );
    return response.data.data;
  },

  /**
   * Activate policy terms (sets as current active version)
   */
  activate: async (id: string): Promise<PolicyTerms> => {
    const response = await apiClient.post<{ data: PolicyTerms }>(
      `${ENDPOINTS.POLICY_TERMS}/${id}/activate`
    );
    return response.data.data;
  },

  /**
   * Deactivate policy terms
   */
  deactivate: async (id: string): Promise<PolicyTerms> => {
    const response = await apiClient.post<{ data: PolicyTerms }>(
      `${ENDPOINTS.POLICY_TERMS}/${id}/deactivate`
    );
    return response.data.data;
  },

  /**
   * Delete policy terms
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${ENDPOINTS.POLICY_TERMS}/${id}`);
  },

  /**
   * Get version history for a policy type
   */
  getVersionHistory: async (type: string): Promise<PolicyTerms[]> => {
    const response = await apiClient.get<{ data: PolicyTerms[] }>(
      `${ENDPOINTS.POLICY_TERMS}/history/${type}`
    );
    return response.data.data;
  },
};
