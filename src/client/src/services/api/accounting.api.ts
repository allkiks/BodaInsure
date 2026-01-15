import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type {
  GlAccount,
  TrialBalance,
  PartnerSettlement,
  ReconciliationRecord,
  ReconciliationItem,
  AccountingDashboardSummary,
  BalanceSheetReport,
  IncomeStatementReport,
  PartnerStatementReport,
  PartnerType,
  PaginatedResponse,
} from '@/types';

interface ApproveSettlementParams {
  settlementId: string;
}

interface ProcessSettlementParams {
  settlementId: string;
  bankReference: string;
}

interface MatchReconciliationItemParams {
  reconciliationId: string;
  itemId: string;
  targetReference: string;
}

interface ResolveReconciliationItemParams {
  reconciliationId: string;
  itemId: string;
  resolution: string;
}

export const accountingApi = {
  // GL Accounts
  /**
   * Get all GL accounts
   */
  getGlAccounts: async (): Promise<GlAccount[]> => {
    const response = await apiClient.get<{ data: GlAccount[] }>(
      API_ENDPOINTS.ACCOUNTING_GL_ACCOUNTS
    );
    return response.data.data;
  },

  /**
   * Get GL account by ID
   */
  getGlAccount: async (id: string): Promise<GlAccount> => {
    const response = await apiClient.get<{ data: GlAccount }>(
      `${API_ENDPOINTS.ACCOUNTING_GL_ACCOUNTS}/${id}`
    );
    return response.data.data;
  },

  /**
   * Get trial balance
   */
  getTrialBalance: async (asOfDate?: string): Promise<TrialBalance> => {
    const params = asOfDate ? { asOfDate } : {};
    const response = await apiClient.get<{ data: TrialBalance }>(
      API_ENDPOINTS.ACCOUNTING_TRIAL_BALANCE,
      { params }
    );
    return response.data.data;
  },

  // Settlements
  /**
   * Get all settlements with optional filtering
   */
  getSettlements: async (params?: {
    partnerType?: PartnerType;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PartnerSettlement>> => {
    const response = await apiClient.get<{
      data: {
        settlements: PartnerSettlement[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(API_ENDPOINTS.ACCOUNTING_SETTLEMENTS, { params });

    const { settlements, total, page = 1, limit = 20, totalPages } = response.data.data;
    return {
      data: settlements,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  /**
   * Get pending settlements
   */
  getPendingSettlements: async (): Promise<PartnerSettlement[]> => {
    const response = await apiClient.get<{ data: PartnerSettlement[] }>(
      API_ENDPOINTS.ACCOUNTING_SETTLEMENTS_PENDING
    );
    return response.data.data;
  },

  /**
   * Get settlement by ID
   */
  getSettlement: async (id: string): Promise<PartnerSettlement> => {
    const response = await apiClient.get<{ data: PartnerSettlement }>(
      `${API_ENDPOINTS.ACCOUNTING_SETTLEMENTS}/${id}`
    );
    return response.data.data;
  },

  /**
   * Approve a settlement
   */
  approveSettlement: async (params: ApproveSettlementParams): Promise<PartnerSettlement> => {
    const response = await apiClient.post<{ data: PartnerSettlement }>(
      `${API_ENDPOINTS.ACCOUNTING_SETTLEMENTS}/${params.settlementId}/approve`
    );
    return response.data.data;
  },

  /**
   * Process a settlement (mark as paid)
   */
  processSettlement: async (params: ProcessSettlementParams): Promise<PartnerSettlement> => {
    const response = await apiClient.post<{ data: PartnerSettlement }>(
      `${API_ENDPOINTS.ACCOUNTING_SETTLEMENTS}/${params.settlementId}/process`,
      { bankReference: params.bankReference }
    );
    return response.data.data;
  },

  // Reconciliations
  /**
   * Get all reconciliation records
   */
  getReconciliations: async (params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ReconciliationRecord>> => {
    // Default to last 30 days if no dates provided
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const queryParams = {
      startDate: params?.startDate ?? thirtyDaysAgo.toISOString().split('T')[0],
      endDate: params?.endDate ?? today.toISOString().split('T')[0],
      ...params,
    };

    const response = await apiClient.get<{ data: ReconciliationRecord[] | { reconciliations: ReconciliationRecord[]; total: number; page: number; limit: number; totalPages: number } }>(
      API_ENDPOINTS.ACCOUNTING_RECONCILIATIONS,
      { params: queryParams }
    );

    // Handle both array response and paginated response
    const responseData = response.data.data;
    if (Array.isArray(responseData)) {
      return {
        data: responseData,
        meta: {
          total: responseData.length,
          page: 1,
          limit: responseData.length,
          totalPages: 1,
        },
      };
    }

    const { reconciliations, total, page = 1, limit = 20, totalPages } = responseData;
    return {
      data: reconciliations,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  /**
   * Get reconciliation by ID with items
   */
  getReconciliation: async (id: string): Promise<ReconciliationRecord & { items: ReconciliationItem[] }> => {
    const response = await apiClient.get<{ data: ReconciliationRecord & { items: ReconciliationItem[] } }>(
      `${API_ENDPOINTS.ACCOUNTING_RECONCILIATIONS}/${id}`
    );
    return response.data.data;
  },

  /**
   * Manually match a reconciliation item
   */
  matchReconciliationItem: async (params: MatchReconciliationItemParams): Promise<ReconciliationItem> => {
    const response = await apiClient.post<{ data: ReconciliationItem }>(
      `${API_ENDPOINTS.ACCOUNTING_RECONCILIATIONS}/${params.reconciliationId}/items/${params.itemId}/match`,
      { targetReference: params.targetReference }
    );
    return response.data.data;
  },

  /**
   * Resolve an unmatched reconciliation item
   */
  resolveReconciliationItem: async (params: ResolveReconciliationItemParams): Promise<ReconciliationItem> => {
    const response = await apiClient.post<{ data: ReconciliationItem }>(
      `${API_ENDPOINTS.ACCOUNTING_RECONCILIATIONS}/${params.reconciliationId}/items/${params.itemId}/resolve`,
      { resolution: params.resolution }
    );
    return response.data.data;
  },

  // Reports
  /**
   * Get accounting dashboard summary
   */
  getDashboardSummary: async (): Promise<AccountingDashboardSummary> => {
    const response = await apiClient.get<{ data: AccountingDashboardSummary }>(
      API_ENDPOINTS.ACCOUNTING_REPORTS_DASHBOARD
    );
    return response.data.data;
  },

  /**
   * Get balance sheet report
   */
  getBalanceSheet: async (asOfDate?: string): Promise<BalanceSheetReport> => {
    const params = asOfDate ? { asOfDate } : {};
    const response = await apiClient.get<{ data: BalanceSheetReport }>(
      API_ENDPOINTS.ACCOUNTING_REPORTS_BALANCE_SHEET,
      { params }
    );
    return response.data.data;
  },

  /**
   * Get income statement report
   */
  getIncomeStatement: async (startDate: string, endDate: string): Promise<IncomeStatementReport> => {
    const response = await apiClient.get<{ data: IncomeStatementReport }>(
      API_ENDPOINTS.ACCOUNTING_REPORTS_INCOME_STATEMENT,
      { params: { periodStart: startDate, periodEnd: endDate } }
    );
    return response.data.data;
  },

  /**
   * Get partner statement report
   */
  getPartnerStatement: async (
    partnerType: PartnerType,
    startDate: string,
    endDate: string
  ): Promise<PartnerStatementReport> => {
    // partnerType is a path parameter, not a query parameter
    const response = await apiClient.get<{ data: PartnerStatementReport }>(
      `${API_ENDPOINTS.ACCOUNTING_REPORTS_PARTNER_STATEMENT}/${partnerType}`,
      { params: { periodStart: startDate, periodEnd: endDate } }
    );
    return response.data.data;
  },
};
