import { apiClient } from './client';
import { API_ENDPOINTS, PAGINATION } from '@/config/constants';
import type { KycDocument, PaginatedResponse, User, DocumentType, KycStatus, DocumentStatus } from '@/types';

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
    uploaded: boolean;
    rejectionReason?: string;
    label?: string;
    version?: number;
  }[];
  completedDocuments: number;
  totalRequired: number;
}

// Server response shape for KYC status
interface ServerKycStatusResponse {
  status: string;
  documents: {
    type: string;
    status: string;
    uploaded: boolean;
    reason?: string;
    label?: string;
    version?: number;
  }[];
  documentsUploaded: number;
  documentsRequired: number;
  completionPercentage: number;
  canProceedToPayment: boolean;
  nextAction?: string;
}

export const kycApi = {
  // =====================
  // User Self-Service APIs
  // =====================

  /**
   * Get current user's KYC status
   */
  getMyStatus: async (): Promise<UserKycStatus> => {
    const response = await apiClient.get<{ data: ServerKycStatusResponse }>(API_ENDPOINTS.KYC_STATUS);
    const serverData = response.data.data;

    // Transform server response to client format
    return {
      overallStatus: serverData.status as KycStatus,
      documents: serverData.documents.map(doc => ({
        type: doc.type as DocumentType,
        status: doc.status as KycStatus,
        uploaded: doc.uploaded,
        rejectionReason: doc.reason,
        label: doc.label,
        version: doc.version,
      })),
      completedDocuments: serverData.documentsUploaded,
      totalRequired: serverData.documentsRequired,
    };
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
        userId: doc.userId,
        type: doc.documentType as DocumentType,
        status: doc.status as DocumentStatus,
        fileUrl: doc.storageKey || '',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
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
      userId: doc.userId,
      type: doc.documentType as DocumentType,
      status: doc.status as DocumentStatus,
      fileUrl: doc.storageKey || '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      rejectionReason: doc.rejectionReason,
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
   * Download document as blob (with auth header)
   * Used for displaying images in the browser since <img src> doesn't send auth headers
   */
  downloadDocumentBlob: async (id: string): Promise<string> => {
    try {
      const response = await apiClient.get(
        `${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/download`,
        { responseType: 'blob' }
      );

      // Verify we got an image blob, not a JSON error
      const blob = response.data as Blob;
      if (!blob.type.startsWith('image/')) {
        // Try to read the error message from the blob
        const text = await blob.text();
        console.error('[KYC] Download returned non-image:', text);
        throw new Error('Document download failed - file not found or access denied');
      }

      // Create an object URL from the blob for use in <img src>
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('[KYC] Document download error:', error);
      throw error;
    }
  },

  /**
   * Approve KYC document
   */
  approveDocument: async (id: string): Promise<void> => {
    await apiClient.patch(`${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/review`, { status: 'APPROVED' });
  },

  /**
   * Reject KYC document
   */
  rejectDocument: async (id: string, reason: string): Promise<void> => {
    await apiClient.patch(`${API_ENDPOINTS.KYC_DOCUMENTS}/${id}/review`, {
      status: 'REJECTED',
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
