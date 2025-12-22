import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type {
  Organization,
  Membership,
  PaginatedResponse,
  User,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
} from '@/types';

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

// Server response shape for organization list
interface ServerOrganizationListResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const organizationsApi = {
  /**
   * List organizations with filters
   */
  listOrganizations: async (params: OrganizationSearchParams): Promise<PaginatedResponse<Organization>> => {
    const page = params.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = params.limit ?? PAGINATION.DEFAULT_LIMIT;

    const response = await apiClient.get<{ data: ServerOrganizationListResponse }>(
      API_ENDPOINTS.ORGANIZATIONS,
      {
        params: {
          q: params.query,
          type: params.type,
          status: params.status,
          page,
          limit,
        },
      }
    );

    // Transform server response to PaginatedResponse format
    const serverData = response.data.data;
    return {
      data: serverData.organizations,
      meta: {
        total: serverData.total,
        page: serverData.page,
        limit: serverData.limit,
        totalPages: serverData.totalPages,
      },
    };
  },

  /**
   * Get organization by ID
   */
  getOrganization: async (id: string): Promise<Organization> => {
    const response = await apiClient.get<{ data: Organization }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}`
    );
    return response.data.data;
  },

  /**
   * Create a new organization
   */
  createOrganization: async (data: CreateOrganizationRequest): Promise<Organization> => {
    const response = await apiClient.post<{ data: Organization }>(
      API_ENDPOINTS.ORGANIZATIONS,
      data
    );
    return response.data.data;
  },

  /**
   * Update an organization
   */
  updateOrganization: async (id: string, data: UpdateOrganizationRequest): Promise<Organization> => {
    const response = await apiClient.put<{ data: Organization }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete an organization (soft delete)
   */
  deleteOrganization: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.ORGANIZATIONS}/${id}`);
  },

  /**
   * Verify an organization
   */
  verifyOrganization: async (id: string): Promise<Organization> => {
    const response = await apiClient.post<{ data: Organization }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}/verify`
    );
    return response.data.data;
  },

  /**
   * Suspend an organization
   */
  suspendOrganization: async (id: string, reason?: string): Promise<Organization> => {
    const response = await apiClient.post<{ data: Organization }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}/suspend`,
      { reason }
    );
    return response.data.data;
  },

  /**
   * Reactivate an organization
   */
  reactivateOrganization: async (id: string): Promise<Organization> => {
    const response = await apiClient.post<{ data: Organization }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}/reactivate`
    );
    return response.data.data;
  },

  /**
   * Get umbrella bodies
   */
  getUmbrellaBodies: async (): Promise<Organization[]> => {
    const response = await apiClient.get<{ data: Organization[] }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/hierarchy/umbrella-bodies`
    );
    return response.data.data;
  },

  /**
   * Get SACCOs (organizations with parentId - children of umbrella bodies)
   * Used for rider registration organization selection
   * Fetches all pages to ensure all SACCOs are returned
   */
  getSaccos: async (): Promise<Organization[]> => {
    const allSaccos: Organization[] = [];
    let page = 1;
    const limit = 100; // Max allowed by server
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.get<{ data: ServerOrganizationListResponse }>(
        API_ENDPOINTS.ORGANIZATIONS,
        {
          params: {
            type: 'SACCO',
            status: 'ACTIVE',
            limit,
            page,
          },
        }
      );
      const data = response.data.data;
      allSaccos.push(...data.organizations);
      hasMore = page < data.totalPages;
      page++;
    }

    return allSaccos;
  },

  /**
   * Get SACCOs under a specific umbrella body (for KBA_admin)
   */
  getSaccosByParent: async (parentId: string): Promise<Organization[]> => {
    const response = await apiClient.get<{ data: Organization[] }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${parentId}/children`
    );
    // Filter to only include active SACCOs
    return response.data.data.filter(org => org.status === 'ACTIVE');
  },

  /**
   * Get organization children
   */
  getChildren: async (id: string): Promise<Organization[]> => {
    const response = await apiClient.get<{ data: Organization[] }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${id}/children`
    );
    return response.data.data;
  },

  /**
   * Get organization members
   */
  getMembers: async (params: MemberSearchParams): Promise<PaginatedResponse<User & { membership: Membership }>> => {
    const page = params.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = params.limit ?? PAGINATION.DEFAULT_LIMIT;

    // API returns: { id, userId, role, status, memberNumber, joinedAt, user: { id, phone, fullName, kycStatus } }
    // Frontend expects: { id, phone, fullName, membership: { id, memberNumber, status, role, joinedAt } }
    interface ApiMemberResponse {
      id: string;
      userId: string;
      role: string;
      status: string;
      memberNumber: string | null;
      joinedAt: string | null;
      user: {
        id: string;
        phone: string;
        fullName: string | null;
        kycStatus: string;
      };
    }

    const response = await apiClient.get<{ data: { members: ApiMemberResponse[]; total: number } }>(
      `${API_ENDPOINTS.ORGANIZATIONS}/${params.organizationId}/members`,
      {
        params: {
          q: params.query,
          status: params.status,
          page,
          limit,
        },
      }
    );

    const { members: rawMembers, total } = response.data.data;

    // Transform API response to frontend expected format
    const members = rawMembers.map((m) => {
      // Split fullName into firstName and lastName
      const nameParts = (m.user.fullName || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: m.user.id,
        phone: m.user.phone,
        fullName: m.user.fullName,
        firstName,
        lastName,
        kycStatus: m.user.kycStatus,
        membership: {
          id: m.id,
          memberNumber: m.memberNumber,
          status: m.status,
          role: m.role,
          joinedAt: m.joinedAt,
        },
      } as User & { membership: Membership };
    });

    return {
      data: members,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    const response = await apiClient.get<{ data: {
      totalMembers: number;
      activeMembers: number;
      enrolledMembers: number;
      complianceRate: number;
    } }>(`${API_ENDPOINTS.ORGANIZATIONS}/${id}/stats`);
    return response.data.data;
  },

  /**
   * Get organization overview statistics (global)
   */
  getOverviewStats: async (): Promise<{
    totalOrganizations: number;
    totalSaccos: number;
    totalUmbrellaBodies: number;
    activeOrganizations: number;
  }> => {
    const response = await apiClient.get<{ data: {
      totalOrganizations: number;
      totalSaccos: number;
      totalUmbrellaBodies: number;
      activeOrganizations: number;
    } }>(`${API_ENDPOINTS.ORGANIZATIONS}/stats/overview`);
    return response.data.data;
  },
};
