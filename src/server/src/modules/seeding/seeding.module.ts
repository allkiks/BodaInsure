import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity.js';
import { PolicyTerms } from '../policy/entities/policy-terms.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { DataSeederService } from './data-seeder.service.js';

/**
 * Seeding Module
 *
 * Handles seeding of configuration data:
 * - Organizations (KBA, SACCOs)
 * - Policy Terms (TPO terms)
 * - User-Organization mappings
 *
 * Runs automatically on application startup.
 * All seeding is idempotent - safe to run multiple times.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, PolicyTerms, User]),
  ],
  providers: [DataSeederService],
  exports: [DataSeederService],
})
export class SeedingModule {}
