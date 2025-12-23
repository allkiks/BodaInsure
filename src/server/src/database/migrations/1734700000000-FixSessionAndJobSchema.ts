import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix session and job table schemas
 * These tables have drifted from their entity definitions
 */
export class FixSessionAndJobSchema1734700000000 implements MigrationInterface {
  name = 'FixSessionAndJobSchema1734700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // Fix SESSIONS table
    // =============================================

    // Drop old sessions table and recreate with correct schema
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions" CASCADE`);

    // Create device_type enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sessions_device_type_enum') THEN
          CREATE TYPE "public"."sessions_device_type_enum" AS ENUM('MOBILE_APP', 'WEB', 'USSD');
        END IF;
      END $$;
    `);

    // Create session_status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sessions_status_enum') THEN
          CREATE TYPE "public"."sessions_status_enum" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');
        END IF;
      END $$;
    `);

    // Create sessions table with correct schema
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "refresh_token_hash" varchar(255) NOT NULL UNIQUE,
        "device_type" "public"."sessions_device_type_enum" NOT NULL,
        "status" "public"."sessions_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "device_id" varchar(255),
        "device_name" varchar(255),
        "revoked_reason" varchar(255),
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_sessions_user_status" ON "sessions" ("user_id", "status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_sessions_refresh_token" ON "sessions" ("refresh_token_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_expires_at" ON "sessions" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_created_at" ON "sessions" ("created_at")`);

    // =============================================
    // Fix JOBS table
    // =============================================

    // Drop dependent table first
    await queryRunner.query(`DROP TABLE IF EXISTS "job_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs" CASCADE`);

    // Create job_type enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'jobs_type_enum') THEN
          CREATE TYPE "public"."jobs_type_enum" AS ENUM(
            'POLICY_BATCH', 'PAYMENT_REMINDER', 'POLICY_EXPIRY_REMINDER',
            'LAPSE_CHECK', 'REPORT_GENERATION', 'REPORT_CLEANUP',
            'DATA_SYNC', 'NOTIFICATION_RETRY', 'WALLET_RECONCILIATION', 'CUSTOM'
          );
        END IF;
      END $$;
    `);

    // Create job_status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'jobs_status_enum') THEN
          CREATE TYPE "public"."jobs_status_enum" AS ENUM(
            'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'
          );
        END IF;
      END $$;
    `);

    // Create jobs table with correct schema
    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "type" "public"."jobs_type_enum" NOT NULL,
        "status" "public"."jobs_status_enum" NOT NULL DEFAULT 'SCHEDULED',
        "cron_expression" varchar(50),
        "is_recurring" boolean NOT NULL DEFAULT false,
        "config" jsonb,
        "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "next_run_at" TIMESTAMP WITH TIME ZONE,
        "duration_ms" integer,
        "result" jsonb,
        "error_message" text,
        "error_stack" text,
        "retry_count" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 3,
        "last_retry_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_jobs_type_status" ON "jobs" ("type", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_scheduled_at" ON "jobs" ("scheduled_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_type" ON "jobs" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_status" ON "jobs" ("status")`);

    // Create job_history_status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_history_status_enum') THEN
          CREATE TYPE "public"."job_history_status_enum" AS ENUM(
            'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'
          );
        END IF;
      END $$;
    `);

    // Recreate job_history table
    await queryRunner.query(`
      CREATE TABLE "job_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "status" "public"."job_history_status_enum" NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "duration_ms" integer,
        "result" jsonb,
        "error_message" text,
        "error_stack" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_job_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_history_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_job_history_job" ON "job_history" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_job_history_started_at" ON "job_history" ("started_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This is a destructive migration - down is not fully reversible
    // Just drop the new tables if needed
    await queryRunner.query(`DROP TABLE IF EXISTS "job_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions" CASCADE`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sessions_device_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."jobs_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."job_history_status_enum"`);
  }
}
