import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Rider Refunds Table
 *
 * Creates the rider_refunds table to track refund requests
 * from policy cancellations.
 *
 * Links to GL account 2101 (Refund Payable to Riders).
 */
export class CreateRiderRefundsTable1735600000000 implements MigrationInterface {
  name = 'CreateRiderRefundsTable1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "refund_status_enum" AS ENUM (
          'PENDING',
          'APPROVED',
          'PROCESSING',
          'COMPLETED',
          'FAILED',
          'CANCELLED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "refund_payout_method_enum" AS ENUM (
          'MPESA',
          'WALLET',
          'BANK'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create rider_refunds table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rider_refunds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "refundNumber" varchar(50) NOT NULL,
        "userId" uuid NOT NULL,
        "policyId" uuid NOT NULL,
        "refundAmountCents" bigint NOT NULL,
        "reversalFeeCents" bigint NOT NULL,
        "originalAmountCents" bigint NOT NULL,
        "daysPaid" int NOT NULL DEFAULT 0,
        "status" "refund_status_enum" NOT NULL DEFAULT 'PENDING',
        "payoutMethod" "refund_payout_method_enum" NOT NULL DEFAULT 'MPESA',
        "payoutPhone" varchar(20),
        "mpesaTransactionId" varchar(100),
        "mpesaConversationId" varchar(100),
        "cancellationReason" text,
        "journalEntryId" uuid,
        "approvedBy" uuid,
        "approvedAt" timestamptz,
        "processedBy" uuid,
        "processedAt" timestamptz,
        "completedAt" timestamptz,
        "failureReason" text,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rider_refunds" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rider_refunds_refundNumber" UNIQUE ("refundNumber")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rider_refunds_userId" ON "rider_refunds" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rider_refunds_policyId" ON "rider_refunds" ("policyId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rider_refunds_status" ON "rider_refunds" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_rider_refunds_createdAt" ON "rider_refunds" ("createdAt");
    `);

    // Add foreign key to policies table (if it exists)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "rider_refunds"
        ADD CONSTRAINT "FK_rider_refunds_policy"
        FOREIGN KEY ("policyId") REFERENCES "policies"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
      END $$;
    `);

    console.log('Created rider_refunds table with indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "rider_refunds" DROP CONSTRAINT IF EXISTS "FK_rider_refunds_policy";
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rider_refunds_createdAt";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rider_refunds_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rider_refunds_policyId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rider_refunds_userId";`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "rider_refunds";`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "refund_payout_method_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "refund_status_enum";`);

    console.log('Dropped rider_refunds table');
  }
}
