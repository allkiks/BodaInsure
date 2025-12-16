import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
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
 * Azure Blob Storage Provider
 * Per GAP-004: Azure Blob Storage backend
 *
 * Storage structure uses {user_id_guid} as folder prefix for isolation:
 * container/
 *   └── {user_id_guid}/
 *       └── filename.ext
 */
@Injectable()
export class AzureStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(AzureStorageProvider.name);
  readonly providerType = StorageProviderType.AZURE;

  private readonly client: BlobServiceClient;
  private readonly containerNames: Record<StorageBucket, string>;
  private readonly containers: Map<StorageBucket, ContainerClient> = new Map();
  private readonly sharedKeyCredential?: StorageSharedKeyCredential;
  private readonly accountName?: string;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'app.storage.azure.connectionString',
    );
    this.accountName = this.configService.get<string>(
      'app.storage.azure.accountName',
    );
    const accountKey = this.configService.get<string>(
      'app.storage.azure.accountKey',
    );

    if (connectionString) {
      this.client = BlobServiceClient.fromConnectionString(connectionString);
    } else if (this.accountName && accountKey) {
      this.sharedKeyCredential = new StorageSharedKeyCredential(
        this.accountName,
        accountKey,
      );
      this.client = new BlobServiceClient(
        `https://${this.accountName}.blob.core.windows.net`,
        this.sharedKeyCredential,
      );
    } else {
      throw new Error(
        'Azure Storage requires either connection string or account name/key',
      );
    }

    this.containerNames = {
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

    // Initialize container references
    for (const bucket of Object.values(StorageBucket)) {
      this.containers.set(
        bucket,
        this.client.getContainerClient(this.containerNames[bucket]),
      );
    }
  }

  /**
   * Initialize storage - create containers if they don't exist
   */
  async initialize(): Promise<void> {
    this.logger.log('Initializing Azure Blob Storage');

    for (const bucket of Object.values(StorageBucket)) {
      const containerName = this.containerNames[bucket];
      const containerClient = this.containers.get(bucket)!;

      try {
        const exists = await containerClient.exists();
        if (!exists) {
          await containerClient.create();
          this.logger.log(`Created container: ${containerName}`);
        } else {
          this.logger.debug(`Container exists: ${containerName}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Could not check/create container ${containerName}: ${errorMessage}`,
        );
      }
    }

    this.logger.log('Azure Blob Storage initialized');
  }

  /**
   * Get the storage path for a file
   */
  getStoragePath(
    _bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): string {
    if (!this.isValidGuid(userId)) {
      throw new Error('Invalid user ID format');
    }
    return `${userId}/${this.sanitizeFileName(fileName)}`;
  }

  /**
   * Upload a file to Azure
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
      const containerClient = this.containers.get(bucket)!;
      const blockBlobClient = containerClient.getBlockBlobClient(key);

      const response = await blockBlobClient.uploadData(data, {
        blobHTTPHeaders: {
          blobContentType: options?.contentType,
        },
        metadata: options?.metadata,
      });

      this.logger.debug(
        `File uploaded: container=${this.containerNames[bucket]} key=${key.slice(-20)}`,
      );

      return {
        success: true,
        key,
        etag: response.etag?.replace(/"/g, ''),
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
   * Download a file from Azure
   */
  async download(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDownloadResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const containerClient = this.containers.get(bucket)!;
      const blockBlobClient = containerClient.getBlockBlobClient(key);

      const downloadResponse = await blockBlobClient.download();

      if (!downloadResponse.readableStreamBody) {
        return {
          success: false,
          error: 'Empty response body',
        };
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      const stream = downloadResponse.readableStreamBody;

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      const data = Buffer.concat(chunks);

      // Get properties for metadata
      const properties = await blockBlobClient.getProperties();

      return {
        success: true,
        data,
        contentType: properties.contentType,
        metadata: properties.metadata,
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
   * Delete a file from Azure
   */
  async delete(
    bucket: StorageBucket,
    userId: string,
    fileName: string,
  ): Promise<StorageDeleteResult> {
    try {
      const key = this.getStoragePath(bucket, userId, fileName);
      const containerClient = this.containers.get(bucket)!;
      const blockBlobClient = containerClient.getBlockBlobClient(key);

      await blockBlobClient.delete();

      this.logger.debug(
        `File deleted: container=${this.containerNames[bucket]} key=${key.slice(-20)}`,
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
      const containerClient = this.containers.get(bucket)!;
      const prefix = options?.prefix
        ? `${userId}/${options.prefix}`
        : `${userId}/`;

      const items = [];
      const maxKeys = options?.maxKeys ?? 1000;
      let count = 0;

      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (count >= maxKeys) break;

        items.push({
          key: blob.name,
          size: blob.properties.contentLength ?? 0,
          lastModified: blob.properties.lastModified ?? new Date(),
          etag: blob.properties.etag?.replace(/"/g, ''),
        });

        count++;
      }

      return {
        success: true,
        items,
        isTruncated: count >= maxKeys,
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
      const containerClient = this.containers.get(bucket)!;
      const blockBlobClient = containerClient.getBlockBlobClient(key);

      const exists = await blockBlobClient.exists();
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
      if (!this.sharedKeyCredential || !this.accountName) {
        return {
          success: false,
          error: 'SAS generation requires shared key credential',
        };
      }

      const key = this.getStoragePath(bucket, userId, fileName);
      const containerName = this.containerNames[bucket];
      const expiresIn = options?.expiresIn ?? 3600;
      const expiresOn = new Date(Date.now() + expiresIn * 1000);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: key,
          permissions: BlobSASPermissions.parse('cw'), // create, write
          expiresOn,
          contentType: options?.contentType,
        },
        this.sharedKeyCredential,
      ).toString();

      const url = `https://${this.accountName}.blob.core.windows.net/${containerName}/${key}?${sasToken}`;

      return {
        success: true,
        url,
        expiresAt: expiresOn,
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
      if (!this.sharedKeyCredential || !this.accountName) {
        return {
          success: false,
          error: 'SAS generation requires shared key credential',
        };
      }

      const key = this.getStoragePath(bucket, userId, fileName);
      const containerName = this.containerNames[bucket];
      const expiresIn = options?.expiresIn ?? 3600;
      const expiresOn = new Date(Date.now() + expiresIn * 1000);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: key,
          permissions: BlobSASPermissions.parse('r'), // read
          expiresOn,
        },
        this.sharedKeyCredential,
      ).toString();

      const url = `https://${this.accountName}.blob.core.windows.net/${containerName}/${key}?${sasToken}`;

      return {
        success: true,
        url,
        expiresAt: expiresOn,
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
        const containerClient = this.containers.get(bucket)!;
        const prefix = `${userId}/`;
        let count = 0;

        for await (const blob of containerClient.listBlobsFlat({ prefix })) {
          try {
            const blobClient = containerClient.getBlockBlobClient(blob.name);
            await blobClient.delete();
            count++;
          } catch (deleteError) {
            const deleteErrorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
            errors.push(`${blob.name}: ${deleteErrorMsg}`);
          }
        }

        this.logger.log(
          `Deleted user data: bucket=${bucket} userId=${userId.slice(-8)} count=${count}`,
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
