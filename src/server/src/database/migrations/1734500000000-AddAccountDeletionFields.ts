import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add account deletion scheduling fields
 *
 * Changes:
 * 1. Add deletion_scheduled_for column for grace period deletion
 * 2. Add deletion_reason column to track why user requested deletion
 *
 * Per Data Protection Act 2019:
 * - Right to Deletion with 30-day grace period
 * - User can cancel deletion within grace period
 */
export class AddAccountDeletionFields1734500000000 implements MigrationInterface {
  name = 'AddAccountDeletionFields1734500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deletion_scheduled_for column for tracking scheduled deletion date
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "deletion_scheduled_for" timestamp with time zone
    `);

    // Add deletion_reason column for tracking deletion reason
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "deletion_reason" text
    `);

    // Add index on deletion_scheduled_for for efficient batch processing
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_deletion_scheduled_for"
      ON "users" ("deletion_scheduled_for")
      WHERE "deletion_scheduled_for" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_deletion_scheduled_for"`);

    // Remove columns
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_reason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_scheduled_for"`);
  }
}
