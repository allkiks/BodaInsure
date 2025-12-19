import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { Wallet, Payment, PaginatedResponse } from '@/types';

export interface WalletResponse {
  wallet: Wallet;
  recentTransactions: Payment[];
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: 'deposit' | 'daily' | 'bulk';
  status?: 'pending' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
}

export const walletApi = {
  /**
   * Get current user's wallet balance and summary
   */
  getWallet: async (): Promise<WalletResponse> => {
    const response = await apiClient.get<{ data: WalletResponse }>(API_ENDPOINTS.WALLET);
    return response.data.data;
  },

  /**
   * Get wallet transaction history
   */
  getTransactions: async (filters?: TransactionFilters): Promise<PaginatedResponse<Payment>> => {
    const response = await apiClient.get<{ data: PaginatedResponse<Payment> }>(
      API_ENDPOINTS.WALLET_TRANSACTIONS,
      { params: filters }
    );
    return response.data.data;
  },

  /**
   * Get wallet for a specific user (admin only)
   */
  getWalletByUserId: async (userId: string): Promise<WalletResponse> => {
    const response = await apiClient.get<{ data: WalletResponse }>(
      `${API_ENDPOINTS.ADMIN_USER_BY_ID}/${userId}/wallet`
    );
    return response.data.data;
  },
};
