import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Policy Documents Table Schema Migration
 * Adds missing columns to policy_documents table to match entity definitions
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixPolicyDocumentsTableSchema1735004500000 implements MigrationInterface {
  name = 'FixPolicyDocumentsTableSchema1735004500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // CREATE ENUMS FOR policy_documents
    // ============================================

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
    // ADD MISSING COLUMNS TO policy_documents TABLE
    // ============================================

    // Add status column
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "policy_documents" ADD COLUMN "status" "policy_document_status_enum" NOT NULL DEFAULT 'PENDING';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);

    // Add user_id column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "user_id" uuid
    `);

    // Populate user_id from policies table for existing records
    await queryRunner.query(`
      UPDATE "policy_documents" pd
      SET "user_id" = p."user_id"
      FROM "policies" p
      WHERE pd."policy_id" = p."id" AND pd."user_id" IS NULL
    `);

    // Add delivery_status column
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "policy_documents" ADD COLUMN "delivery_status" "delivery_status_enum" NOT NULL DEFAULT 'PENDING';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);

    // Add storage_path column
    await queryRunner.query(`
      ALTER TABLE "policy_documents" ADD COLUMN IF NOT EXISTS "storage_path" varchar(500)
    `);

    // Copy file_path to storage_path for existing records
    await queryRunner.query(`
      UPDATE "policy_documents" SET "storage_path" = "file_path" WHERE "storage_path" IS NULL AND "file_path" IS NOT NULL
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policy_documents_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policy_documents_policy_type"`);

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

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "delivery_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_document_status_enum"`);
  }
}
