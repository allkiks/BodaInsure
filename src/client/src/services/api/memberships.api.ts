import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type {
  Membership,
  CreateMembershipRequest,
  UpdateMembershipRequest,
  SuspendMembershipRequest,
  BulkAddMembersRequest,
  BulkAddMembersResponse,
} from '@/types';

/**
 * Memberships API Service
 * Provides CRUD operations for managing organization memberships
 */
export const membershipsApi = {
  /**
   * Create a new membership (add user to organization)
   */
  createMembership: async (data: CreateMembershipRequest): Promise<Membership> => {
    const response = await apiClient.post<{ data: Membership }>(
      API_ENDPOINTS.MEMBERSHIPS,
      data
    );
    return response.data.data;
  },

  /**
   * Get membership by ID
   */
  getMembership: async (id: string): Promise<Membership> => {
    const response = await apiClient.get<{ data: Membership }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/${id}`
    );
    return response.data.data;
  },

  /**
   * Update membership details
   */
  updateMembership: async (id: string, data: UpdateMembershipRequest): Promise<Membership> => {
    const response = await apiClient.put<{ data: Membership }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/${id}`,
      data
    );
    return response.data.data;
  },

  /**
   * Approve a pending membership
   * Sets status from PENDING to ACTIVE
   */
  approveMembership: async (id: string, approvedBy: string): Promise<Membership> => {
    const response = await apiClient.post<{ data: Membership }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/${id}/approve`,
      { approvedBy }
    );
    return response.data.data;
  },

  /**
   * Suspend a membership
   * Sets status to SUSPENDED with optional reason
   */
  suspendMembership: async (
    id: string,
    suspendedBy: string,
    data?: SuspendMembershipRequest
  ): Promise<Membership> => {
    const response = await apiClient.post<{ data: Membership }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/${id}/suspend`,
      { suspendedBy, ...data }
    );
    return response.data.data;
  },

  /**
   * Reactivate a suspended membership
   * Sets status back to ACTIVE
   */
  reactivateMembership: async (id: string): Promise<Membership> => {
    const response = await apiClient.post<{ data: Membership }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/${id}/reactivate`
    );
    return response.data.data;
  },

  /**
   * Revoke/delete a membership
   * Sets status to REVOKED (soft delete)
   */
  revokeMembership: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.MEMBERSHIPS}/${id}`);
  },

  /**
   * Get all memberships for a user
   */
  getUserMemberships: async (userId: string): Promise<Membership[]> => {
    const response = await apiClient.get<{ data: Membership[] }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/user/${userId}`
    );
    return response.data.data;
  },

  /**
   * Get user's primary membership
   */
  getPrimaryMembership: async (userId: string): Promise<Membership | null> => {
    const response = await apiClient.get<{ data: Membership | null }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/user/${userId}/primary`
    );
    return response.data.data;
  },

  /**
   * Set a membership as the user's primary organization
   */
  setPrimaryMembership: async (userId: string, membershipId: string): Promise<Membership> => {
    const response = await apiClient.post<{ data: Membership }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/user/${userId}/primary/${membershipId}`
    );
    return response.data.data;
  },

  /**
   * Check if user is a member of an organization
   */
  checkMembership: async (
    userId: string,
    organizationId: string
  ): Promise<{ isMember: boolean; isAdmin: boolean }> => {
    const response = await apiClient.get<{ data: { isMember: boolean; isAdmin: boolean } }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/check/${userId}/${organizationId}`
    );
    return response.data.data;
  },

  /**
   * Bulk add existing users to an organization
   */
  bulkAddMembers: async (
    organizationId: string,
    data: BulkAddMembersRequest
  ): Promise<BulkAddMembersResponse> => {
    const response = await apiClient.post<{ data: BulkAddMembersResponse }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/organization/${organizationId}/bulk`,
      data
    );
    return response.data.data;
  },

  /**
   * Get member count for an organization
   */
  getMemberCount: async (organizationId: string): Promise<number> => {
    const response = await apiClient.get<{ data: { count: number } }>(
      `${API_ENDPOINTS.MEMBERSHIPS}/organization/${organizationId}/count`
    );
    return response.data.data.count;
  },
};
