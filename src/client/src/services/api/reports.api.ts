import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { ReportDefinition, GeneratedReport, PaginatedResponse, ReportFormat } from '@/types';

interface GenerateReportParams {
  definitionId: string;
  startDate: string;
  endDate: string;
  format: ReportFormat;
  filters?: Record<string, string>;
}

export const reportsApi = {
  /**
   * List available report definitions
   */
  getDefinitions: async (): Promise<ReportDefinition[]> => {
    const response = await apiClient.get<{ data: ReportDefinition[] }>(
      API_ENDPOINTS.REPORT_DEFINITIONS
    );
    return response.data.data;
  },

  /**
   * Generate a new report
   */
  generateReport: async (params: GenerateReportParams): Promise<GeneratedReport> => {
    // Transform to match server DTO expectations
    const payload = {
      reportDefinitionId: params.definitionId,
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format,
      parameters: params.filters,
    };
    const response = await apiClient.post<GeneratedReport>(
      API_ENDPOINTS.REPORT_GENERATE,
      payload
    );
    return response.data;
  },

  /**
   * Get generated reports history
   */
  getGeneratedReports: async (page = 1, limit = 20): Promise<PaginatedResponse<GeneratedReport>> => {
    const response = await apiClient.get<{
      data: {
        reports: GeneratedReport[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(API_ENDPOINTS.REPORTS, { params: { page, limit } });

    const { reports, total, totalPages } = response.data.data;
    return {
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  /**
   * Get report by ID
   */
  getReport: async (id: string): Promise<GeneratedReport> => {
    const response = await apiClient.get<GeneratedReport>(
      `${API_ENDPOINTS.REPORTS}/${id}`
    );
    return response.data;
  },

  /**
   * Download report file
   */
  downloadReport: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(
      `${API_ENDPOINTS.REPORTS}/${id}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};
