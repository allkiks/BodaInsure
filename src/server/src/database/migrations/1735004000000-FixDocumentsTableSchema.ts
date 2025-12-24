import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Documents Table Schema Migration
 * Adds missing columns to documents table to match entity definitions
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixDocumentsTableSchema1735004000000 implements MigrationInterface {
  name = 'FixDocumentsTableSchema1735004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // UPDATE DOCUMENT ENUMS
    // ============================================

    // Update document_type_enum to match entity (add missing values)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'ID_FRONT';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'ID_BACK';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'LICENSE';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'PHOTO';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Update document_status_enum to match entity (add missing values)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_status_enum" ADD VALUE IF NOT EXISTS 'PROCESSING';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "document_status_enum" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ============================================
    // ADD MISSING COLUMNS TO documents TABLE
    // ============================================

    // Add version column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "version" int NOT NULL DEFAULT 1
    `);

    // Add is_current column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT true
    `);

    // Add storage_key column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storage_key" varchar(500)
    `);

    // Copy file_path to storage_key for existing records
    await queryRunner.query(`
      UPDATE "documents" SET "storage_key" = "file_path" WHERE "storage_key" IS NULL AND "file_path" IS NOT NULL
    `);

    // Make file_path nullable (entity now uses storage_key)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "documents" ALTER COLUMN "file_path" DROP NOT NULL;
      EXCEPTION WHEN others THEN NULL; END $$;
    `);

    // Add original_filename column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "original_filename" varchar(255)
    `);

    // Copy file_name to original_filename for existing records
    await queryRunner.query(`
      UPDATE "documents" SET "original_filename" = "file_name" WHERE "original_filename" IS NULL AND "file_name" IS NOT NULL
    `);

    // Make file_name nullable (entity now uses original_filename)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "documents" ALTER COLUMN "file_name" DROP NOT NULL;
      EXCEPTION WHEN others THEN NULL; END $$;
    `);

    // Add quality_score column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "quality_score" int
    `);

    // Add device column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "device" varchar(255)
    `);

    // Add captured_at column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz
    `);

    // Add rejection_reason column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "rejection_reason" text
    `);

    // Add reviewer_notes column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reviewer_notes" text
    `);

    // Copy review_notes to reviewer_notes if review_notes exists
    await queryRunner.query(`
      DO $$ BEGIN
        UPDATE "documents" SET "reviewer_notes" = "review_notes" WHERE "reviewer_notes" IS NULL AND "review_notes" IS NOT NULL;
      EXCEPTION WHEN undefined_column THEN NULL; END $$;
    `);

    // Add content_hash column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_hash" varchar(64)
    `);

    // Add indexes for new columns (IF NOT EXISTS)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_user_type" ON "documents" ("user_id", "document_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_user_status" ON "documents" ("user_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_user_type"`);

    // Drop columns from documents
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "content_hash"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "reviewer_notes"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "captured_at"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "device"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "quality_score"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "original_filename"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "storage_key"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "is_current"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "version"`);

    // Note: We don't revert enum changes as that could break existing data
  }
}
