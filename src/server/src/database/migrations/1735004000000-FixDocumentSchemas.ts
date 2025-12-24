import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Document Schemas Migration
 * Adds missing columns to documents and policy_documents tables
 * to match entity definitions
 */
export class FixDocumentSchemas1735004000000 implements MigrationInterface {
  name = 'FixDocumentSchemas1735004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // UPDATE ENUMS
    // ============================================

    // Update document_type_enum to match entity (add missing values)
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'ID_FRONT';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'ID_BACK';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'LICENSE';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'PHOTO';
    `);

    // Update document_status_enum to match entity (add missing values)
    await queryRunner.query(`
      ALTER TYPE "document_status_enum" ADD VALUE IF NOT EXISTS 'PROCESSING';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_status_enum" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
    `);

    // Create policy document status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "policy_document_status_enum" AS ENUM ('PENDING', 'GENERATING', 'GENERATED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Create delivery status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "delivery_status_enum" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');
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

    // Add storage_key column (alias for file_path for entity compatibility)
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storage_key" varchar(500)
    `);

    // Copy file_path to storage_key for existing records
    await queryRunner.query(`
      UPDATE "documents" SET "storage_key" = "file_path" WHERE "storage_key" IS NULL
    `);

    // Make file_path nullable (entity now uses storage_key)
    await queryRunner.query(`
      ALTER TABLE "documents" ALTER COLUMN "file_path" DROP NOT NULL
    `);

    // Add original_filename column (alias for file_name)
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "original_filename" varchar(255)
    `);

    // Copy file_name to original_filename for existing records
    await queryRunner.query(`
      UPDATE "documents" SET "original_filename" = "file_name" WHERE "original_filename" IS NULL
    `);

    // Make file_name nullable (entity now uses original_filename)
    await queryRunner.query(`
      ALTER TABLE "documents" ALTER COLUMN "file_name" DROP NOT NULL
    `);

    // Copy file_name to original_filename for existing records
    await queryRunner.query(`
      UPDATE "documents" SET "original_filename" = "file_name" WHERE "original_filename" IS NULL
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

    // Add reviewer_notes column (if review_notes exists, rename it; otherwise add new)
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reviewer_notes" text
    `);

    // Copy review_notes to reviewer_notes if it exists
    await queryRunner.query(`
      DO $$ BEGIN
        UPDATE "documents" SET "reviewer_notes" = "review_notes" WHERE "reviewer_notes" IS NULL AND "review_notes" IS NOT NULL;
      EXCEPTION WHEN undefined_column THEN NULL; END $$;
    `);

    // Add content_hash column
    await queryRunner.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_hash" varchar(64)
    `);

    // Add indexes for new columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_user_type" ON "documents" ("user_id", "document_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_user_status" ON "documents" ("user_id", "status")
    `);

    // ============================================
    // ADD MISSING COLUMNS TO policy_documents TABLE
    // ============================================

    // Add status column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "status" "policy_document_status_enum" NOT NULL DEFAULT 'PENDING'
    `);

    // Add user_id column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "user_id" uuid
    `);

    // Populate user_id from policies table
    await queryRunner.query(`
      UPDATE "policy_documents" pd
      SET "user_id" = p."user_id"
      FROM "policies" p
      WHERE pd."policy_id" = p."id" AND pd."user_id" IS NULL
    `);

    // Add delivery_status column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "delivery_status" "delivery_status_enum" NOT NULL DEFAULT 'PENDING'
    `);

    // Add storage_path column (alias for file_path)
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "storage_path" varchar(500)
    `);

    // Copy file_path to storage_path for existing records
    await queryRunner.query(`
      UPDATE "policy_documents" SET "storage_path" = "file_path" WHERE "storage_path" IS NULL
    `);

    // Add content_hash column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "content_hash" varchar(64)
    `);

    // Add download_url column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "download_url" text
    `);

    // Add download_url_expires_at column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "download_url_expires_at" timestamptz
    `);

    // Add download_count column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "download_count" int NOT NULL DEFAULT 0
    `);

    // Add last_downloaded_at column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "last_downloaded_at" timestamptz
    `);

    // Add whatsapp_sent column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "whatsapp_sent" boolean NOT NULL DEFAULT false
    `);

    // Add whatsapp_sent_at column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "whatsapp_sent_at" timestamptz
    `);

    // Add sms_sent column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "sms_sent" boolean NOT NULL DEFAULT false
    `);

    // Add sms_sent_at column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "sms_sent_at" timestamptz
    `);

    // Add email_sent column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "email_sent" boolean NOT NULL DEFAULT false
    `);

    // Add email_sent_at column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "email_sent_at" timestamptz
    `);

    // Add error_message column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "error_message" text
    `);

    // Add generation_attempts column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "generation_attempts" int NOT NULL DEFAULT 0
    `);

    // Add generation_data column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "generation_data" jsonb
    `);

    // Add indexes for new columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_documents_policy_type" ON "policy_documents" ("policy_id", "document_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_documents_user" ON "policy_documents" ("user_id")
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policy_documents_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policy_documents_policy_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_user_type"`);

    // Drop columns from policy_documents
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "generation_data"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "generation_attempts"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "error_message"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "email_sent_at"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "email_sent"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "sms_sent_at"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "sms_sent"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "whatsapp_sent_at"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "whatsapp_sent"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "last_downloaded_at"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "download_count"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "download_url_expires_at"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "download_url"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "content_hash"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "storage_path"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "delivery_status"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "user_id"`);
    await queryRunner.query(`ALTER TABLE "policy_documents" DROP COLUMN IF EXISTS "status"`);

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

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "delivery_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_document_status_enum"`);
  }
}
