import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { User, Language } from '@/types';

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  language?: Language;
}

export interface DeleteAccountRequest {
  reason: string;
}

export interface DeleteAccountResponse {
  message: string;
  scheduledDeletionDate: string;
}

export const userApi = {
  /**
   * Get current user's profile
   */
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<{ data: User }>(API_ENDPOINTS.USER_PROFILE);
    return response.data.data;
  },

  /**
   * Update current user's profile
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.patch<{ data: User }>(
      API_ENDPOINTS.USER_UPDATE_PROFILE,
      data
    );
    return response.data.data;
  },

  /**
   * Request account deletion
   */
  requestAccountDeletion: async (data: DeleteAccountRequest): Promise<DeleteAccountResponse> => {
    const response = await apiClient.post<{ data: DeleteAccountResponse }>(
      API_ENDPOINTS.USER_DELETE_ACCOUNT,
      data
    );
    return response.data.data;
  },

  /**
   * Cancel account deletion request
   */
  cancelAccountDeletion: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ data: { message: string } }>(
      API_ENDPOINTS.USER_DELETE_ACCOUNT
    );
    return response.data.data;
  },

  /**
   * Update language preference
   */
  updateLanguage: async (language: Language): Promise<User> => {
    const response = await apiClient.patch<{ data: User }>(
      API_ENDPOINTS.USER_UPDATE_PROFILE,
      { language }
    );
    return response.data.data;
  },
};
