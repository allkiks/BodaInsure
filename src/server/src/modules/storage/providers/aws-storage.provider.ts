import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
 * AWS S3 Storage Provider
 * Per GAP-004: AWS S3 compatible storage (works with MinIO/LocalStack)
 *
 * Storage structure uses {user_id_guid} as folder prefix for isolation:
 * bucket/
 *   └── {user_id_guid}/
 *       └── filename.ext
 */
@Injectable()
export class AwsStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(AwsStorageProvider.name);
  readonly providerType = StorageProviderType.AWS;

  private readonly client: S3Client;
  private readonly bucketNames: Record<StorageBucket, string>;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('app.storage.aws.region', 'eu-west-1');
    const accessKeyId = this.configService.get<string>('app.storage.aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('app.storage.aws.secretAccessKey');
    const endpoint = this.configService.get<string>('app.storage.aws.endpoint');
    const forcePathStyle = this.configService.get<boolean>('app.storage.aws.forcePathStyle', false);

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
    };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    // For MinIO or LocalStack compatibility
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = forcePathStyle;
    }

    this.client = new S3Client(clientConfig);

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
  }

  /**
   * Initialize storage - create buckets if they don't exist
   */
  async initialize(): Promise<void> {
    this.logger.log('Initializing AWS S3 storage');

    for (const bucket of Object.values(StorageBucket)) {
      const bucketName = this.bucketNames[bucket];

      try {
        // Check if bucket exists
        await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
        this.logger.debug(`Bucket exists: ${bucketName}`);
      } catch (error: unknown) {
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'NotFound' || errorName === 'NoSuchBucket') {
          // Create bucket
          try {
            await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
            this.logger.log(`Created bucket: ${bucketName}`);
          } catch (createError) {
            const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
            this.logger.error(`Failed to create bucket ${bucketName}: ${createErrorMsg}`);
          }
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Could not check bucket ${bucketName}: ${errorMsg}`);
        }
      }
    }

    this.logger.log('AWS S3 storage initialized');
  }

  /**
   * Get the storage key (path) for a file
   */
  getStoragePath(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string {
    // Validate userId format
    if (!this.isValidGuid(userId)) {
      throw new Error('Invalid user ID format');
    }
    return `${userId}/${this.sanitizeFileName(fileName)}`;
  }

  /**
   * Upload a file to S3
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
      const bucketName = this.bucketNames[bucket];

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: data,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        ACL: options?.acl === 'public-read' ? 'public-read' : 'private',
      });

      const response = await this.client.send(command);

      this.logger.debug(
        `File uploaded: bucket=${bucketName} key=${key.slice(-20)}`,
      );

      return {
        success: true,
        key,
        etag: response.ETag?.replace(/"/g, ''),
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
   * Download a file from S3
   */
  async download(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketName = this.bucketNames[bucket];

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return {
          success: false,
          error: 'Empty response body',
        };
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);

      return {
        success: true,
        data,
        contentType: response.ContentType,
        metadata: response.Metadata,
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
   * Delete a file from S3
   */
  async delete(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDeleteResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const bucketName = this.bucketNames[bucket];

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.client.send(command);

      this.logger.debug(
        `File deleted: bucket=${bucketName} key=${key.slice(-20)}`,
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
      const bucketName = this.bucketNames[bucket];
      const prefix = options?.prefix
        ? `${userId}/${options.prefix}`
        : `${userId}/`;

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: options?.maxKeys ?? 1000,
        ContinuationToken: options?.continuationToken,
      });

      const response = await this.client.send(command);

      const items = (response.Contents ?? []).map((item) => ({
        key: item.Key ?? '',
        size: item.Size ?? 0,
        lastModified: item.LastModified ?? new Date(),
        etag: item.ETag?.replace(/"/g, ''),
      }));

      return {
        success: true,
        items,
        isTruncated: response.IsTruncated ?? false,
        continuationToken: response.NextContinuationToken,
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
      const bucketName = this.bucketNames[bucket];

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.client.send(command);
      return { exists: true };
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : '';
      if (errorName === 'NotFound') {
        return { exists: false };
      }
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
      const bucketName = this.bucketNames[bucket];
      const expiresIn = options?.expiresIn ?? 3600;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: options?.contentType,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

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
      const bucketName = this.bucketNames[bucket];
      const expiresIn = options?.expiresIn ?? 3600;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

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
        // List all objects for user
        const listResult = await this.list(bucket, userId, { maxKeys: 1000 });

        if (!listResult.success) {
          errors.push(`${bucket}: ${listResult.error}`);
          continue;
        }

        // Delete each object
        for (const item of listResult.items) {
          const fileName = item.key.split('/').pop() ?? '';
          const deleteResult = await this.delete(bucket, userId, fileName);
          if (!deleteResult.success) {
            errors.push(`${bucket}/${fileName}: ${deleteResult.error}`);
          }
        }

        this.logger.log(
          `Deleted user data: bucket=${bucket} userId=${userId.slice(-8)} count=${listResult.items.length}`,
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
   * Validate GUID format
   */
  private isValidGuid(value: string): boolean {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(value);
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\.+/, '');
  }
}
