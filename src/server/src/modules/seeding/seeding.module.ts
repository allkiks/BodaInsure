import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity.js';
import { Membership } from '../organization/entities/membership.entity.js';
import { PolicyTerms } from '../policy/entities/policy-terms.entity.js';
import { Policy } from '../policy/entities/policy.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { DataSeederService } from './data-seeder.service.js';

/**
 * Seeding Module
 *
 * Handles seeding of configuration data:
 * - Organizations (KBA, SACCOs)
 * - Policy Terms (TPO terms)
 * - User-Organization memberships
 * - Test Policies (for rider users)
 *
 * Runs automatically on application startup.
 * All seeding is idempotent - safe to run multiple times.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Membership, PolicyTerms, Policy, User]),
  ],
  providers: [DataSeederService],
  exports: [DataSeederService],
})
export class SeedingModule {}
