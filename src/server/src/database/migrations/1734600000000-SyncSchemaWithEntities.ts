import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to synchronize database schema with entity definitions
 *
 * Adds missing columns to:
 * 1. users table - status, consent_given_at, last_login_at, failed_login_attempts, locked_until, reminder_opt_out
 * 2. organizations table - code, status, description, and many other fields
 *
 * IDEMPOTENT: All operations use IF NOT EXISTS patterns.
 * Safe to run multiple times.
 */
export class SyncSchemaWithEntities1734600000000 implements MigrationInterface {
  name = 'SyncSchemaWithEntities1734600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // CREATE ENUMS (if not exist)
    // ============================================

    // User status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
          CREATE TYPE "user_status_enum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');
        END IF;
      END $$;
    `);

    // User role enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
          CREATE TYPE "user_role_enum" AS ENUM ('rider', 'sacco_admin', 'kba_admin', 'insurance_admin', 'platform_admin');
        END IF;
      END $$;
    `);

    // KYC status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status_enum') THEN
          CREATE TYPE "kyc_status_enum" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'INCOMPLETE');
        END IF;
      END $$;
    `);

    // Language enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language_enum') THEN
          CREATE TYPE "language_enum" AS ENUM ('en', 'sw');
        END IF;
      END $$;
    `);

    // Gender enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
          CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other');
        END IF;
      END $$;
    `);

    // Organization type enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_type_enum') THEN
          CREATE TYPE "organization_type_enum" AS ENUM ('UMBRELLA_BODY', 'SACCO', 'ASSOCIATION', 'STAGE');
        END IF;
      END $$;
    `);

    // Organization status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status_enum') THEN
          CREATE TYPE "organization_status_enum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
        END IF;
      END $$;
    `);

    // ============================================
    // USERS TABLE - Add missing columns
    // ============================================

    // Add status column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
    `);

    // Add consent_given_at column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "consent_given_at" timestamp with time zone
    `);

    // Add last_login_at column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone
    `);

    // Add failed_login_attempts column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "failed_login_attempts" int NOT NULL DEFAULT 0
    `);

    // Add locked_until column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone
    `);

    // Add reminder_opt_out column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "reminder_opt_out" boolean NOT NULL DEFAULT false
    `);

    // Add index on status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_status" ON "users" ("status")
    `);

    // ============================================
    // ORGANIZATIONS TABLE - Add missing columns
    // ============================================

    // Add code column (required, unique)
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "code" varchar(20)
    `);

    // Generate unique codes for existing records without codes
    await queryRunner.query(`
      UPDATE "organizations"
      SET "code" = 'ORG-' || UPPER(SUBSTRING(id::text, 1, 8))
      WHERE "code" IS NULL
    `);

    // Make code NOT NULL and add unique constraint
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ALTER COLUMN "code" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organizations_code" ON "organizations" ("code")
    `);

    // Add status column (as varchar to match varchar pattern)
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
    `);

    // Migrate is_active to status (only if is_active column exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_active') THEN
          UPDATE "organizations"
          SET "status" = CASE WHEN "is_active" = true THEN 'ACTIVE' ELSE 'INACTIVE' END
          WHERE "status" = 'ACTIVE' AND "is_active" = false;
        END IF;
      END $$;
    `);

    // Add description column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "description" text
    `);

    // Add kra_pin column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "kra_pin" varchar(20)
    `);

    // Rename phone to contact_phone if exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'phone')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_phone') THEN
          ALTER TABLE "organizations" RENAME COLUMN "phone" TO "contact_phone";
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_phone') THEN
          ALTER TABLE "organizations" ADD COLUMN "contact_phone" varchar(20);
        END IF;
      END $$;
    `);

    // Rename email to contact_email if exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'email')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_email') THEN
          ALTER TABLE "organizations" RENAME COLUMN "email" TO "contact_email";
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_email') THEN
          ALTER TABLE "organizations" ADD COLUMN "contact_email" varchar(255);
        END IF;
      END $$;
    `);

    // Rename county to county_code if exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'county')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'county_code') THEN
          ALTER TABLE "organizations" RENAME COLUMN "county" TO "county_code";
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'county_code') THEN
          ALTER TABLE "organizations" ADD COLUMN "county_code" varchar(10);
        END IF;
      END $$;
    `);

    // Add latitude column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "latitude" decimal(10,7)
    `);

    // Add longitude column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "longitude" decimal(10,7)
    `);

    // Add leader columns
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "leader_name" varchar(200)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "leader_phone" varchar(20)
    `);

    // Add secretary columns
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "secretary_name" varchar(200)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "secretary_phone" varchar(20)
    `);

    // Add treasurer columns
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "treasurer_name" varchar(200)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "treasurer_phone" varchar(20)
    `);

    // Add member count columns
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "estimated_members" int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "verified_members" int NOT NULL DEFAULT 0
    `);

    // Add commission rate column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "commission_rate" decimal(5,2)
    `);

    // Add bank columns
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "bank_name" varchar(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "bank_account" varchar(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "bank_branch" varchar(100)
    `);

    // Add mpesa_number column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "mpesa_number" varchar(20)
    `);

    // Add logo_url column
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "logo_url" varchar(500)
    `);

    // Add verification columns
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone
    `);

    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "verified_by" uuid
    `);

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organizations_status" ON "organizations" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organizations_county_code" ON "organizations" ("county_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop organization indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_county_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_code"`);

    // Drop organization columns
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "verified_by"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "verified_at"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "logo_url"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "mpesa_number"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "bank_branch"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "bank_account"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "bank_name"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "commission_rate"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "verified_members"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "estimated_members"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "treasurer_phone"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "treasurer_name"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "secretary_phone"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "secretary_name"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "leader_phone"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "leader_name"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "longitude"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "latitude"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "kra_pin"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "code"`);

    // Drop user indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_status"`);

    // Drop user columns
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "reminder_opt_out"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_login_attempts"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_given_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "status"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gender_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "language_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum"`);
  }
}
