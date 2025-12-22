import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CommonModule } from './common/common.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { PaymentModule } from './modules/payment/payment.module.js';
import { PolicyModule } from './modules/policy/policy.module.js';
import { OrganizationModule } from './modules/organization/organization.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { ReportingModule } from './modules/reporting/reporting.module.js';
import { SchedulerModule } from './modules/scheduler/scheduler.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UssdModule } from './modules/ussd/ussd.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { SeedingModule } from './modules/seeding/seeding.module.js';
import appConfig from './config/app.config.js';
import databaseConfig from './config/database.config.js';
import redisConfig from './config/redis.config.js';

@Module({
  imports: [
    // Configuration Module - loads environment variables
    // Priority: root .env.local > root .env.docker > local .env.local > local .env
    // Note: When running in Docker, env vars are injected via docker-compose env_file
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig],
      envFilePath: [
        '../../.env.local',    // Root: local development
        '../../.env.docker',   // Root: Docker development
        '.env.local',          // Server dir: local override
        '.env',                // Server dir: fallback
      ],
    }),

    // TypeORM Database Connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('app.nodeEnv') !== 'production',
        logging: configService.get<boolean>('database.logging'),
        ssl: configService.get('database.ssl'),
        extra: configService.get('database.extra'),
      }),
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('app.rateLimit.ttl', 60) * 1000,
            limit: configService.get<number>('app.rateLimit.limit', 100),
          },
        ],
      }),
      inject: [ConfigService],
    }),

    // Common Module (global filters, interceptors)
    CommonModule,

    // Feature Modules
    IdentityModule,
    KycModule,
    PaymentModule,
    PolicyModule,
    OrganizationModule,
    NotificationModule,
    ReportingModule,
    SchedulerModule,
    AuditModule,
    HealthModule,
    UssdModule,
    AdminModule,

    // Seeding Module (seeds config data on first run)
    SeedingModule,

    // Queue Module (BullMQ)
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
