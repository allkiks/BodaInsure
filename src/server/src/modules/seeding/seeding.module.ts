import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity.js';
import { Membership } from '../organization/entities/membership.entity.js';
import { PolicyTerms } from '../policy/entities/policy-terms.entity.js';
import { Policy } from '../policy/entities/policy.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { GlAccount } from '../accounting/entities/gl-account.entity.js';
import { DataSeederService } from './data-seeder.service.js';
import { SeederService } from '../identity/services/seeder.service.js';
import { IdentityModule } from '../identity/identity.module.js';

/**
 * Seeding Module
 *
 * Handles automatic database initialization on application startup:
 * 1. Runs pending migrations (idempotent - tracked in typeorm_migrations table)
 * 2. Seeds users (idempotent - checks existence before creating)
 * 3. Seeds configuration data (idempotent - checks existence before creating):
 *    - Organizations (KBA, SACCOs)
 *    - Policy Terms (TPO terms)
 *    - User-Organization memberships
 *    - Chart of Accounts (15 GL accounts)
 *
 * All operations are idempotent - safe to run on every application startup.
 *
 * Migration files included (from src/database/migrations/):
 * - 1735000000000-InitialSchema.ts
 * - 1735004000000-FixDocumentsTableSchema.ts
 * - 1735004500000-FixPolicyDocumentsTableSchema.ts
 * - 1735005000000-FixKycValidationsSchema.ts
 * - 1735006000000-FixKycValidationsStatusColumn.ts
 * - 1735007000000-FixPaymentRequestsSchema.ts
 * - 1735008000000-FixPaymentRequestsColumnNames.ts
 * - 1735009000000-FixPaymentRequestsTypeColumn.ts
 * - 1735100000000-FixReportingSchema.ts
 * - 1735100001000-SeedReportDefinitions.ts
 * - 1735100002000-FixReportStatusEnum.ts
 * - 1735200000000-CreateAccountingTables.ts
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Membership, PolicyTerms, Policy, User, GlAccount]),
    IdentityModule, // For SeederService (user seeding)
  ],
  providers: [DataSeederService],
  exports: [DataSeederService],
})
export class SeedingModule implements OnModuleInit {
  private readonly logger = new Logger(SeedingModule.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly seederService: SeederService,
    private readonly dataSeederService: DataSeederService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║           DATABASE INITIALIZATION                             ║');
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');

    try {
      // Step 1: Run pending migrations
      await this.runMigrations();

      // Step 2: Seed users
      await this.seedUsers();

      // Step 3: Seed configuration data (organizations, policy terms, GL accounts)
      await this.seedData();

      this.logger.log('');
      this.logger.log('Database initialization completed successfully');
      this.logger.log('');
    } catch (error) {
      this.logger.error('Database initialization failed', error);
      throw error;
    }
  }

  /**
   * Run pending database migrations
   * Idempotent - TypeORM tracks applied migrations in typeorm_migrations table
   * Only migrations not yet in that table will be executed
   */
  private async runMigrations(): Promise<void> {
    this.logger.log('┌─────────────────────────────────────────────────────────────┐');
    this.logger.log('│  STEP 1/3: Running Migrations                               │');
    this.logger.log('└─────────────────────────────────────────────────────────────┘');

    try {
      // Check for pending migrations
      const pendingMigrations = await this.dataSource.showMigrations();

      if (pendingMigrations) {
        this.logger.log('Pending migrations detected, running...');
        const migrations = await this.dataSource.runMigrations();

        if (migrations.length > 0) {
          this.logger.log(`Applied ${migrations.length} migration(s):`);
          for (const migration of migrations) {
            this.logger.log(`  ✓ ${migration.name}`);
          }
        }
      } else {
        this.logger.log('All migrations already applied');
      }
    } catch (error) {
      this.logger.error('Migration failed', error);
      throw error;
    }
  }

  /**
   * Seed user accounts
   * Idempotent - SeederService checks if users exist before creating
   * Handles: SUPERUSER, RIDER, SACCO_ADMIN, KBA_ADMIN, INSURANCE_ADMIN, PLATFORM_ADMIN
   */
  private async seedUsers(): Promise<void> {
    this.logger.log('');
    this.logger.log('┌─────────────────────────────────────────────────────────────┐');
    this.logger.log('│  STEP 2/3: Seeding Users                                    │');
    this.logger.log('└─────────────────────────────────────────────────────────────┘');

    const result = await this.seederService.seed();

    if (!result.success) {
      this.logger.error(`User seeding failed: ${result.error}`);
      throw new Error(`User seeding failed: ${result.error}`);
    }

    // Summary is already logged by SeederService
  }

  /**
   * Seed configuration data
   * Idempotent - DataSeederService checks if data exists before creating
   * Handles: Organizations, Policy Terms, User-Org mappings, GL Accounts
   */
  private async seedData(): Promise<void> {
    this.logger.log('');
    this.logger.log('┌─────────────────────────────────────────────────────────────┐');
    this.logger.log('│  STEP 3/3: Seeding Configuration Data                       │');
    this.logger.log('└─────────────────────────────────────────────────────────────┘');

    const result = await this.dataSeederService.seed();

    if (!result.success) {
      this.logger.error(`Data seeding failed: ${result.error}`);
      throw new Error(`Data seeding failed: ${result.error}`);
    }

    // Log summary
    const totalSeeded =
      result.organizationsSeeded +
      result.policyTermsSeeded +
      result.glAccountsSeeded +
      result.usersMapped;

    if (totalSeeded > 0) {
      this.logger.log('Configuration data seeded:');
      if (result.organizationsSeeded > 0) {
        this.logger.log(`  ✓ ${result.organizationsSeeded} organization(s)`);
      }
      if (result.policyTermsSeeded > 0) {
        this.logger.log(`  ✓ ${result.policyTermsSeeded} policy term(s)`);
      }
      if (result.glAccountsSeeded > 0) {
        this.logger.log(`  ✓ ${result.glAccountsSeeded} GL account(s)`);
      }
      if (result.usersMapped > 0) {
        this.logger.log(`  ✓ ${result.usersMapped} user-org mapping(s)`);
      }
    } else {
      this.logger.log('All configuration data already seeded');
    }
  }
}
