import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

/**
 * TypeORM DataSource Configuration for CLI migrations
 *
 * This file is used by TypeORM CLI for running migrations.
 * It should be kept in sync with the app.module.ts TypeORM configuration.
 *
 * Usage:
 *   npm run migration:generate -- -n MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'bodainsure',
  password: process.env['DB_PASSWORD'] ?? 'bodainsure',
  database: process.env['DB_NAME'] ?? 'bodainsure',

  // Entity paths - include both .ts (development) and .js (production)
  entities: [
    path.join(__dirname, '../modules/**/entities/*.entity.{ts,js}'),
  ],

  // Migration paths
  migrations: [
    path.join(__dirname, './migrations/*.{ts,js}'),
  ],

  // SSL configuration for production
  ssl: process.env['DB_SSL'] === 'true'
    ? { rejectUnauthorized: false }
    : false,

  // Logging
  logging: process.env['DB_LOGGING'] === 'true',

  // IMPORTANT: Never use synchronize in production
  // Use migrations instead
  synchronize: false,

  // Migration settings
  migrationsRun: false, // Don't auto-run migrations
  migrationsTableName: 'typeorm_migrations',
};

// Create and export the DataSource instance
const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
