import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { DashboardMetrics, EnrollmentMetrics, PaymentMetrics, PolicyMetrics, TrendData } from '@/types';

interface DashboardOverview {
  enrollment: {
    current: number;
    target: number;
    progress: number;
  };
  payments: {
    todayRevenue: number;
    todayTransactions: number;
    successRate: number;
  };
  policies: {
    activePolicies: number;
    expiringIn30Days: number;
  };
  atRiskUsers: number;
}

export const dashboardApi = {
  /**
   * Get dashboard overview metrics
   */
  getOverview: async (): Promise<DashboardOverview> => {
    const response = await apiClient.get<DashboardOverview>(API_ENDPOINTS.DASHBOARD);
    return response.data;
  },

  /**
   * Get enrollment metrics
   */
  getEnrollmentMetrics: async (): Promise<EnrollmentMetrics> => {
    const response = await apiClient.get<EnrollmentMetrics>(API_ENDPOINTS.DASHBOARD_ENROLLMENT);
    return response.data;
  },

  /**
   * Get payment metrics
   */
  getPaymentMetrics: async (): Promise<PaymentMetrics> => {
    const response = await apiClient.get<PaymentMetrics>(API_ENDPOINTS.DASHBOARD_PAYMENTS);
    return response.data;
  },

  /**
   * Get policy metrics
   */
  getPolicyMetrics: async (): Promise<PolicyMetrics> => {
    const response = await apiClient.get<PolicyMetrics>(API_ENDPOINTS.DASHBOARD_POLICIES);
    return response.data;
  },

  /**
   * Get enrollment trend data
   */
  getEnrollmentTrend: async (days: number = 30): Promise<TrendData[]> => {
    const response = await apiClient.get<TrendData[]>(`${API_ENDPOINTS.DASHBOARD}/charts/enrollment-trend`, {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get payment trend data
   */
  getPaymentTrend: async (days: number = 30): Promise<TrendData[]> => {
    const response = await apiClient.get<TrendData[]>(`${API_ENDPOINTS.DASHBOARD}/charts/payment-trend`, {
      params: { days },
    });
    return response.data;
  },
};
