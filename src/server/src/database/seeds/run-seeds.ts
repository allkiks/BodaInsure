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
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SeedingRunnerModule } from '../../modules/seeding/seeding-runner.module.js';
import { SeedingRunnerService } from '../../modules/seeding/seeding-runner.service.js';

const logger = new Logger('SeedRunner');

async function runSeeds(): Promise<void> {
  logger.log('');
  logger.log('╔══════════════════════════════════════════════════════════════╗');
  logger.log('║           BODAINSURE DATABASE SEEDING                         ║');
  logger.log('╚══════════════════════════════════════════════════════════════╝');
  logger.log('');

  try {
    // Create a standalone NestJS application context
    const app = await NestFactory.createApplicationContext(SeedingRunnerModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get the seeding runner service
    const seedingRunner = app.get(SeedingRunnerService);

    // Run all seeds
    const result = await seedingRunner.runAllSeeds();

    // Display summary
    logger.log('');
    logger.log('╔══════════════════════════════════════════════════════════════╗');
    logger.log('║           SEEDING SUMMARY                                     ║');
    logger.log('╠══════════════════════════════════════════════════════════════╣');
    logger.log(`║  Users seeded:         ${String(result.usersSeeded).padEnd(37)}║`);
    logger.log(`║  Organizations seeded: ${String(result.organizationsSeeded).padEnd(37)}║`);
    logger.log(`║  Policy terms seeded:  ${String(result.policyTermsSeeded).padEnd(37)}║`);
    logger.log(`║  Test policies seeded: ${String(result.testPoliciesSeeded).padEnd(37)}║`);
    logger.log(`║  Duration:             ${result.durationMs}ms${' '.repeat(Math.max(0, 34 - String(result.durationMs).length))}║`);
    logger.log('╠══════════════════════════════════════════════════════════════╣');
    logger.log(`║  Status: ${result.success ? 'SUCCESS ✓' : 'FAILED ✗'}${' '.repeat(result.success ? 49 : 50)}║`);
    logger.log('╚══════════════════════════════════════════════════════════════╝');
    logger.log('');

    // Clean up
    await app.close();

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Seeding failed with error:', error);
    process.exit(1);
  }
}

// Run the seeder
runSeeds();
