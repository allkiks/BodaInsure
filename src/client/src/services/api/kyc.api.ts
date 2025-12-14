import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type { KycDocument, PaginatedResponse, User } from '@/types';

interface KycQueueParams {
  status?: string;
  page?: number;
  limit?: number;
}

interface KycDocumentWithUser extends KycDocument {
  user: Pick<User, 'id' | 'phone' | 'firstName' | 'lastName'>;
}

export const kycApi = {
  /**
   * Get pending KYC documents queue
   */
  getPendingQueue: async (params: KycQueueParams): Promise<PaginatedResponse<KycDocumentWithUser>> => {
    const response = await apiClient.get<PaginatedResponse<KycDocumentWithUser>>(
      API_ENDPOINTS.KYC_PENDING,
      {
        params: {
          status: params.status ?? 'pending',
          page: params.page ?? PAGINATION.DEFAULT_PAGE,
          limit: params.limit ?? PAGINATION.DEFAULT_LIMIT,
        },
      }
    );
    return response.data;
  },

  /**
   * Get document by ID
   */
  getDocument: async (id: string): Promise<KycDocumentWithUser> => {
    const response = await apiClient.get<KycDocumentWithUser>(
      `${API_ENDPOINTS.KYC_DOCUMENTS}/${id}`
    );
    return response.data;
  },

  /**
   * Get signed URL for document viewing
   */
  getDocumentUrl: async (id: string): Promise<{ url: string; expiresAt: string }> => {
    const response = await apiClient.get<{ url: string; expiresAt: string }>(
      `${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/url`
    );
    return response.data;
  },

  /**
   * Approve KYC document
   */
  approveDocument: async (id: string): Promise<void> => {
    await apiClient.post(`${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/approve`);
  },

  /**
   * Reject KYC document
   */
  rejectDocument: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/reject`, { reason });
  },

  /**
   * Get queue statistics
   */
  getQueueStats: async (): Promise<{
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    averageProcessingTime: number;
  }> => {
    const response = await apiClient.get<{
      pending: number;
      approvedToday: number;
      rejectedToday: number;
      averageProcessingTime: number;
    }>(`${API_ENDPOINTS.KYC_PENDING}/stats`);
    return response.data;
  },
};
