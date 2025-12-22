import { Injectable, Logger } from '@nestjs/common';
import { SeederService } from '../identity/services/seeder.service.js';
import { DataSeederService } from './data-seeder.service.js';

/**
 * Seeding result interface
 */
export interface SeedingResult {
  success: boolean;
  usersSeeded: number;
  organizationsSeeded: number;
  policyTermsSeeded: number;
  testPoliciesSeeded: number;
  durationMs: number;
  errors: string[];
}

/**
 * Seeding Runner Service
 *
 * Orchestrates the execution of all database seeders in the correct order:
 * 1. Users (via SeederService) - Must run first as other seeders depend on users
 * 2. Configuration data (via DataSeederService) - Organizations, policy terms, mappings
 *
 * This service is called by the CLI runner after migrations complete.
 */
@Injectable()
export class SeedingRunnerService {
  private readonly logger = new Logger(SeedingRunnerService.name);

  constructor(
    private readonly seederService: SeederService,
    private readonly dataSeederService: DataSeederService,
  ) {}

  /**
   * Run all database seeds in order
   */
  async runAllSeeds(): Promise<SeedingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let usersSeeded = 0;
    let organizationsSeeded = 0;
    let policyTermsSeeded = 0;
    let testPoliciesSeeded = 0;

    this.logger.log('Starting database seeding...');
    this.logger.log('');

    try {
      // Step 1: Seed users
      this.logger.log('┌─────────────────────────────────────────────────────────────┐');
      this.logger.log('│  STEP 1/2: Seeding Users                                    │');
      this.logger.log('└─────────────────────────────────────────────────────────────┘');

      const userResult = await this.seederService.seed();
      usersSeeded = userResult.seededCount;

      if (!userResult.success) {
        errors.push(`User seeding failed: ${userResult.error}`);
      }

      this.logger.log('');

      // Step 2: Seed configuration data (organizations, policy terms, etc.)
      this.logger.log('┌─────────────────────────────────────────────────────────────┐');
      this.logger.log('│  STEP 2/2: Seeding Configuration Data                       │');
      this.logger.log('└─────────────────────────────────────────────────────────────┘');

      const dataResult = await this.dataSeederService.seed();
      organizationsSeeded = dataResult.organizationsSeeded;
      policyTermsSeeded = dataResult.policyTermsSeeded;
      testPoliciesSeeded = dataResult.testPoliciesSeeded;

      if (!dataResult.success) {
        errors.push(`Data seeding failed: ${dataResult.error}`);
      }

      this.logger.log('');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Seeding failed with exception', error);
      errors.push(errorMessage);
    }

    const durationMs = Date.now() - startTime;
    const success = errors.length === 0;

    if (success) {
      this.logger.log('Database seeding completed successfully');
    } else {
      this.logger.error('Database seeding completed with errors');
      for (const error of errors) {
        this.logger.error(`  - ${error}`);
      }
    }

    return {
      success,
      usersSeeded,
      organizationsSeeded,
      policyTermsSeeded,
      testPoliciesSeeded,
      durationMs,
      errors,
    };
  }
}
