import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  STORAGE_PROVIDER,
  StorageProviderType,
  IStorageProvider,
} from './interfaces/storage-provider.interface.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';
import { AwsStorageProvider } from './providers/aws-storage.provider.js';
import { GcpStorageProvider } from './providers/gcp-storage.provider.js';
import { AzureStorageProvider } from './providers/azure-storage.provider.js';
import { StorageService } from './services/storage.service.js';

/**
 * Storage Module
 * Per GAP-004: Configurable object storage with multiple backend support
 *
 * Supported providers:
 * - 'local': Local file system storage at ./docstore
 * - 'aws': AWS S3 (also compatible with MinIO)
 * - 'gcp': Google Cloud Storage
 * - 'azure': Azure Blob Storage
 *
 * Configuration:
 * Set STORAGE_PROVIDER environment variable to switch providers.
 * Only one provider is active at a time.
 *
 * Storage structure uses {user_id_guid} from identity service for isolation:
 * {storage_root}/
 *   └── {bucket}/
 *       └── {user_id_guid}/
 *           └── {filename}
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Storage provider factory
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService): IStorageProvider => {
        const logger = new Logger('StorageModule');
        const providerType = configService.get<string>(
          'app.storage.provider',
          'local',
        ) as StorageProviderType;

        logger.log(`Configuring storage provider: ${providerType}`);

        switch (providerType) {
          case StorageProviderType.AWS:
            logger.log('Using AWS S3 storage provider');
            return new AwsStorageProvider(configService);

          case StorageProviderType.GCP:
            logger.log('Using GCP Cloud Storage provider');
            return new GcpStorageProvider(configService);

          case StorageProviderType.AZURE:
            logger.log('Using Azure Blob Storage provider');
            return new AzureStorageProvider(configService);

          case StorageProviderType.LOCAL:
          default:
            const basePath = configService.get<string>(
              'app.storage.local.basePath',
              './docstore',
            );
            logger.log(`Using local file storage provider at: ${basePath}`);
            return new LocalStorageProvider(configService);
        }
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
