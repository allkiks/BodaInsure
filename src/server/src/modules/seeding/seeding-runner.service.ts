import { Injectable, Logger } from '@nestjs/common';
import { SeederService } from '../identity/services/seeder.service.js';
import { DataSeederService } from './data-seeder.service.js';
import {
  ProgressTracker,
  formatDuration,
} from '../../common/utils/progress.util.js';

/**
 * Seeding result interface
 */
export interface SeedingResult {
  success: boolean;
  usersSeeded: number;
  organizationsSeeded: number;
  policyTermsSeeded: number;
  testPoliciesSeeded: number;
  glAccountsSeeded: number;
  templatesSeeded: number;
  usersMapped: number;
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
 *
 * Progress Visibility:
 * - Displays step-by-step progress with status indicators
 * - Shows current action being executed
 * - Provides summary with counts and duration
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
    let glAccountsSeeded = 0;
    let templatesSeeded = 0;
    let usersMapped = 0;

    const progress = new ProgressTracker('Database Seeding');
    progress.init([
      { name: 'users', description: 'Seeding default users' },
      { name: 'config', description: 'Seeding configuration data' },
    ]);

    try {
      // Step 1: Seed users
      progress.startStep('users');
      const userResult = await this.seederService.seed();
      usersSeeded = userResult.seededCount;

      if (!userResult.success) {
        progress.failStep(userResult.error || 'Unknown error');
        errors.push(`User seeding failed: ${userResult.error}`);
      } else {
        const resultText = `${userResult.createdCount} created, ${userResult.existingCount} existing`;
        progress.completeStep(resultText, userResult.createdCount === 0);
      }

      // Step 2: Seed configuration data (organizations, policy terms, etc.)
      progress.startStep('config');
      const dataResult = await this.dataSeederService.seed();
      organizationsSeeded = dataResult.organizationsSeeded;
      policyTermsSeeded = dataResult.policyTermsSeeded;
      testPoliciesSeeded = dataResult.testPoliciesSeeded;
      glAccountsSeeded = dataResult.glAccountsSeeded;
      templatesSeeded = dataResult.templatesSeeded;
      usersMapped = dataResult.usersMapped;

      if (!dataResult.success) {
        progress.failStep(dataResult.error || 'Unknown error');
        errors.push(`Data seeding failed: ${dataResult.error}`);
      } else {
        const totalItems = organizationsSeeded + policyTermsSeeded + glAccountsSeeded + templatesSeeded;
        const resultText = `${totalItems} items seeded`;
        progress.completeStep(resultText, totalItems === 0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Seeding failed with exception', error);
      errors.push(errorMessage);
    }

    const durationMs = Date.now() - startTime;
    const success = errors.length === 0;

    // Print summary
    this.printDetailedSummary({
      usersSeeded,
      organizationsSeeded,
      policyTermsSeeded,
      glAccountsSeeded,
      templatesSeeded,
      usersMapped,
      durationMs,
      success,
      errors,
    });

    return {
      success,
      usersSeeded,
      organizationsSeeded,
      policyTermsSeeded,
      testPoliciesSeeded,
      glAccountsSeeded,
      templatesSeeded,
      usersMapped,
      durationMs,
      errors,
    };
  }

  /**
   * Print detailed seeding summary
   */
  private printDetailedSummary(data: {
    usersSeeded: number;
    organizationsSeeded: number;
    policyTermsSeeded: number;
    glAccountsSeeded: number;
    templatesSeeded: number;
    usersMapped: number;
    durationMs: number;
    success: boolean;
    errors: string[];
  }): void {
    const statusIcon = data.success ? '✓' : '✗';
    const statusText = data.success ? 'SUCCESS' : 'FAILED';

    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║                    SEEDING COMPLETE                           ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Users:              ${String(data.usersSeeded).padEnd(39)}║`);
    this.logger.log(`║  Organizations:      ${String(data.organizationsSeeded).padEnd(39)}║`);
    this.logger.log(`║  Policy Terms:       ${String(data.policyTermsSeeded).padEnd(39)}║`);
    this.logger.log(`║  GL Accounts:        ${String(data.glAccountsSeeded).padEnd(39)}║`);
    this.logger.log(`║  Templates:          ${String(data.templatesSeeded).padEnd(39)}║`);
    this.logger.log(`║  User Mappings:      ${String(data.usersMapped).padEnd(39)}║`);
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Duration:           ${formatDuration(data.durationMs).padEnd(39)}║`);
    this.logger.log(`║  Status:             ${statusIcon} ${statusText.padEnd(36)}║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');

    if (!data.success && data.errors.length > 0) {
      this.logger.error('');
      this.logger.error('Errors encountered:');
      for (const error of data.errors) {
        this.logger.error(`  ✗ ${error}`);
      }
    }

    this.logger.log('');
  }
}
