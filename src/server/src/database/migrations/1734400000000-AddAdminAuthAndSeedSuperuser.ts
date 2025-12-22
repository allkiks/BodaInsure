import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add admin authentication support
 *
 * Changes:
 * 1. Add username column for admin accounts
 * 2. Add password_hash column for admin accounts
 * 3. Add is_system_account flag
 *
 * Note: SUPERUSER seeding is handled by SeederService on app startup,
 * not in migrations. This ensures seeding runs after all migrations complete.
 *
 * IDEMPOTENT: All operations use IF NOT EXISTS / IF EXISTS patterns.
 * Safe to run multiple times.
 */
export class AddAdminAuthAndSeedSuperuser1734400000000 implements MigrationInterface {
  name = 'AddAdminAuthAndSeedSuperuser1734400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add username column for admin accounts
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "username" varchar(50) UNIQUE
    `);

    // Add password_hash column for admin accounts
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "password_hash" varchar(255)
    `);

    // Add is_system_account flag
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_system_account" boolean NOT NULL DEFAULT false
    `);

    // Add index on username (partial index for non-null values)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username"
      ON "users" ("username")
      WHERE "username" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username"`);

    // Remove columns
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_system_account"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "username"`);
  }
}
