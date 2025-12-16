import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Migration to add admin authentication support and seed SUPERUSER account
 *
 * Changes:
 * 1. Add username column for admin accounts
 * 2. Add password_hash column for admin accounts
 * 3. Add is_system_account flag
 * 4. Create default SUPERUSER account (idempotent)
 *
 * Per requirements:
 * - SUPERUSER account with username "SUPERUSER" and password "ChangeMe123!"
 * - Must be automatically created on first run
 * - Must be re-created if it does not exist (idempotent)
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

    // Seed the SUPERUSER account (idempotent - only creates if not exists)
    await this.seedSuperuser(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove SUPERUSER account
    await queryRunner.query(`
      DELETE FROM "users" WHERE "username" = 'SUPERUSER' AND "is_system_account" = true
    `);

    // Remove index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username"`);

    // Remove columns
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_system_account"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "username"`);
  }

  /**
   * Seeds the SUPERUSER account
   * Idempotent - will not create duplicate if already exists
   */
  private async seedSuperuser(queryRunner: QueryRunner): Promise<void> {
    // Check if SUPERUSER already exists
    const existingUser = await queryRunner.query(`
      SELECT id FROM "users" WHERE "username" = 'SUPERUSER'
    `);

    if (existingUser && existingUser.length > 0) {
      console.log('SUPERUSER account already exists, skipping seed');
      return;
    }

    // Hash the default password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('ChangeMe123!', saltRounds);

    // Create the SUPERUSER account
    // Using a system phone number that won't conflict with real users
    await queryRunner.query(`
      INSERT INTO "users" (
        "id",
        "phone",
        "username",
        "password_hash",
        "role",
        "status",
        "kyc_status",
        "language",
        "is_system_account",
        "is_active",
        "terms_accepted_at",
        "created_at",
        "updated_at"
      ) VALUES (
        uuid_generate_v4(),
        '+254000000000',
        'SUPERUSER',
        $1,
        'platform_admin',
        'ACTIVE',
        'APPROVED',
        'en',
        true,
        true,
        NOW(),
        NOW(),
        NOW()
      )
    `, [passwordHash]);

    console.log('SUPERUSER account created successfully');
  }
}
