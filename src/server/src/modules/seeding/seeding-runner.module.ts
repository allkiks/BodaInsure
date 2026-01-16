import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Configuration
import appConfig from '../../config/app.config.js';
import databaseConfig from '../../config/database.config.js';

// Entities needed for seeding
import { User } from '../identity/entities/user.entity.js';
import { Otp } from '../identity/entities/otp.entity.js';
import { Session } from '../identity/entities/session.entity.js';
import { Organization } from '../organization/entities/organization.entity.js';
import { Membership } from '../organization/entities/membership.entity.js';
import { PolicyTerms } from '../policy/entities/policy-terms.entity.js';
import { Policy } from '../policy/entities/policy.entity.js';
import { GlAccount } from '../accounting/entities/gl-account.entity.js';
import { NotificationTemplate } from '../notification/entities/notification-template.entity.js';

// Seeding services
import { SeederService } from '../identity/services/seeder.service.js';
import { DataSeederService } from './data-seeder.service.js';
import { SeedingRunnerService } from './seeding-runner.service.js';

/**
 * Seeding Runner Module
 *
 * A standalone module for CLI-based database seeding.
 * This module provides minimal dependencies required for seeding operations
 * without loading the full application.
 *
 * Used by: src/database/seeds/run-seeds.ts
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [User, Otp, Session, Organization, Membership, PolicyTerms, Policy, GlAccount, NotificationTemplate],
        synchronize: false, // Never sync in seeding - migrations handle schema
        logging: configService.get<boolean>('database.logging'),
        ssl: configService.get('database.ssl'),
        extra: configService.get('database.extra'),
      }),
      inject: [ConfigService],
    }),

    // Register entities for seeding
    TypeOrmModule.forFeature([
      User,
      Otp,
      Session,
      Organization,
      Membership,
      PolicyTerms,
      Policy,
      GlAccount,
      NotificationTemplate,
    ]),
  ],
  providers: [
    SeederService,
    DataSeederService,
    SeedingRunnerService,
  ],
  exports: [SeedingRunnerService],
})
export class SeedingRunnerModule {}
