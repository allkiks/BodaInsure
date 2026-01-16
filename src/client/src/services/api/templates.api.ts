import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type {
  NotificationTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplatePreview,
  PaginatedResponse,
  NotificationChannel,
  NotificationType,
  TemplateStatus,
  EnumOption,
} from '@/types';

interface TemplateQueryParams {
  channel?: NotificationChannel;
  notificationType?: NotificationType;
  status?: TemplateStatus;
  search?: string;
  page?: number;
  limit?: number;
}

interface GroupedTemplates {
  SMS: NotificationTemplate[];
  EMAIL: NotificationTemplate[];
  WHATSAPP: NotificationTemplate[];
  PUSH: NotificationTemplate[];
}

export const templatesApi = {
  /**
   * List templates with filtering and pagination
   */
  list: async (params: TemplateQueryParams = {}): Promise<PaginatedResponse<NotificationTemplate>> => {
    const page = params.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = params.limit ?? PAGINATION.DEFAULT_LIMIT;

    const response = await apiClient.get<{
      data: NotificationTemplate[];
      meta: { total: number; page: number; totalPages: number };
    }>(API_ENDPOINTS.TEMPLATES, {
      params: {
        channel: params.channel,
        notificationType: params.notificationType,
        status: params.status,
        search: params.search,
        page,
        limit,
      },
    });

    return {
      data: response.data.data,
      meta: {
        total: response.data.meta.total,
        page: response.data.meta.page,
        limit,
        totalPages: response.data.meta.totalPages,
      },
    };
  },

  /**
   * Get templates grouped by channel
   */
  getGrouped: async (): Promise<GroupedTemplates> => {
    const response = await apiClient.get<{ data: GroupedTemplates }>(
      API_ENDPOINTS.TEMPLATES_GROUPED
    );
    return response.data.data;
  },

  /**
   * Get a single template by ID
   */
  getById: async (id: string): Promise<NotificationTemplate> => {
    const response = await apiClient.get<{ data: NotificationTemplate }>(
      `${API_ENDPOINTS.TEMPLATES}/${id}`
    );
    return response.data.data;
  },

  /**
   * Create a new template
   */
  create: async (dto: CreateTemplateRequest): Promise<NotificationTemplate> => {
    const response = await apiClient.post<{ data: NotificationTemplate }>(
      API_ENDPOINTS.TEMPLATES,
      dto
    );
    return response.data.data;
  },

  /**
   * Update an existing template
   */
  update: async (id: string, dto: UpdateTemplateRequest): Promise<NotificationTemplate> => {
    const response = await apiClient.put<{ data: NotificationTemplate }>(
      `${API_ENDPOINTS.TEMPLATES}/${id}`,
      dto
    );
    return response.data.data;
  },

  /**
   * Delete (archive) a template
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.TEMPLATES}/${id}`);
  },

  /**
   * Duplicate a template with a new code
   */
  duplicate: async (id: string, newCode: string): Promise<NotificationTemplate> => {
    const response = await apiClient.post<{ data: NotificationTemplate }>(
      `${API_ENDPOINTS.TEMPLATES}/${id}/duplicate`,
      { code: newCode }
    );
    return response.data.data;
  },

  /**
   * Preview a template with sample data
   */
  preview: async (
    id: string,
    variables: Record<string, string | number>
  ): Promise<TemplatePreview> => {
    const response = await apiClient.post<{ data: TemplatePreview }>(
      `${API_ENDPOINTS.TEMPLATES}/${id}/preview`,
      { variables }
    );
    return response.data.data;
  },

  /**
   * Seed default templates
   */
  seedDefaults: async (): Promise<number> => {
    const response = await apiClient.post<{ data: { seededCount: number } }>(
      API_ENDPOINTS.TEMPLATES_SEED
    );
    return response.data.data.seededCount;
  },

  /**
   * Get available notification channels
   */
  getChannels: async (): Promise<EnumOption[]> => {
    const response = await apiClient.get<{ data: EnumOption[] }>(
      API_ENDPOINTS.TEMPLATES_ENUM_CHANNELS
    );
    return response.data.data;
  },

  /**
   * Get available notification types
   */
  getTypes: async (): Promise<EnumOption[]> => {
    const response = await apiClient.get<{ data: EnumOption[] }>(
      API_ENDPOINTS.TEMPLATES_ENUM_TYPES
    );
    return response.data.data;
  },

  /**
   * Get available template statuses
   */
  getStatuses: async (): Promise<EnumOption[]> => {
    const response = await apiClient.get<{ data: EnumOption[] }>(
      API_ENDPOINTS.TEMPLATES_ENUM_STATUSES
    );
    return response.data.data;
  },
};
