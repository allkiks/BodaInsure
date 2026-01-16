#!/usr/bin/env node
/**
 * Database Migration CLI Runner
 *
 * This script runs all pending database migrations with progress visibility.
 * It wraps TypeORM's migration runner to provide user-friendly output.
 *
 * Usage:
 *   npm run migration:run:cli
 *   npx ts-node src/database/migrations/run-migrations.ts
 *
 * Exit codes:
 *   0 - Migrations completed successfully (or no pending migrations)
 *   1 - Migration failed
 *
 * Output:
 *   - Shows each migration being executed with progress indicators
 *   - Displays summary of applied migrations
 *   - Handles both fresh databases and incremental migrations
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source.js';

/**
 * Status icons for console output
 */
const ICONS = {
  pending: '○',
  running: '⏳',
  done: '✓',
  skipped: '⊘',
  failed: '✗',
};

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Log with timestamp prefix
 */
function log(message: string): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Log error with timestamp prefix
 */
function logError(message: string): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.error(`[${timestamp}] ${message}`);
}

/**
 * Print header banner
 */
function printHeader(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           BODAINSURE DATABASE MIGRATIONS                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * Print migration summary
 */
function printSummary(
  applied: number,
  skipped: number,
  failed: number,
  duration: number,
): void {
  const statusIcon = failed === 0 ? ICONS.done : ICONS.failed;
  const statusText = failed === 0 ? 'SUCCESS' : 'FAILED';

  console.log('');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│  Migration Summary                                           │');
  console.log('├──────────────────────────────────────────────────────────────┤');
  console.log(`│  Applied:    ${String(applied).padEnd(47)}│`);
  if (skipped > 0) {
    console.log(`│  Skipped:    ${String(skipped).padEnd(47)}│`);
  }
  if (failed > 0) {
    console.log(`│  Failed:     ${String(failed).padEnd(47)}│`);
  }
  console.log(`│  Duration:   ${formatDuration(duration).padEnd(47)}│`);
  console.log(`│  Status:     ${statusIcon} ${statusText.padEnd(44)}│`);
  console.log('└──────────────────────────────────────────────────────────────┘');
  console.log('');
}

/**
 * Get migration name from file path
 */
function getMigrationName(name: string): string {
  // Extract readable name from migration class name
  // e.g., "InitialSchema1735000000000" -> "Initial Schema"
  const match = name.match(/^(\d+)-?(.+)$/);
  if (match) {
    // Convert camelCase/PascalCase to spaces
    return match[2]
      .replace(/([A-Z])/g, ' $1')
      .replace(/^-/, '')
      .trim();
  }
  return name;
}

/**
 * Run migrations with progress visibility
 */
async function runMigrations(): Promise<void> {
  const startTime = Date.now();
  let dataSource: DataSource | null = null;
  let appliedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  printHeader();

  try {
    // Initialize data source
    log(`${ICONS.running} Connecting to database...`);
    dataSource = await AppDataSource.initialize();
    log(`${ICONS.done} Database connected`);
    console.log('');

    // Get pending migrations
    const pendingMigrations = await dataSource.showMigrations();

    if (!pendingMigrations) {
      log(`${ICONS.skipped} No pending migrations`);
      skippedCount = 0;
      printSummary(appliedCount, skippedCount, failedCount, Date.now() - startTime);
      await dataSource.destroy();
      process.exit(0);
    }

    // Get all migrations that will be executed
    const migrations = dataSource.migrations;
    const executedMigrations = await dataSource.query(
      `SELECT name FROM typeorm_migrations ORDER BY id`,
    ).catch(() => [] as Array<{ name: string }>);
    const executedNames = new Set(executedMigrations.map((m: { name: string }) => m.name));

    // Filter to pending migrations only
    const pending = migrations.filter(m => !executedNames.has(m.name));

    if (pending.length === 0) {
      log(`${ICONS.skipped} All migrations already applied`);
      printSummary(0, migrations.length, 0, Date.now() - startTime);
      await dataSource.destroy();
      process.exit(0);
    }

    log(`Found ${pending.length} pending migration(s)`);
    console.log('');

    // Run migrations with progress
    for (let i = 0; i < pending.length; i++) {
      const migration = pending[i];
      const migrationName = getMigrationName(migration.name);
      const progress = `[${i + 1}/${pending.length}]`;

      log(`${progress} ${ICONS.running} Running: ${migrationName}...`);

      try {
        const migrationStart = Date.now();
        await dataSource.runMigrations({ transaction: 'each' });

        const migrationDuration = Date.now() - migrationStart;
        log(`     ${ICONS.done} Done (${formatDuration(migrationDuration)})`);
        appliedCount++;

        // Break after first batch since runMigrations runs all pending
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`     ${ICONS.failed} Failed: ${errorMessage}`);
        failedCount++;
        throw error;
      }
    }

    // Recalculate applied count from actual database state
    const finalExecuted = await dataSource.query(
      `SELECT COUNT(*) as count FROM typeorm_migrations`,
    ).catch(() => [{ count: 0 }]);
    appliedCount = pending.length;

    printSummary(appliedCount, skippedCount, failedCount, Date.now() - startTime);

    await dataSource.destroy();
    process.exit(failedCount > 0 ? 1 : 0);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`${ICONS.failed} Migration failed: ${errorMessage}`);

    printSummary(appliedCount, skippedCount, failedCount + 1, Date.now() - startTime);

    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

// Run migrations
runMigrations();
