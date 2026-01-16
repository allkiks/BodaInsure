#!/usr/bin/env node
/**
 * Database Seeding CLI Runner
 *
 * This script runs all database seeds after migrations have completed.
 * It bootstraps a minimal NestJS application context to use the seeding services.
 *
 * Usage:
 *   npm run seed
 *   npx ts-node src/database/seeds/run-seeds.ts
 *
 * Exit codes:
 *   0 - Seeding completed successfully
 *   1 - Seeding failed
 *
 * Progress Visibility:
 *   - Step-by-step progress with status indicators
 *   - Shows current action being executed
 *   - Displays detailed summary with counts
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SeedingRunnerModule } from '../../modules/seeding/seeding-runner.module.js';
import { SeedingRunnerService } from '../../modules/seeding/seeding-runner.service.js';

const logger = new Logger('SeedRunner');

/**
 * Format timestamp for logging
 */
function getTimestamp(): string {
  const time = new Date().toISOString().split('T')[1];
  return time ? time.split('.')[0] ?? '' : '';
}

/**
 * Log with timestamp
 */
function log(message: string): void {
  console.log(`[${getTimestamp()}] [SeedRunner] ${message}`);
}

async function runSeeds(): Promise<void> {
  const startTime = Date.now();

  log('Starting database seeding process');
  log('');

  try {
    // Create a standalone NestJS application context
    log('⏳ Initializing NestJS context...');
    const app = await NestFactory.createApplicationContext(SeedingRunnerModule, {
      logger: ['error', 'warn', 'log'],
    });
    log('✓ NestJS context initialized');
    log('');

    // Get the seeding runner service
    const seedingRunner = app.get(SeedingRunnerService);

    // Run all seeds (progress is handled by SeedingRunnerService)
    const result = await seedingRunner.runAllSeeds();

    // Clean up
    await app.close();

    // Final status
    const totalDuration = Date.now() - startTime;
    if (result.success) {
      log(`✓ Seeding completed successfully in ${totalDuration}ms`);
    } else {
      log(`✗ Seeding completed with errors in ${totalDuration}ms`);
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`✗ Seeding failed: ${errorMessage}`);
    process.exit(1);
  }
}

// Run the seeder
runSeeds();
