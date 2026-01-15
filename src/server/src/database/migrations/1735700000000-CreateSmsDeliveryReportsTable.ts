import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create SMS Delivery Reports Table
 *
 * Creates the sms_delivery_reports table to track SMS delivery status
 * callbacks from Africa's Talking and Advantasms providers.
 *
 * Per CLAUDE.md audit requirements - 7 year retention.
 * Per Africa's Talking best practices - process delivery reports.
 */
export class CreateSmsDeliveryReportsTable1735700000000 implements MigrationInterface {
  name = 'CreateSmsDeliveryReportsTable1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for delivery status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sms_delivery_status_enum" AS ENUM (
          'Sent',
          'Submitted',
          'Buffered',
          'Rejected',
          'Success',
          'Failed',
          'Expired'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create sms_delivery_reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_delivery_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "message_id" varchar(100) NOT NULL,
        "provider" varchar(50) NOT NULL,
        "status" "sms_delivery_status_enum" NOT NULL,
        "phone_number" varchar(20) NOT NULL,
        "network_code" varchar(20),
        "failure_reason" text,
        "retry_count" int NOT NULL DEFAULT 0,
        "notification_id" uuid,
        "cost" decimal(10, 4),
        "currency" varchar(3) NOT NULL DEFAULT 'KES',
        "raw_payload" jsonb,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "delivered_at" timestamptz,
        CONSTRAINT "PK_sms_delivery_reports" PRIMARY KEY ("id")
      );
    `);

    // Create indexes for common queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sms_delivery_reports_message_id"
      ON "sms_delivery_reports" ("message_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sms_delivery_reports_phone_number"
      ON "sms_delivery_reports" ("phone_number");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sms_delivery_reports_status_received"
      ON "sms_delivery_reports" ("status", "received_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sms_delivery_reports_provider_received"
      ON "sms_delivery_reports" ("provider", "received_at");
    `);

    // Add foreign key to notifications table (optional - notification may not exist)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sms_delivery_reports"
        ADD CONSTRAINT "FK_sms_delivery_reports_notification"
        FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
      END $$;
    `);

    // Add SMS event types to audit_event_type enum if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'SMS_SENT';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'SMS_FAILED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'SMS_DELIVERY_CONFIRMED';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'NOTIFICATION_SENT';
        ALTER TYPE "audit_event_type_enum" ADD VALUE IF NOT EXISTS 'NOTIFICATION_FAILED';
      EXCEPTION
        WHEN invalid_parameter_value THEN null;
        WHEN undefined_object THEN null;
      END $$;
    `);

    console.log('Created sms_delivery_reports table with indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "sms_delivery_reports" DROP CONSTRAINT IF EXISTS "FK_sms_delivery_reports_notification";
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sms_delivery_reports_provider_received";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sms_delivery_reports_status_received";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sms_delivery_reports_phone_number";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sms_delivery_reports_message_id";`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_delivery_reports";`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "sms_delivery_status_enum";`);

    // Note: Cannot remove enum values from audit_event_type_enum in PostgreSQL
    // They will remain but be unused

    console.log('Dropped sms_delivery_reports table');
  }
}
