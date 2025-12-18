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

// Server response structure
interface ServerDashboardResponse {
  data: {
    enrollment: {
      totalUsers: number;
      activeUsers: number;
      newUsersToday: number;
      newUsersThisWeek: number;
      newUsersThisMonth: number;
      kycPending: number;
      kycApproved: number;
      kycRejected: number;
      byCounty: Array<{ countyCode: string; count: number }>;
    };
    payments: {
      totalTransactions: number;
      totalAmount: number;
      depositsToday: number;
      depositAmountToday: number;
      dailyPaymentsToday: number;
      dailyPaymentAmountToday: number;
      averagePaymentAmount: number;
      successRate: number;
      failedTransactions: number;
      pendingTransactions: number;
    };
    policies: {
      totalPolicies: number;
      activePolicies: number;
      expiringThisWeek: number;
      expiringThisMonth: number;
      issuedToday: number;
      issuedThisWeek: number;
      issuedThisMonth: number;
      lapsedPolicies: number;
      averageDaysToCompletion: number;
    };
    organizations: {
      totalOrganizations: number;
      activeOrganizations: number;
      totalMembers: number;
      topOrganizations: Array<{
        id: string;
        name: string;
        memberCount: number;
        policyCount: number;
      }>;
      byType: Record<string, number>;
    };
    lastUpdated: string;
  };
}

const TARGET_ENROLLMENT = 700000;

export const dashboardApi = {
  /**
   * Get dashboard overview metrics
   */
  getOverview: async (): Promise<DashboardOverview> => {
    const response = await apiClient.get<ServerDashboardResponse>(API_ENDPOINTS.DASHBOARD);
    const serverData = response.data.data;

    // Transform server response to client format
    const current = serverData.enrollment.totalUsers;
    const todayRevenue = serverData.payments.depositAmountToday + serverData.payments.dailyPaymentAmountToday;
    const todayTransactions = serverData.payments.depositsToday + serverData.payments.dailyPaymentsToday;

    return {
      enrollment: {
        current,
        target: TARGET_ENROLLMENT,
        progress: (current / TARGET_ENROLLMENT) * 100,
      },
      payments: {
        todayRevenue,
        todayTransactions,
        successRate: serverData.payments.successRate,
      },
      policies: {
        activePolicies: serverData.policies.activePolicies,
        expiringIn30Days: serverData.policies.expiringThisMonth,
      },
      atRiskUsers: serverData.policies.lapsedPolicies,
    };
  },

  /**
   * Get enrollment metrics
   */
  getEnrollmentMetrics: async (): Promise<EnrollmentMetrics> => {
    const response = await apiClient.get<{ data: ServerDashboardResponse['data']['enrollment'] }>(API_ENDPOINTS.DASHBOARD_ENROLLMENT);
    const serverData = response.data.data;

    // Transform to client format
    return {
      target: TARGET_ENROLLMENT,
      current: serverData.totalUsers,
      progress: (serverData.totalUsers / TARGET_ENROLLMENT) * 100,
      registered: serverData.totalUsers,
      kycComplete: serverData.kycApproved,
      depositPaid: serverData.activeUsers, // Users who have paid deposit
      newToday: serverData.newUsersToday,
      newThisWeek: serverData.newUsersThisWeek,
      newThisMonth: serverData.newUsersThisMonth,
    };
  },

  /**
   * Get payment metrics
   */
  getPaymentMetrics: async (): Promise<PaymentMetrics> => {
    const response = await apiClient.get<{ data: ServerDashboardResponse['data']['payments'] }>(API_ENDPOINTS.DASHBOARD_PAYMENTS);
    const serverData = response.data.data;

    // Transform to match what PaymentDashboard component expects
    return {
      todayRevenue: serverData.depositAmountToday + serverData.dailyPaymentAmountToday,
      todayTransactions: serverData.depositsToday + serverData.dailyPaymentsToday,
      successRate: serverData.successRate,
      deposits: serverData.depositsToday,
      dailyPayments: serverData.dailyPaymentsToday,
      complianceRate: serverData.successRate, // Using success rate as proxy for compliance
      atRiskUsers: serverData.failedTransactions, // Users with failed transactions
      // Also include original fields for flexibility
      totalTransactions: serverData.totalTransactions,
      totalAmount: serverData.totalAmount,
      averagePaymentAmount: serverData.averagePaymentAmount,
      failedTransactions: serverData.failedTransactions,
      pendingTransactions: serverData.pendingTransactions,
    };
  },

  /**
   * Get policy metrics
   */
  getPolicyMetrics: async (): Promise<PolicyMetrics> => {
    const response = await apiClient.get<{ data: ServerDashboardResponse['data']['policies'] }>(API_ENDPOINTS.DASHBOARD_POLICIES);
    const serverData = response.data.data;

    // Transform to match what PolicyDashboard component expects
    return {
      activePolicies: serverData.activePolicies,
      expiringIn30Days: serverData.expiringThisMonth,
      lapsedPolicies: serverData.lapsedPolicies,
      initialPolicies: serverData.issuedThisMonth, // Approximate: recent policies as initial
      extendedPolicies: serverData.activePolicies - serverData.issuedThisMonth, // Rest as extended
      // Additional fields from server
      totalPolicies: serverData.totalPolicies,
      expiringThisWeek: serverData.expiringThisWeek,
      expiringThisMonth: serverData.expiringThisMonth,
      issuedToday: serverData.issuedToday,
      issuedThisWeek: serverData.issuedThisWeek,
      issuedThisMonth: serverData.issuedThisMonth,
      averageDaysToCompletion: serverData.averageDaysToCompletion,
    };
  },

  /**
   * Get enrollment trend data
   */
  getEnrollmentTrend: async (days: number = 30): Promise<TrendData[]> => {
    const response = await apiClient.get<{ data: TrendData[] }>(`${API_ENDPOINTS.DASHBOARD}/charts/enrollment`, {
      params: { days },
    });
    return response.data.data;
  },

  /**
   * Get payment trend data
   */
  getPaymentTrend: async (days: number = 30): Promise<TrendData[]> => {
    const response = await apiClient.get<{ data: TrendData[] }>(`${API_ENDPOINTS.DASHBOARD}/charts/payments`, {
      params: { days },
    });
    return response.data.data;
  },
};
