import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Accounting Tables Migration
 * Creates GL Infrastructure and Journal Entry system tables
 *
 * Per Accounting_Remediation.md - Epic 1 & Epic 2
 * This migration is idempotent - safe to run multiple times.
 */
export class CreateAccountingTables1735200000000 implements MigrationInterface {
  name = 'CreateAccountingTables1735200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // CREATE ENUMS
    // ============================================

    // GL Account enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "gl_account_type_enum" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "gl_account_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Journal Entry enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "journal_entry_type_enum" AS ENUM (
          'PAYMENT_RECEIPT_DAY1',
          'PAYMENT_RECEIPT_DAILY',
          'PREMIUM_REMITTANCE_DAY1',
          'PREMIUM_REMITTANCE_BULK',
          'SERVICE_FEE_DISTRIBUTION',
          'REFUND_INITIATION',
          'REFUND_EXECUTION',
          'COMMISSION_RECEIPT',
          'COMMISSION_DISTRIBUTION',
          'MANUAL_ADJUSTMENT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "journal_entry_status_enum" AS ENUM (
          'DRAFT',
          'PENDING_APPROVAL',
          'APPROVED',
          'POSTED',
          'REVERSED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ============================================
    // CREATE TABLES
    // ============================================

    // GL Accounts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gl_accounts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "account_code" varchar(20) NOT NULL UNIQUE,
        "account_name" varchar(100) NOT NULL,
        "account_type" gl_account_type_enum NOT NULL,
        "parent_id" uuid REFERENCES "gl_accounts"("id"),
        "description" text,
        "balance" bigint NOT NULL DEFAULT 0,
        "status" gl_account_status_enum NOT NULL DEFAULT 'ACTIVE',
        "is_system_account" boolean NOT NULL DEFAULT false,
        "normal_balance" varchar(10) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_gl_normal_balance" CHECK ("normal_balance" IN ('DEBIT', 'CREDIT'))
      );
    `);

    // Journal Entries table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "entry_number" varchar(50) NOT NULL UNIQUE,
        "entry_date" date NOT NULL,
        "entry_type" journal_entry_type_enum NOT NULL,
        "description" text NOT NULL,
        "status" journal_entry_status_enum NOT NULL DEFAULT 'DRAFT',
        "total_debit" bigint NOT NULL DEFAULT 0,
        "total_credit" bigint NOT NULL DEFAULT 0,
        "source_transaction_id" uuid,
        "source_entity_type" varchar(50),
        "source_entity_id" uuid,
        "rider_id" uuid,
        "created_by" uuid,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "posted_at" timestamptz,
        "reversed_by" uuid,
        "reversed_at" timestamptz,
        "reversal_reason" text,
        "reversing_entry_id" uuid REFERENCES "journal_entries"("id"),
        "original_entry_id" uuid REFERENCES "journal_entries"("id"),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_journal_balanced" CHECK ("total_debit" = "total_credit")
      );
    `);

    // Journal Entry Lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "journal_entry_id" uuid NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
        "gl_account_id" uuid NOT NULL REFERENCES "gl_accounts"("id"),
        "line_number" int NOT NULL,
        "debit_amount" bigint NOT NULL DEFAULT 0,
        "credit_amount" bigint NOT NULL DEFAULT 0,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_line_one_side" CHECK (
          ("debit_amount" > 0 AND "credit_amount" = 0) OR
          ("credit_amount" > 0 AND "debit_amount" = 0)
        ),
        UNIQUE ("journal_entry_id", "line_number")
      );
    `);

    // ============================================
    // CREATE INDEXES
    // ============================================

    // GL Accounts indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_gl_accounts_code" ON "gl_accounts"("account_code");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_gl_accounts_type" ON "gl_accounts"("account_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_gl_accounts_parent" ON "gl_accounts"("parent_id");
    `);

    // Journal Entries indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entries_date" ON "journal_entries"("entry_date");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entries_type" ON "journal_entries"("entry_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entries_status" ON "journal_entries"("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entries_source" ON "journal_entries"("source_transaction_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entries_rider" ON "journal_entries"("rider_id");
    `);

    // Journal Entry Lines indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entry_lines_entry" ON "journal_entry_lines"("journal_entry_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entry_lines_account" ON "journal_entry_lines"("gl_account_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "journal_entry_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "journal_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gl_accounts"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "journal_entry_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "journal_entry_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gl_account_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gl_account_type_enum"`);
  }
}
