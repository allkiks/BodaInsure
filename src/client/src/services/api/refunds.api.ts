import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';

/**
 * Refund status enum
 */
export type RefundStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * Refund payout method
 */
export type RefundPayoutMethod = 'MPESA' | 'WALLET' | 'BANK';

/**
 * Rider refund interface
 */
export interface RiderRefund {
  id: string;
  refundNumber: string;
  userId: string;
  policyId: string;
  refundAmountCents: number;
  reversalFeeCents: number;
  originalAmountCents: number;
  refundAmountKes: number;
  reversalFeeKes: number;
  originalAmountKes: number;
  daysPaid: number;
  status: RefundStatus;
  payoutMethod: RefundPayoutMethod;
  payoutPhone?: string;
  mpesaTransactionId?: string;
  mpesaConversationId?: string;
  cancellationReason?: string;
  journalEntryId?: string;
  approvedBy?: string;
  approvedAt?: string;
  processedBy?: string;
  processedAt?: string;
  completedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  policy?: {
    id: string;
    policyNumber?: string;
    policyType: string;
  };
}

/**
 * Refund statistics
 */
export interface RefundStats {
  pending: number;
  approved: number;
  processing: number;
  completed: number;
  failed: number;
  totalRefundedAmount: number;
  totalReversalFees: number;
}

export const refundsApi = {
  /**
   * Get all refunds with optional filtering
   */
  getRefunds: async (params?: {
    status?: RefundStatus;
    page?: number;
    limit?: number;
  }): Promise<{ refunds: RiderRefund[]; total: number }> => {
    const response = await apiClient.get<{
      data: RiderRefund[];
      total: number;
      page: number;
      limit: number;
    }>(API_ENDPOINTS.REFUNDS, { params });

    return {
      refunds: response.data.data,
      total: response.data.total,
    };
  },

  /**
   * Get pending refunds
   */
  getPendingRefunds: async (): Promise<RiderRefund[]> => {
    const response = await apiClient.get<{ data: RiderRefund[] }>(
      API_ENDPOINTS.REFUNDS_PENDING
    );
    return response.data.data;
  },

  /**
   * Get approved refunds (ready for payout)
   */
  getApprovedRefunds: async (): Promise<RiderRefund[]> => {
    const response = await apiClient.get<{ data: RiderRefund[] }>(
      API_ENDPOINTS.REFUNDS_APPROVED
    );
    return response.data.data;
  },

  /**
   * Get refund statistics
   */
  getStats: async (): Promise<RefundStats> => {
    const response = await apiClient.get<{ data: RefundStats }>(
      API_ENDPOINTS.REFUNDS_STATS
    );
    return response.data.data;
  },

  /**
   * Get refund by ID
   */
  getRefund: async (refundId: string): Promise<RiderRefund> => {
    const response = await apiClient.get<{ data: RiderRefund }>(
      `${API_ENDPOINTS.REFUNDS}/${refundId}`
    );
    return response.data.data;
  },

  /**
   * Approve a pending refund
   */
  approveRefund: async (refundId: string): Promise<RiderRefund> => {
    const response = await apiClient.post<{ data: RiderRefund; message: string }>(
      `${API_ENDPOINTS.REFUNDS}/${refundId}/approve`
    );
    return response.data.data;
  },

  /**
   * Process refund payout (initiate M-Pesa B2C)
   */
  processRefund: async (
    refundId: string,
    payoutPhone?: string
  ): Promise<RiderRefund> => {
    const response = await apiClient.post<{ data: RiderRefund; message: string }>(
      `${API_ENDPOINTS.REFUNDS}/${refundId}/process`,
      { payoutPhone }
    );
    return response.data.data;
  },

  /**
   * Mark refund as completed (after M-Pesa success)
   */
  completeRefund: async (
    refundId: string,
    mpesaTransactionId?: string
  ): Promise<RiderRefund> => {
    const response = await apiClient.post<{ data: RiderRefund; message: string }>(
      `${API_ENDPOINTS.REFUNDS}/${refundId}/complete`,
      { mpesaTransactionId }
    );
    return response.data.data;
  },

  /**
   * Mark refund as failed
   */
  failRefund: async (refundId: string, reason: string): Promise<RiderRefund> => {
    const response = await apiClient.post<{ data: RiderRefund; message: string }>(
      `${API_ENDPOINTS.REFUNDS}/${refundId}/fail`,
      { reason }
    );
    return response.data.data;
  },

  /**
   * Cancel a pending refund
   */
  cancelRefund: async (refundId: string, reason: string): Promise<RiderRefund> => {
    const response = await apiClient.post<{ data: RiderRefund; message: string }>(
      `${API_ENDPOINTS.REFUNDS}/${refundId}/cancel`,
      { reason }
    );
    return response.data.data;
  },
};
