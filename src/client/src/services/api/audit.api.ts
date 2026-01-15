import { apiClient } from './client';

export interface AuditEvent {
  id: string;
  eventType: string;
  userId?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  outcome: string;
  channel?: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface AuditQueryParams {
  eventType?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  outcome?: 'success' | 'failure';
  page?: number;
  limit?: number;
}

export interface AuditQueryResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  eventsByDay: { date: string; count: number }[];
  topUsers: { userId: string; count: number }[];
}

export const auditApi = {
  /**
   * Query audit events with filters
   */
  async queryEvents(params: AuditQueryParams): Promise<AuditQueryResponse> {
    const queryParams = new URLSearchParams();
    if (params.eventType) queryParams.append('eventType', params.eventType);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.entityType) queryParams.append('entityType', params.entityType);
    if (params.entityId) queryParams.append('entityId', params.entityId);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.outcome) queryParams.append('outcome', params.outcome);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const response = await apiClient.get(`/audit?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get audit statistics
   */
  async getStats(days?: number): Promise<AuditStats> {
    const params = days ? `?days=${days}` : '';
    const response = await apiClient.get(`/audit/stats${params}`);
    return response.data;
  },

  /**
   * Get user audit trail
   */
  async getUserAuditTrail(userId: string, page = 1, limit = 50): Promise<AuditQueryResponse> {
    const response = await apiClient.get(`/audit/users/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  /**
   * Get entity audit trail
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    page = 1,
    limit = 50,
  ): Promise<AuditQueryResponse> {
    const response = await apiClient.get(
      `/audit/entities/${entityType}/${entityId}?page=${page}&limit=${limit}`,
    );
    return response.data;
  },

  /**
   * Get all event types
   */
  async getEventTypes(): Promise<string[]> {
    const response = await apiClient.get('/audit/event-types');
    return response.data;
  },
};
