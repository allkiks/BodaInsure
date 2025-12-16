import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IStorageProvider,
  StorageProviderType,
  StorageBucket,
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
 * Local File Storage Provider
 * Per GAP-004: File path storage with nested folders using {user_id_guid}
 *
 * Storage structure:
 * ./docstore/
 *   ├── kyc-documents/
 *   │   ├── {user_id_guid}/
 *   │   │   ├── national_id_front.jpg
 *   │   │   └── national_id_back.jpg
 *   ├── policy-documents/
 *   │   ├── {user_id_guid}/
 *   │   │   └── policy_12345.pdf
 *   └── claim-documents/
 *       └── {user_id_guid}/
 *           └── claim_photo.jpg
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  readonly providerType = StorageProviderType.LOCAL;

  private readonly basePath: string;
  private readonly bucketPaths: Record<StorageBucket, string>;

  constructor(private readonly configService: ConfigService) {
    this.basePath = this.configService.get<string>(
      'app.storage.local.basePath',
      './docstore',
    );

    this.bucketPaths = {
      [StorageBucket.KYC]: this.configService.get<string>(
        'app.storage.buckets.kyc',
        'kyc-documents',
      ),
      [StorageBucket.POLICIES]: this.configService.get<string>(
        'app.storage.buckets.policies',
        'policy-documents',
      ),
      [StorageBucket.CLAIMS]: this.configService.get<string>(
        'app.storage.buckets.claims',
        'claim-documents',
      ),
    };
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    this.logger.log(`Initializing local storage at: ${this.basePath}`);

    try {
      // Create base directory
      await fs.mkdir(this.basePath, { recursive: true });

      // Create bucket directories
      for (const bucket of Object.values(StorageBucket)) {
        const bucketPath = path.join(this.basePath, this.bucketPaths[bucket]);
        await fs.mkdir(bucketPath, { recursive: true });
        this.logger.debug(`Created bucket directory: ${bucketPath}`);
      }

      this.logger.log('Local storage initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize local storage: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get the full file path for a storage key
   */
  getStoragePath(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string {
    // Validate userId is a valid GUID format to prevent path traversal
    if (!this.isValidGuid(userId)) {
      throw new Error('Invalid user ID format');
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFileName = this.sanitizeFileName(fileName);

    return path.join(
      this.basePath,
      this.bucketPaths[bucket],
      userId,
      sanitizedFileName,
    );
  }

  /**
   * Upload a file to local storage
   */
  async upload(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    try {
      const filePath = this.getStoragePath(bucket, userId, fileName);
      const dirPath = path.dirname(filePath);

      // Ensure user directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(filePath, data);

      // Write metadata file if metadata provided
      if (options?.metadata || options?.contentType) {
        const metadataPath = `${filePath}.meta.json`;
        const metadata = {
          contentType: options.contentType,
          metadata: options.metadata,
          uploadedAt: new Date().toISOString(),
          size: data.length,
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }

      // Calculate etag (MD5 hash)
      const etag = crypto.createHash('md5').update(data).digest('hex');

      this.logger.debug(
        `File uploaded: bucket=${bucket} userId=${userId.slice(-8)} file=${fileName}`,
      );

      return {
        success: true,
        key: this.getRelativePath(bucket, userId, fileName),
        size: data.length,
        etag,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Upload failed: bucket=${bucket} userId=${userId.slice(-8)} error=${errorMessage}`,
      );
      return {
        success: false,
        key: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Download a file from local storage
   */
  async download(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    try {
      const filePath = this.getStoragePath(bucket, userId, fileName);
      const data = await fs.readFile(filePath);

      // Try to read metadata
      let contentType: string | undefined;
      let metadata: Record<string, string> | undefined;

      try {
        const metadataPath = `${filePath}.meta.json`;
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadataObj = JSON.parse(metadataContent);
        contentType = metadataObj.contentType;
        metadata = metadataObj.metadata;
      } catch {
        // Metadata file doesn't exist, that's fine
      }

      return {
        success: true,
        data,
        contentType,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Download failed: bucket=${bucket} userId=${userId.slice(-8)} error=${errorMessage}`,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete a file from local storage
   */
  async delete(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDeleteResult> {
    try {
      const filePath = this.getStoragePath(bucket, userId, fileName);

      // Delete main file
      await fs.unlink(filePath);

      // Try to delete metadata file
      try {
        await fs.unlink(`${filePath}.meta.json`);
      } catch {
        // Metadata file doesn't exist, that's fine
      }

      this.logger.debug(
        `File deleted: bucket=${bucket} userId=${userId.slice(-8)} file=${fileName}`,
      );

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Delete failed: bucket=${bucket} userId=${userId.slice(-8)} error=${errorMessage}`,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List files in a user's folder
   */
  async list(
    bucket: StorageBucket,
    userId: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult> {
    try {
      const userDir = path.join(
        this.basePath,
        this.bucketPaths[bucket],
        userId,
      );

      // Check if directory exists
      try {
        await fs.access(userDir);
      } catch {
        // Directory doesn't exist, return empty list
        return {
          success: true,
          items: [],
          isTruncated: false,
        };
      }

      const files = await fs.readdir(userDir);
      const items = [];

      for (const file of files) {
        // Skip metadata files
        if (file.endsWith('.meta.json')) continue;

        // Apply prefix filter if provided
        if (options?.prefix && !file.startsWith(options.prefix)) continue;

        const filePath = path.join(userDir, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile()) {
          items.push({
            key: this.getRelativePath(bucket, userId, file),
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }

      // Sort by last modified (newest first)
      items.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      // Apply pagination
      const maxKeys = options?.maxKeys ?? 1000;
      const truncated = items.length > maxKeys;
      const paginatedItems = items.slice(0, maxKeys);

      return {
        success: true,
        items: paginatedItems,
        isTruncated: truncated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `List failed: bucket=${bucket} userId=${userId.slice(-8)} error=${errorMessage}`,
      );
      return {
        success: false,
        items: [],
        isTruncated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a file exists
   */
  async exists(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageExistsResult> {
    try {
      const filePath = this.getStoragePath(bucket, userId, fileName);
      await fs.access(filePath);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Generate a signed URL for upload (not supported for local storage)
   * Returns a placeholder that indicates local storage is in use
   */
  async getSignedUploadUrl(
    _bucket: StorageBucket,
    _userId: string,
    _fileName: string,
    _options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult> {
    // Local storage doesn't support signed URLs
    // Client should use the upload endpoint instead
    return {
      success: false,
      error: 'Signed URLs not supported for local storage. Use direct upload endpoint.',
    };
  }

  /**
   * Generate a signed URL for download (not supported for local storage)
   */
  async getSignedDownloadUrl(
    _bucket: StorageBucket,
    _userId: string,
    _fileName: string,
    _options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult> {
    // Local storage doesn't support signed URLs
    // Client should use the download endpoint instead
    return {
      success: false,
      error: 'Signed URLs not supported for local storage. Use direct download endpoint.',
    };
  }

  /**
   * Delete all files for a user (for GDPR/DPA compliance)
   */
  async deleteUserData(userId: string): Promise<StorageDeleteResult> {
    const errors: string[] = [];

    for (const bucket of Object.values(StorageBucket)) {
      try {
        const userDir = path.join(
          this.basePath,
          this.bucketPaths[bucket],
          userId,
        );

        // Check if directory exists
        try {
          await fs.access(userDir);
        } catch {
          // Directory doesn't exist, skip
          continue;
        }

        // Remove directory and all contents
        await fs.rm(userDir, { recursive: true, force: true });
        this.logger.log(
          `Deleted user data: bucket=${bucket} userId=${userId.slice(-8)}`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`${bucket}: ${errorMessage}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join('; '),
      };
    }

    return { success: true };
  }

  /**
   * Get relative path for storage key
   */
  private getRelativePath(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string {
    return `${this.bucketPaths[bucket]}/${userId}/${fileName}`;
  }

  /**
   * Validate GUID format
   */
  private isValidGuid(value: string): boolean {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  private sanitizeFileName(fileName: string): string {
    // Remove any path separators and parent directory references
    return fileName
      .replace(/[/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\.+/, '');
  }
}
