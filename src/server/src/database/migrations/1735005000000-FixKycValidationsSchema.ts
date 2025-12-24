import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix KYC Validations Schema Migration
 * Fixes column types and adds missing columns to kyc_validations table
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixKycValidationsSchema1735005000000 implements MigrationInterface {
  name = 'FixKycValidationsSchema1735005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // CREATE ENUMS FOR kyc_validations
    // ============================================

    // Create validation_result enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "validation_result_enum" AS ENUM ('PASS', 'FAIL', 'WARNING', 'PENDING');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Create validation_type enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "validation_type_enum" AS ENUM ('QUALITY', 'TYPE_MATCH', 'READABILITY', 'FACE_MATCH', 'EXPIRY_CHECK', 'FRAUD_CHECK', 'MANUAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ============================================
    // ADD MISSING COLUMNS TO kyc_validations TABLE
    // ============================================

    // Add message column
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" ADD COLUMN IF NOT EXISTS "message" text
    `);

    // Add details column
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" ADD COLUMN IF NOT EXISTS "details" jsonb
    `);

    // Add is_automated column
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" ADD COLUMN IF NOT EXISTS "is_automated" boolean NOT NULL DEFAULT true
    `);

    // Add validated_by column
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" ADD COLUMN IF NOT EXISTS "validated_by" uuid
    `);

    // ============================================
    // FIX result COLUMN TYPE
    // The result column was jsonb but entity expects enum
    // ============================================

    // Check if result column exists and is not already the correct type
    await queryRunner.query(`
      DO $$
      DECLARE
        col_type text;
      BEGIN
        SELECT udt_name INTO col_type
        FROM information_schema.columns
        WHERE table_name = 'kyc_validations' AND column_name = 'result';

        -- If column exists and is not the correct enum type, drop and recreate
        IF col_type IS NOT NULL AND col_type != 'validation_result_enum' THEN
          ALTER TABLE "kyc_validations" DROP COLUMN "result";
          ALTER TABLE "kyc_validations" ADD COLUMN "result" "validation_result_enum" NOT NULL DEFAULT 'PENDING';
        ELSIF col_type IS NULL THEN
          -- Column doesn't exist, add it
          ALTER TABLE "kyc_validations" ADD COLUMN "result" "validation_result_enum" NOT NULL DEFAULT 'PENDING';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert result column to jsonb
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" DROP COLUMN IF EXISTS "result"
    `);
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" ADD COLUMN "result" jsonb
    `);

    // Drop added columns
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" DROP COLUMN IF EXISTS "validated_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" DROP COLUMN IF EXISTS "is_automated"
    `);
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" DROP COLUMN IF EXISTS "details"
    `);
    await queryRunner.query(`
      ALTER TABLE "kyc_validations" DROP COLUMN IF EXISTS "message"
    `);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "validation_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "validation_result_enum"`);
  }
}
