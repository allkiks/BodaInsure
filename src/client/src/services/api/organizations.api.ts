import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type { Organization, Membership, PaginatedResponse, User } from '@/types';

interface OrganizationSearchParams {
  query?: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

interface MemberSearchParams {
  organizationId: string;
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const organizationsApi = {
  /**
   * List organizations with filters
   */
  listOrganizations: async (params: OrganizationSearchParams): Promise<PaginatedResponse<Organization>> => {
    const response = await apiClient.get<PaginatedResponse<Organization>>(
      API_ENDPOINTS.ORGANIZATIONS,
      {
        params: {
          q: params.query,
          type: params.type,
          status: params.status,
          page: params.page ?? PAGINATION.DEFAULT_PAGE,
          limit: params.limit ?? PAGINATION.DEFAULT_LIMIT,
        },
      }
    );
    return response.data;
  },

  /**
   * Get organization by ID
   */
  getOrganization: async (id: string): Promise<Organization> => {
    const response = await apiClient.get<Organization>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}`
    );
    return response.data;
  },

  /**
   * Get organization members
   */
  getMembers: async (params: MemberSearchParams): Promise<PaginatedResponse<User & { membership: Membership }>> => {
    const response = await apiClient.get<PaginatedResponse<User & { membership: Membership }>>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${params.organizationId}/members`,
      {
        params: {
          q: params.query,
          status: params.status,
          page: params.page ?? PAGINATION.DEFAULT_PAGE,
          limit: params.limit ?? PAGINATION.DEFAULT_LIMIT,
        },
      }
    );
    return response.data;
  },

  /**
   * Export members to CSV
   */
  exportMembers: async (organizationId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `${API_ENDPOINTS.ORGANIZATIONS}/${organizationId}/members/export`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Get organization statistics
   */
  getStats: async (id: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    enrolledMembers: number;
    complianceRate: number;
  }> => {
    const response = await apiClient.get<{
      totalMembers: number;
      activeMembers: number;
      enrolledMembers: number;
      complianceRate: number;
    }>(`${API_ENDPOINTS.ORGANIZATIONS}/${id}/stats`);
    return response.data;
  },
};
