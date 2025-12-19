import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Document } from './entities/document.entity.js';
import { KycValidation } from './entities/kyc-validation.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { DocumentService } from './services/document.service.js';
import { KycService } from './services/kyc.service.js';
import { KycController } from './controllers/kyc.controller.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, KycValidation, User]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    IdentityModule,
    // Import NotificationModule for KYC status notifications
    forwardRef(() => NotificationModule),
    // Import StorageModule for document storage
    StorageModule,
  ],
  controllers: [KycController],
  providers: [DocumentService, KycService],
  exports: [DocumentService, KycService],
})
export class KycModule {}
