import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { KycDocument, DocumentType } from '@/types';
import * as FileSystem from 'expo-file-system';

export const kycApi = {
  /**
   * Upload KYC document
   */
  uploadDocument: async (
    type: DocumentType,
    fileUri: string
  ): Promise<KycDocument> => {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File not found');
    }

    // Create form data
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', {
      uri: fileUri,
      type: 'image/jpeg',
      name: `${type}.jpg`,
    } as unknown as Blob);

    const response = await apiClient.post<KycDocument>(
      API_ENDPOINTS.KYC_UPLOAD,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  /**
   * Get KYC status
   */
  getStatus: async (): Promise<{
    overallStatus: string;
    documents: KycDocument[];
    requiredDocuments: DocumentType[];
    missingDocuments: DocumentType[];
  }> => {
    const response = await apiClient.get<{
      overallStatus: string;
      documents: KycDocument[];
      requiredDocuments: DocumentType[];
      missingDocuments: DocumentType[];
    }>(API_ENDPOINTS.KYC_STATUS);
    return response.data;
  },
};
