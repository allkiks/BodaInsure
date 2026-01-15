import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Escrow Tracking Tables
 *
 * Per Accounting_Remediation.md - Epic 5
 *
 * Creates escrow tracking infrastructure:
 * - escrow_tracking: Tracks funds held before remittance to underwriter
 *
 * Escrow Types:
 * - DAY_1_IMMEDIATE: Day 1 premium remitted same-day to Definite
 * - DAYS_2_31_ACCUMULATED: Daily premiums accumulated for month-end bulk remittance
 *
 * Remittance Status:
 * - PENDING: Payment received, awaiting remittance scheduling
 * - SCHEDULED: Included in a remittance batch
 * - REMITTED: Successfully remitted to underwriter
 * - REFUNDED: Returned to rider (policy cancellation)
 */
export class CreateEscrowTracking1735300000000 implements MigrationInterface {
  name = 'CreateEscrowTracking1735300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create escrow_type_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "escrow_type_enum" AS ENUM (
          'DAY_1_IMMEDIATE',
          'DAYS_2_31_ACCUMULATED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Create remittance_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "remittance_status_enum" AS ENUM (
          'PENDING',
          'SCHEDULED',
          'REMITTED',
          'REFUNDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Create escrow_tracking table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_tracking" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "rider_id" UUID NOT NULL,
        "transaction_id" UUID NOT NULL,
        "payment_day" INT NOT NULL,
        "premium_amount" BIGINT NOT NULL,
        "service_fee_amount" BIGINT NOT NULL,
        "escrow_type" "escrow_type_enum" NOT NULL,
        "remittance_status" "remittance_status_enum" NOT NULL DEFAULT 'PENDING',
        "remittance_batch_id" UUID,
        "remitted_at" TIMESTAMPTZ,
        "bank_reference" VARCHAR(100),
        "journal_entry_id" UUID,
        "refund_transaction_id" UUID,
        "refunded_at" TIMESTAMPTZ,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrow_rider" ON "escrow_tracking"("rider_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrow_transaction" ON "escrow_tracking"("transaction_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrow_status" ON "escrow_tracking"("remittance_status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrow_batch" ON "escrow_tracking"("remittance_batch_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrow_type" ON "escrow_tracking"("escrow_type");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrow_created" ON "escrow_tracking"("created_at");
    `);

    // Create remittance_batches table for grouping remittances
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "remittance_batch_type_enum" AS ENUM (
          'DAY_1_IMMEDIATE',
          'MONTHLY_BULK'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "remittance_batch_status_enum" AS ENUM (
          'PENDING',
          'APPROVED',
          'PROCESSING',
          'COMPLETED',
          'FAILED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "remittance_batches" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "batch_number" VARCHAR(50) NOT NULL UNIQUE,
        "batch_type" "remittance_batch_type_enum" NOT NULL,
        "batch_date" DATE NOT NULL,
        "total_premium_amount" BIGINT NOT NULL DEFAULT 0,
        "total_records" INT NOT NULL DEFAULT 0,
        "status" "remittance_batch_status_enum" NOT NULL DEFAULT 'PENDING',
        "approved_by" UUID,
        "approved_at" TIMESTAMPTZ,
        "processed_at" TIMESTAMPTZ,
        "bank_reference" VARCHAR(100),
        "journal_entry_id" UUID,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for remittance_batches
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_remittance_batch_type" ON "remittance_batches"("batch_type");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_remittance_batch_status" ON "remittance_batches"("status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_remittance_batch_date" ON "remittance_batches"("batch_date");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_remittance_batch_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_remittance_batch_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_remittance_batch_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_created";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_batch";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_transaction";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_rider";`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "remittance_batches";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_tracking";`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "remittance_batch_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "remittance_batch_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "remittance_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "escrow_type_enum";`);
  }
}
