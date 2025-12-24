import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix KYC Validations Status Column Migration
 * Adds default value to the status column to allow inserts without explicitly setting status
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixKycValidationsStatusColumn1735006000000 implements MigrationInterface {
  name = 'FixKycValidationsStatusColumn1735006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // FIX status COLUMN DEFAULT VALUE
    // The status column was varchar(20) NOT NULL without a default
    // This causes inserts to fail when status is not explicitly provided
    // ============================================

    // Add default value to status column
    await queryRunner.query(`
      ALTER TABLE "kyc_validations"
      ALTER COLUMN "status" SET DEFAULT 'COMPLETED'
    `);

    // Update any existing NULL values to COMPLETED (shouldn't exist due to NOT NULL, but just in case)
    await queryRunner.query(`
      UPDATE "kyc_validations"
      SET "status" = 'COMPLETED'
      WHERE "status" IS NULL OR "status" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the default value
    await queryRunner.query(`
      ALTER TABLE "kyc_validations"
      ALTER COLUMN "status" DROP DEFAULT
    `);
  }
}
