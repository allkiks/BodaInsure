import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type { KycDocument, PaginatedResponse, User, DocumentType, KycStatus } from '@/types';

interface KycQueueParams {
  status?: string;
  page?: number;
  limit?: number;
}

// Server document response shape
interface ServerDocument {
  id: string;
  userId: string;
  documentType: string;
  status: string;
  version: number;
  isCurrent: boolean;
  storageKey: string;
  originalFilename?: string;
  mimeType: string;
  fileSize: number;
  qualityScore?: number;
  device?: string;
  capturedAt?: string;
  rejectionReason?: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  contentHash: string;
  extractedData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface KycDocumentWithUser extends KycDocument {
  user: Pick<User, 'id' | 'phone' | 'firstName' | 'lastName'>;
}

export interface UserKycStatus {
  overallStatus: KycStatus;
  documents: {
    type: DocumentType;
    status: KycStatus;
    uploadedAt?: string;
    rejectionReason?: string;
  }[];
  requiredDocuments: DocumentType[];
  completedDocuments: number;
  totalRequired: number;
}

export const kycApi = {
  // =====================
  // User Self-Service APIs
  // =====================

  /**
   * Get current user's KYC status
   */
  getMyStatus: async (): Promise<UserKycStatus> => {
    const response = await apiClient.get<{ data: UserKycStatus }>(API_ENDPOINTS.KYC_STATUS);
    return response.data.data;
  },

  /**
   * Get current user's KYC documents
   */
  getMyDocuments: async (): Promise<KycDocument[]> => {
    const response = await apiClient.get<{ data: KycDocument[] }>(API_ENDPOINTS.KYC_MY_DOCUMENTS);
    return response.data.data;
  },

  /**
   * Upload a KYC document
   */
  uploadDocument: async (type: DocumentType, file: File): Promise<KycDocument> => {
    const formData = new FormData();
    formData.append('documentType', type);
    formData.append('file', file);

    const response = await apiClient.post<{ data: KycDocument }>(
      API_ENDPOINTS.KYC_UPLOAD,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  /**
   * Re-upload a rejected document
   */
  reuploadDocument: async (documentId: string, file: File): Promise<KycDocument> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.put<{ data: KycDocument }>(
      `${API_ENDPOINTS.KYC_MY_DOCUMENTS}/${documentId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  // =====================
  // Admin APIs
  // =====================

  /**
   * Get pending KYC documents queue
   */
  getPendingQueue: async (params: KycQueueParams): Promise<PaginatedResponse<KycDocumentWithUser>> => {
    const page = params.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = params.limit ?? PAGINATION.DEFAULT_LIMIT;

    const response = await apiClient.get<{
      data: {
        documents: ServerDocument[];
        total: number;
      };
    }>(
      API_ENDPOINTS.KYC_PENDING,
      {
        params: {
          status: params.status ?? 'pending',
          page,
          limit,
        },
      }
    );

    // Transform server response to PaginatedResponse format
    const { documents, total } = response.data.data;
    return {
      data: documents.map(doc => ({
        id: doc.id,
        type: doc.documentType as DocumentType,
        status: doc.status as KycStatus,
        createdAt: doc.createdAt,
        uploadedAt: doc.createdAt,
        rejectionReason: doc.rejectionReason,
        user: { id: doc.userId, phone: '', firstName: '', lastName: '' },
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get document by ID
   */
  getDocument: async (id: string): Promise<KycDocumentWithUser> => {
    const response = await apiClient.get<{ data: ServerDocument }>(
      `${API_ENDPOINTS.KYC_DOCUMENTS}/${id}`
    );
    const doc = response.data.data;
    return {
      id: doc.id,
      type: doc.documentType as DocumentType,
      status: doc.status as KycStatus,
      createdAt: doc.createdAt,
      uploadedAt: doc.createdAt,
      rejectionReason: doc.rejectionReason,
      storageKey: doc.storageKey,
      user: { id: doc.userId, phone: '', firstName: '', lastName: '' },
    };
  },

  /**
   * Get signed URL for document viewing
   */
  getDocumentUrl: async (id: string): Promise<{ url: string; expiresAt: string }> => {
    const response = await apiClient.get<{ data: { url: string; expiresAt: string } }>(
      `${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/url`
    );
    return response.data.data;
  },

  /**
   * Approve KYC document
   */
  approveDocument: async (id: string): Promise<void> => {
    await apiClient.patch(`${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/review`, { status: 'approved' });
  },

  /**
   * Reject KYC document
   */
  rejectDocument: async (id: string, reason: string): Promise<void> => {
    await apiClient.patch(`${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/review`, {
      status: 'rejected',
      rejectionReason: reason,
    });
  },

  /**
   * Get queue statistics
   */
  getQueueStats: async (): Promise<{
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    averageProcessingTime: number;
  }> => {
    const response = await apiClient.get<{
      data: {
        pending: number;
        approvedToday: number;
        rejectedToday: number;
        averageProcessingTime: number;
      };
    }>(`${API_ENDPOINTS.KYC_PENDING}/stats`);
    return response.data.data;
  },
};
