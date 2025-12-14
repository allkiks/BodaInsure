import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';
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
 * GCP Cloud Storage Provider
 * Per GAP-004: Google Cloud Storage backend
 *
 * Storage structure uses {user_id_guid} as folder prefix for isolation:
 * bucket/
 *   └── {user_id_guid}/
 *       └── filename.ext
 */
@Injectable()
export class GcpStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(GcpStorageProvider.name);
  readonly providerType = StorageProviderType.GCP;

  private readonly client: Storage;
  private readonly bucketNames: Record<StorageBucket, string>;
  private readonly buckets: Map<StorageBucket, Bucket> = new Map();

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('app.storage.gcp.projectId');
    const keyFilePath = this.configService.get<string>('app.storage.gcp.keyFilePath');
    const credentialsJson = this.configService.get<string>('app.storage.gcp.credentials');

    const clientConfig: ConstructorParameters<typeof Storage>[0] = {};

    if (projectId) {
      clientConfig.projectId = projectId;
    }

    if (keyFilePath) {
      clientConfig.keyFilename = keyFilePath;
    } else if (credentialsJson) {
      try {
        clientConfig.credentials = JSON.parse(credentialsJson);
      } catch {
        this.logger.warn('Failed to parse GCP credentials JSON');
      }
    }

    this.client = new Storage(clientConfig);

    this.bucketNames = {
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

    // Initialize bucket references
    for (const bucket of Object.values(StorageBucket)) {
      this.buckets.set(bucket, this.client.bucket(this.bucketNames[bucket]));
    }
  }

  /**
   * Initialize storage - create buckets if they don't exist
   */
  async initialize(): Promise<void> {
    this.logger.log('Initializing GCP Cloud Storage');

    for (const bucket of Object.values(StorageBucket)) {
      const bucketName = this.bucketNames[bucket];
      const bucketRef = this.buckets.get(bucket)!;

      try {
        const [exists] = await bucketRef.exists();
        if (!exists) {
          await this.client.createBucket(bucketName);
          this.logger.log(`Created bucket: ${bucketName}`);
        } else {
          this.logger.debug(`Bucket exists: ${bucketName}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Could not check/create bucket ${bucketName}: ${errorMessage}`);
      }
    }

    this.logger.log('GCP Cloud Storage initialized');
  }

  /**
   * Get the storage path for a file
   */
  getStoragePath(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string {
    if (!this.isValidGuid(userId)) {
      throw new Error('Invalid user ID format');
    }
    return `${userId}/${this.sanitizeFileName(fileName)}`;
  }

  /**
   * Upload a file to GCP
   */
  async upload(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    data: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketRef = this.buckets.get(bucket)!;
      const file = bucketRef.file(key);

      await file.save(data, {
        contentType: options?.contentType,
        metadata: options?.metadata ? { metadata: options.metadata } : undefined,
        public: options?.acl === 'public-read',
      });

      const [metadata] = await file.getMetadata();

      this.logger.debug(
        `File uploaded: bucket=${this.bucketNames[bucket]} key=${key.slice(-20)}`,
      );

      return {
        success: true,
        key,
        etag: metadata.etag,
        size: data.length,
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
   * Download a file from GCP
   */
  async download(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketRef = this.buckets.get(bucket)!;
      const file = bucketRef.file(key);

      const [data] = await file.download();
      const [metadata] = await file.getMetadata();

      return {
        success: true,
        data,
        contentType: metadata.contentType,
        metadata: metadata.metadata as Record<string, string> | undefined,
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
   * Delete a file from GCP
   */
  async delete(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDeleteResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketRef = this.buckets.get(bucket)!;
      const file = bucketRef.file(key);

      await file.delete();

      this.logger.debug(
        `File deleted: bucket=${this.bucketNames[bucket]} key=${key.slice(-20)}`,
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
      const bucketRef = this.buckets.get(bucket)!;
      const prefix = options?.prefix
        ? `${userId}/${options.prefix}`
        : `${userId}/`;

      const [files] = await bucketRef.getFiles({
        prefix,
        maxResults: options?.maxKeys ?? 1000,
        pageToken: options?.continuationToken,
      });

      const items = await Promise.all(
        files.map(async (file) => {
          const [metadata] = await file.getMetadata();
          return {
            key: file.name,
            size: parseInt(String(metadata.size ?? 0), 10),
            lastModified: new Date(metadata.updated ?? Date.now()),
            etag: metadata.etag,
          };
        }),
      );

      return {
        success: true,
        items,
        isTruncated: false, // GCP handles pagination differently
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
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketRef = this.buckets.get(bucket)!;
      const file = bucketRef.file(key);

      const [exists] = await file.exists();
      return { exists };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { exists: false, error: errorMessage };
    }
  }

  /**
   * Generate a signed URL for upload
   */
  async getSignedUploadUrl(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketRef = this.buckets.get(bucket)!;
      const file = bucketRef.file(key);
      const expiresIn = options?.expiresIn ?? 3600;

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresIn * 1000,
        contentType: options?.contentType,
      });

      return {
        success: true,
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate a signed URL for download
   */
  async getSignedDownloadUrl(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
    options?: StorageSignedUrlOptions,
  ): Promise<StorageSignedUrlResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketRef = this.buckets.get(bucket)!;
      const file = bucketRef.file(key);
      const expiresIn = options?.expiresIn ?? 3600;

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });

      return {
        success: true,
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete all files for a user
   */
  async deleteUserData(userId: string): Promise<StorageDeleteResult> {
    const errors: string[] = [];

    for (const bucket of Object.values(StorageBucket)) {
      try {
        const bucketRef = this.buckets.get(bucket)!;
        const prefix = `${userId}/`;

        const [files] = await bucketRef.getFiles({ prefix });

        for (const file of files) {
          try {
            await file.delete();
          } catch (deleteError) {
            const deleteErrorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
            errors.push(`${file.name}: ${deleteErrorMsg}`);
          }
        }

        this.logger.log(
          `Deleted user data: bucket=${bucket} userId=${userId.slice(-8)} count=${files.length}`,
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

  private isValidGuid(value: string): boolean {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\.+/, '');
  }
}
