import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Email Delivery Reports Table and HTML Template Support
 *
 * Per GAP-E01: Email delivery tracking for audit compliance
 * Per GAP-E04: HTML body support for email templates
 */
export class AddEmailDeliveryReportsAndTemplateHtml1735800000000 implements MigrationInterface {
  name = 'AddEmailDeliveryReportsAndTemplateHtml1735800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for email delivery status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "email_delivery_status_enum" AS ENUM (
          'Sent',
          'Delivered',
          'Opened',
          'Clicked',
          'Bounced',
          'Complained',
          'Failed',
          'Deferred'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create enum type for email bounce type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "email_bounce_type_enum" AS ENUM (
          'Soft',
          'Hard',
          'Transient',
          'Permanent'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create email_delivery_reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_delivery_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "message_id" varchar(200) NOT NULL,
        "provider" varchar(50) NOT NULL,
        "status" "email_delivery_status_enum" NOT NULL,
        "recipient" varchar(255) NOT NULL,
        "subject" varchar(255),
        "bounce_type" "email_bounce_type_enum",
        "failure_reason" text,
        "smtp_code" varchar(10),
        "retry_count" int NOT NULL DEFAULT 0,
        "notification_id" uuid,
        "raw_payload" jsonb,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "sent_at" timestamptz,
        "delivered_at" timestamptz,
        "opened_at" timestamptz,
        "clicked_at" timestamptz,
        CONSTRAINT "PK_email_delivery_reports" PRIMARY KEY ("id")
      );
    `);

    // Create indexes for email_delivery_reports
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_delivery_reports_message_id"
      ON "email_delivery_reports" ("message_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_delivery_reports_recipient"
      ON "email_delivery_reports" ("recipient");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_delivery_reports_status_received"
      ON "email_delivery_reports" ("status", "received_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_delivery_reports_provider_received"
      ON "email_delivery_reports" ("provider", "received_at");
    `);

    // Add foreign key to notifications table (optional)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "email_delivery_reports"
        ADD CONSTRAINT "FK_email_delivery_reports_notification"
        FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
      END $$;
    `);

    // Add html_body column to notification_templates for email templates
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ADD COLUMN IF NOT EXISTS "html_body" text;
    `);

    // Add preview_text column for email preview
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ADD COLUMN IF NOT EXISTS "preview_text" varchar(200);
    `);

    // Add email audit event types
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'EMAIL_SENT';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'EMAIL_FAILED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'EMAIL_DELIVERED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'EMAIL_BOUNCED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'TEMPLATE_CREATED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'TEMPLATE_UPDATED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'TEMPLATE_DELETED';
      EXCEPTION
        WHEN invalid_parameter_value THEN null;
        WHEN undefined_object THEN null;
      END $$;
    `);

    console.log('Created email_delivery_reports table and added html_body to notification_templates');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "email_delivery_reports" DROP CONSTRAINT IF EXISTS "FK_email_delivery_reports_notification";
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_delivery_reports_provider_received";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_delivery_reports_status_received";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_delivery_reports_recipient";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_delivery_reports_message_id";`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "email_delivery_reports";`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "email_bounce_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "email_delivery_status_enum";`);

    // Remove columns from notification_templates
    await queryRunner.query(`
      ALTER TABLE "notification_templates" DROP COLUMN IF EXISTS "html_body";
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_templates" DROP COLUMN IF EXISTS "preview_text";
    `);

    console.log('Dropped email_delivery_reports table and removed html_body from notification_templates');
  }
}
