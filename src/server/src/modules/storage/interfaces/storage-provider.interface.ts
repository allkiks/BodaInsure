/**
 * Storage Provider Interface
 * Per GAP-004: Unified interface for AWS S3, GCP, Azure, and Local file storage
 *
 * All storage providers implement this interface to ensure interchangeability
 * without code modifications - only configuration changes required.
 */

export enum StorageProviderType {
  AWS = 'aws',
  GCP = 'gcp',
  AZURE = 'azure',
  LOCAL = 'local',
}

export enum StorageBucket {
  KYC = 'kyc',
  POLICIES = 'policies',
  CLAIMS = 'claims',
}

export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface StorageUploadResult {
  success: boolean;
  key: string;
  url?: string;
  etag?: string;
  size?: number;
  error?: string;
}

export interface StorageDownloadResult {
  success: boolean;
  data?: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  error?: string;
}

export interface StorageDeleteResult {
  success: boolean;
  error?: string;
}

export interface StorageListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface StorageListItem {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

export interface StorageListResult {
  success: boolean;
  items: StorageListItem[];
  isTruncated: boolean;
  continuationToken?: string;
  error?: string;
}

export interface StorageSignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  contentType?: string;
}

export interface StorageSignedUrlResult {
  success: boolean;
  url?: string;
  expiresAt?: Date;
  error?: string;
}

export interface StorageExistsResult {
  exists: boolean;
  error?: string;
}

/**
 * Storage Provider Interface
 * All storage backends must implement this interface
 */
export interface IStorageProvider {
  /**
   * Get the provider type identifier
   */
  readonly providerType: StorageProviderType;

  /**
   * Initialize the provider (create buckets if needed)
   */
  initialize(): Promise<void>;

  /**
   * Upload a file to storage
   * @param bucket - The bucket type (kyc, policies, claims)
   * @param userId - User GUID for folder isolation
   * @param fileName - Name of the file
   * @param data - File content as Buffer
   * @param options - Upload options
   */
  upload(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult>;

  /**
   * Download a file from storage
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param fileName - Name of the file
   */
  download(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult>;

  /**
   * Delete a file from storage
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param fileName - Name of the file
   */
  delete(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDeleteResult>;

  /**
   * List files in a user's folder
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param options - List options
   */
  list(
    bucket: StorageBucket,
    userId: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult>;

  /**
   * Check if a file exists
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param fileName - Name of the file
   */
  exists(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageExistsResult>;

  /**
   * Generate a signed URL for direct upload
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param fileName - Name of the file
   * @param options - Signed URL options
   */
  getSignedUploadUrl(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult>;

  /**
   * Generate a signed URL for direct download
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param fileName - Name of the file
   * @param options - Signed URL options
   */
  getSignedDownloadUrl(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult>;

  /**
   * Delete all files for a user (for account deletion)
   * @param userId - User GUID
   */
  deleteUserData(userId: string): Promise<StorageDeleteResult>;

  /**
   * Get the full storage path/key for a file
   * @param bucket - The bucket type
   * @param userId - User GUID
   * @param fileName - Name of the file
   */
  getStoragePath(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string;
}

/**
 * Storage provider injection token
 */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
