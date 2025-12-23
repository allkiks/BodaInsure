import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix session, job, and membership table schemas
 * These tables have drifted from their entity definitions
 */
export class FixSessionAndJobSchema1734700000000 implements MigrationInterface {
  name = 'FixSessionAndJobSchema1734700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // Fix MEMBERSHIPS table first
    // =============================================

    // Rename membership_number to member_number if it exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'memberships' AND column_name = 'membership_number') THEN
          ALTER TABLE "memberships" RENAME COLUMN "membership_number" TO "member_number";
        END IF;
      END $$;
    `);

    // Add missing columns to memberships
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'member_number') THEN
          ALTER TABLE "memberships" ADD COLUMN "member_number" varchar(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'expires_at') THEN
          ALTER TABLE "memberships" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'approved_by') THEN
          ALTER TABLE "memberships" ADD COLUMN "approved_by" uuid;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'approved_at') THEN
          ALTER TABLE "memberships" ADD COLUMN "approved_at" TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'suspension_reason') THEN
          ALTER TABLE "memberships" ADD COLUMN "suspension_reason" text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'suspended_by') THEN
          ALTER TABLE "memberships" ADD COLUMN "suspended_by" uuid;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'suspended_at') THEN
          ALTER TABLE "memberships" ADD COLUMN "suspended_at" TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'is_primary') THEN
          ALTER TABLE "memberships" ADD COLUMN "is_primary" boolean NOT NULL DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'fee_paid') THEN
          ALTER TABLE "memberships" ADD COLUMN "fee_paid" integer NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'memberships' AND column_name = 'fee_reference') THEN
          ALTER TABLE "memberships" ADD COLUMN "fee_reference" varchar(100);
        END IF;
      END $$;
    `);

    // Create membership enums if they don't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memberships_status_enum') THEN
          CREATE TYPE "public"."memberships_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memberships_role_enum') THEN
          CREATE TYPE "public"."memberships_role_enum" AS ENUM('MEMBER', 'OFFICIAL', 'ADMIN', 'CHAIRPERSON', 'SECRETARY', 'TREASURER');
        END IF;
      END $$;
    `);

    // Update status column to use enum (if it's varchar)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'memberships' AND column_name = 'status' AND data_type = 'character varying') THEN
          UPDATE "memberships" SET "status" = 'ACTIVE' WHERE "status" = 'active';
          UPDATE "memberships" SET "status" = 'PENDING' WHERE "status" = 'pending';
          ALTER TABLE "memberships" ALTER COLUMN "status" TYPE "public"."memberships_status_enum" USING "status"::"public"."memberships_status_enum";
          ALTER TABLE "memberships" ALTER COLUMN "status" SET DEFAULT 'PENDING';
        END IF;
      END $$;
    `);

    // Update role column to use enum (if it's varchar)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'memberships' AND column_name = 'role' AND data_type = 'character varying') THEN
          UPDATE "memberships" SET "role" = 'MEMBER' WHERE "role" = 'member';
          UPDATE "memberships" SET "role" = 'ADMIN' WHERE "role" = 'admin';
          ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "public"."memberships_role_enum" USING "role"::"public"."memberships_role_enum";
          ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
        END IF;
      END $$;
    `);

    // Fix timestamp columns to use timezone
    await queryRunner.query(`
      ALTER TABLE "memberships"
        ALTER COLUMN "joined_at" TYPE TIMESTAMP WITH TIME ZONE,
        ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE,
        ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE;
    `);

    // Fix left_at if it exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'memberships' AND column_name = 'left_at') THEN
          ALTER TABLE "memberships" ALTER COLUMN "left_at" TYPE TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `);

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
    await queryRunner.query(`DROP TABLE IF EXISTS "job_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions" CASCADE`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sessions_device_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."jobs_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."job_history_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."memberships_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."memberships_role_enum"`);
  }
}
