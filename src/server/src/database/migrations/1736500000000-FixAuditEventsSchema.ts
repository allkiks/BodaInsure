import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix audit_events table schema
 *
 * The audit_events table is missing columns expected by the entity:
 * - actor_id, description, details, session_id, channel, outcome, error_message
 */
export class FixAuditEventsSchema1736500000000 implements MigrationInterface {
  name = 'FixAuditEventsSchema1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing columns
    await queryRunner.query(`
      ALTER TABLE "audit_events"
      ADD COLUMN IF NOT EXISTS "actor_id" uuid,
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "details" jsonb,
      ADD COLUMN IF NOT EXISTS "session_id" varchar(100),
      ADD COLUMN IF NOT EXISTS "channel" varchar(20),
      ADD COLUMN IF NOT EXISTS "outcome" varchar(20) DEFAULT 'success',
      ADD COLUMN IF NOT EXISTS "error_message" text
    `);

    // Migrate data from old columns to new columns if they exist
    // Copy metadata to details
    const hasMetadata = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'audit_events' AND column_name = 'metadata'
    `);

    if (hasMetadata.length > 0) {
      await queryRunner.query(`
        UPDATE "audit_events"
        SET "details" = "metadata"
        WHERE "details" IS NULL AND "metadata" IS NOT NULL
      `);
    }

    // Copy target_user_id to actor_id if actor_id is null
    const hasTargetUserId = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'audit_events' AND column_name = 'target_user_id'
    `);

    if (hasTargetUserId.length > 0) {
      await queryRunner.query(`
        UPDATE "audit_events"
        SET "actor_id" = "target_user_id"
        WHERE "actor_id" IS NULL AND "target_user_id" IS NOT NULL
      `);
    }

    // Copy action to description if description is null
    const hasAction = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'audit_events' AND column_name = 'action'
    `);

    if (hasAction.length > 0) {
      await queryRunner.query(`
        UPDATE "audit_events"
        SET "description" = "action"
        WHERE "description" IS NULL AND "action" IS NOT NULL
      `);
    }

    // Create index on createdAt if not exists
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_events_created_at" ON "audit_events" ("created_at")
    `);

    console.log('Successfully fixed audit_events schema');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_events"
      DROP COLUMN IF EXISTS "actor_id",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "details",
      DROP COLUMN IF EXISTS "session_id",
      DROP COLUMN IF EXISTS "channel",
      DROP COLUMN IF EXISTS "outcome",
      DROP COLUMN IF EXISTS "error_message"
    `);
  }
}
