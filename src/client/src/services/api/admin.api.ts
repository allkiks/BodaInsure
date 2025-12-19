import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type { User, PaginatedResponse, Payment, Policy, KycDocument } from '@/types';

interface UserSearchParams {
  query?: string;
  page?: number;
  limit?: number;
}

interface UserWithDetails extends User {
  wallet?: {
    balance: number;
    daysCompleted: number;
  };
  policies?: Policy[];
  payments?: Payment[];
  kycDocuments?: KycDocument[];
}

// Server response shape for user search
interface ServerUserSearchResponse {
  users: User[];
  total: number;
}

export const adminApi = {
  /**
   * Search users by phone, name, ID, or policy number
   */
  searchUsers: async (params: UserSearchParams): Promise<PaginatedResponse<User>> => {
    const page = params.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = params.limit ?? PAGINATION.DEFAULT_LIMIT;

    const response = await apiClient.get<{ data: ServerUserSearchResponse }>(
      API_ENDPOINTS.ADMIN_USERS_SEARCH,
      {
        params: {
          q: params.query,
          page,
          limit,
        },
      }
    );

    // Transform server response to PaginatedResponse format
    const { users, total } = response.data.data;
    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get user by ID with full details
   */
  getUserById: async (id: string): Promise<UserWithDetails> => {
    const response = await apiClient.get<{ data: UserWithDetails }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${id}`
    );
    return response.data.data;
  },

  /**
   * Get user by phone number
   */
  getUserByPhone: async (phone: string): Promise<User> => {
    const response = await apiClient.get<{ data: User }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_PHONE}/${phone}`
    );
    return response.data.data;
  },

  /**
   * Resend OTP to user
   */
  resendOtp: async (userId: string): Promise<void> => {
    await apiClient.post(`${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/resend-otp`);
  },

  /**
   * Reset user's KYC status
   */
  resetKyc: async (userId: string): Promise<void> => {
    await apiClient.post(`${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/reset-kyc`);
  },

  /**
   * Activate user account
   */
  activateUser: async (userId: string): Promise<void> => {
    await apiClient.post(`${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/activate`);
  },

  /**
   * Deactivate user account
   */
  deactivateUser: async (userId: string): Promise<void> => {
    await apiClient.post(`${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/deactivate`);
  },

  /**
   * Get user's payment history
   */
  getUserPayments: async (userId: string, page = 1, limit = 20): Promise<PaginatedResponse<Payment>> => {
    const response = await apiClient.get<{ data: { payments: Payment[]; total: number } }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/payments`,
      { params: { page, limit } }
    );
    const { payments, total } = response.data.data;
    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get user's policies
   */
  getUserPolicies: async (userId: string): Promise<Policy[]> => {
    const response = await apiClient.get<{ data: Policy[] }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/policies`
    );
    return response.data.data;
  },

  /**
   * Get user's KYC documents
   */
  getUserKycDocuments: async (userId: string): Promise<KycDocument[]> => {
    const response = await apiClient.get<{ data: KycDocument[] }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/kyc-documents`
    );
    return response.data.data;
  },
};
