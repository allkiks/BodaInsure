import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  STORAGE_PROVIDER,
  StorageBucket,
  StorageProviderType,
} from '../interfaces/storage-provider.interface.js';
import type {
  IStorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageListOptions,
  StorageListResult,
  StorageSignedUrlOptions,
  StorageSignedUrlResult,
  StorageExistsResult,
} from '../interfaces/storage-provider.interface.js';

/**
 * Storage Service
 * Per GAP-004: Unified storage service that delegates to the configured provider
 *
 * This service provides a clean interface for storage operations while abstracting
 * the underlying provider (AWS S3, GCP, Azure, or Local file system).
 *
 * The active provider is determined by configuration (STORAGE_PROVIDER env var).
 * Switching providers requires only configuration changes, no code modifications.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: IStorageProvider,
  ) {}

  /**
   * Initialize storage on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(`Initializing storage with provider: ${this.provider.providerType}`);
    await this.provider.initialize();
  }

  /**
   * Get the active storage provider type
   */
  getProviderType(): StorageProviderType {
    return this.provider.providerType;
  }

  /**
   * Upload a KYC document for a user
   * @param userId - User GUID from identity service
   * @param fileName - Document filename
   * @param data - File content
   * @param options - Upload options (content type, metadata)
   */
  async uploadKycDocument(
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    return this.provider.upload(StorageBucket.KYC, userId, fileName, data, options);
  }

  /**
   * Upload a policy document for a user
   * @param userId - User GUID from identity service
   * @param fileName - Document filename
   * @param data - File content
   * @param options - Upload options
   */
  async uploadPolicyDocument(
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    return this.provider.upload(StorageBucket.POLICIES, userId, fileName, data, options);
  }

  /**
   * Upload a claim document for a user
   * @param userId - User GUID from identity service
   * @param fileName - Document filename
   * @param data - File content
   * @param options - Upload options
   */
  async uploadClaimDocument(
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    return this.provider.upload(StorageBucket.CLAIMS, userId, fileName, data, options);
  }

  /**
   * Download a KYC document
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  async downloadKycDocument(
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    return this.provider.download(StorageBucket.KYC, userId, fileName);
  }

  /**
   * Download a policy document
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  async downloadPolicyDocument(
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    return this.provider.download(StorageBucket.POLICIES, userId, fileName);
  }

  /**
   * Download a claim document
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  async downloadClaimDocument(
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    return this.provider.download(StorageBucket.CLAIMS, userId, fileName);
  }

  /**
   * Delete a document
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  async deleteDocument(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDeleteResult> {
    return this.provider.delete(bucket, userId, fileName);
  }

  /**
   * List all KYC documents for a user
   * @param userId - User GUID
   * @param options - List options
   */
  async listKycDocuments(
    userId: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult> {
    return this.provider.list(StorageBucket.KYC, userId, options);
  }

  /**
   * List all policy documents for a user
   * @param userId - User GUID
   * @param options - List options
   */
  async listPolicyDocuments(
    userId: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult> {
    return this.provider.list(StorageBucket.POLICIES, userId, options);
  }

  /**
   * List all claim documents for a user
   * @param userId - User GUID
   * @param options - List options
   */
  async listClaimDocuments(
    userId: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult> {
    return this.provider.list(StorageBucket.CLAIMS, userId, options);
  }

  /**
   * Check if a document exists
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  async documentExists(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageExistsResult> {
    return this.provider.exists(bucket, userId, fileName);
  }

  /**
   * Get a signed URL for direct upload (for large files)
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   * @param options - Signed URL options
   */
  async getSignedUploadUrl(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult> {
    return this.provider.getSignedUploadUrl(bucket, userId, fileName, options);
  }

  /**
   * Get a signed URL for direct download
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   * @param options - Signed URL options
   */
  async getSignedDownloadUrl(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult> {
    return this.provider.getSignedDownloadUrl(bucket, userId, fileName, options);
  }

  /**
   * Delete all documents for a user (for GDPR/DPA compliance)
   * @param userId - User GUID
   */
  async deleteAllUserDocuments(userId: string): Promise<StorageDeleteResult> {
    this.logger.log(`Deleting all documents for user: ${userId.slice(-8)}`);
    return this.provider.deleteUserData(userId);
  }

  /**
   * Generic upload method
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   * @param data - File content
   * @param options - Upload options
   */
  async upload(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    return this.provider.upload(bucket, userId, fileName, data, options);
  }

  /**
   * Generic download method
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  async download(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    return this.provider.download(bucket, userId, fileName);
  }

  /**
   * Generic list method
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param options - List options
   */
  async list(
    bucket: StorageBucket,
    userId: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult> {
    return this.provider.list(bucket, userId, options);
  }

  /**
   * Get the full storage path for a document
   * @param bucket - Document type bucket
   * @param userId - User GUID
   * @param fileName - Document filename
   */
  getStoragePath(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string {
    return this.provider.getStoragePath(bucket, userId, fileName);
  }
}
