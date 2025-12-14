import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'bodainsure',
  password: process.env['DB_PASSWORD'] ?? 'bodainsure',
  database: process.env['DB_NAME'] ?? 'bodainsure',
  synchronize: process.env['NODE_ENV'] !== 'production',
  logging: process.env['DB_LOGGING'] === 'true',
  ssl:
    process.env['DB_SSL'] === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,
  // Connection pool settings
  extra: {
    max: parseInt(process.env['DB_POOL_SIZE'] ?? '10', 10),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  },
}));
