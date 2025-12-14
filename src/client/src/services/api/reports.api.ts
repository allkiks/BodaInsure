import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { ReportDefinition, GeneratedReport, PaginatedResponse } from '@/types';

interface GenerateReportParams {
  definitionId: string;
  startDate: string;
  endDate: string;
  format: 'csv' | 'xlsx';
  filters?: Record<string, string>;
}

export const reportsApi = {
  /**
   * List available report definitions
   */
  getDefinitions: async (): Promise<ReportDefinition[]> => {
    const response = await apiClient.get<ReportDefinition[]>(
      API_ENDPOINTS.REPORT_DEFINITIONS
    );
    return response.data;
  },

  /**
   * Generate a new report
   */
  generateReport: async (params: GenerateReportParams): Promise<GeneratedReport> => {
    const response = await apiClient.post<GeneratedReport>(
      API_ENDPOINTS.REPORT_GENERATE,
      params
    );
    return response.data;
  },

  /**
   * Get generated reports history
   */
  getGeneratedReports: async (page = 1, limit = 20): Promise<PaginatedResponse<GeneratedReport>> => {
    const response = await apiClient.get<PaginatedResponse<GeneratedReport>>(
      API_ENDPOINTS.REPORTS,
      { params: { page, limit } }
    );
    return response.data;
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
