import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix notification_templates schema
 *
 * The original notification_templates table schema doesn't match
 * the NotificationTemplate entity. This migration adds the missing
 * columns and renames/modifies existing ones to match the entity.
 */
export class FixNotificationTemplatesSchema1736000000000 implements MigrationInterface {
  name = 'FixNotificationTemplatesSchema1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create template_status_enum if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "template_status_enum" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Add missing columns to notification_templates
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ADD COLUMN IF NOT EXISTS "code" varchar(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "notification_type" "notification_type_enum",
      ADD COLUMN IF NOT EXISTS "status" "template_status_enum" NOT NULL DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS "body" text,
      ADD COLUMN IF NOT EXISTS "html_body" text,
      ADD COLUMN IF NOT EXISTS "preview_text" varchar(255),
      ADD COLUMN IF NOT EXISTS "required_variables" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "locale" varchar(10) DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS "whatsapp_template_name" varchar(255),
      ADD COLUMN IF NOT EXISTS "whatsapp_namespace" varchar(255),
      ADD COLUMN IF NOT EXISTS "version" int DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "created_by" uuid,
      ADD COLUMN IF NOT EXISTS "updated_by" uuid
    `);

    // If required_variables exists as text[], convert to jsonb
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notification_templates'
          AND column_name = 'required_variables'
          AND data_type = 'ARRAY'
        ) THEN
          ALTER TABLE "notification_templates"
          DROP COLUMN "required_variables";

          ALTER TABLE "notification_templates"
          ADD COLUMN "required_variables" jsonb DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);

    // Migrate data from old columns to new columns
    // Copy 'content' to 'body' if body is null
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "body" = "content"
      WHERE "body" IS NULL AND "content" IS NOT NULL
    `);

    // Copy 'type' to 'notification_type' if notification_type is null
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "notification_type" = "type"
      WHERE "notification_type" IS NULL AND "type" IS NOT NULL
    `);

    // Generate code from name if code is null
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "code" = UPPER(REPLACE(REPLACE("name", ' ', '_'), '-', '_'))
      WHERE "code" IS NULL AND "name" IS NOT NULL
    `);

    // Create index on code column
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_templates_code" ON "notification_templates" ("code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new columns
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      DROP COLUMN IF EXISTS "code",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "notification_type",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "body",
      DROP COLUMN IF EXISTS "html_body",
      DROP COLUMN IF EXISTS "preview_text",
      DROP COLUMN IF EXISTS "required_variables",
      DROP COLUMN IF EXISTS "locale",
      DROP COLUMN IF EXISTS "whatsapp_template_name",
      DROP COLUMN IF EXISTS "whatsapp_namespace",
      DROP COLUMN IF EXISTS "version",
      DROP COLUMN IF EXISTS "created_by",
      DROP COLUMN IF EXISTS "updated_by"
    `);

    // Drop the template_status_enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "template_status_enum" CASCADE`);
  }
}
