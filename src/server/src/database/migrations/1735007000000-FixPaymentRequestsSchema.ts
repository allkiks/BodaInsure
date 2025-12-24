import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Payment Requests Schema Migration
 * Adds missing columns to payment_requests table to match entity definitions
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixPaymentRequestsSchema1735007000000 implements MigrationInterface {
  name = 'FixPaymentRequestsSchema1735007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // CREATE ENUMS FOR payment_requests
    // ============================================

    // Create payment_request_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_request_status_enum" AS ENUM ('INITIATED', 'SENT', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ============================================
    // ADD AND FIX COLUMNS IN payment_requests TABLE
    // ============================================

    // Add payment_type column (entity uses this instead of type)
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "payment_type" "transaction_type_enum" NOT NULL DEFAULT 'DEPOSIT'
    `);

    // Copy data from type to payment_type for existing records
    await queryRunner.query(`
      UPDATE "payment_requests" SET "payment_type" = "type" WHERE "payment_type" = 'DEPOSIT' AND "type" IS NOT NULL
    `);

    // Add account_reference column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "account_reference" varchar(50) NOT NULL DEFAULT 'BODA'
    `);

    // Add transaction_desc column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "transaction_desc" varchar(100) NOT NULL DEFAULT 'BodaInsure Payment'
    `);

    // Add response_code column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "response_code" varchar(10)
    `);

    // Add response_description column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "response_description" text
    `);

    // Add result_code column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "result_code" varchar(10)
    `);

    // Add result_description column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "result_description" text
    `);

    // Add mpesa_receipt_number column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "mpesa_receipt_number" varchar(50)
    `);

    // Add callback_received_at column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "callback_received_at" timestamptz
    `);

    // Add callback_payload column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "callback_payload" jsonb
    `);

    // Add callback_retries column
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "callback_retries" int NOT NULL DEFAULT 0
    `);

    // ============================================
    // RENAME COLUMNS TO MATCH ENTITY EXPECTATIONS
    // DB has mpesa_checkout_request_id but entity expects checkout_request_id
    // ============================================

    // Rename mpesa_checkout_request_id to checkout_request_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'mpesa_checkout_request_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'checkout_request_id') THEN
          ALTER TABLE "payment_requests" RENAME COLUMN "mpesa_checkout_request_id" TO "checkout_request_id";
        END IF;
      END $$;
    `);

    // Rename mpesa_merchant_request_id to merchant_request_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'mpesa_merchant_request_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'merchant_request_id') THEN
          ALTER TABLE "payment_requests" RENAME COLUMN "mpesa_merchant_request_id" TO "merchant_request_id";
        END IF;
      END $$;
    `);

    // ============================================
    // FIX status COLUMN TYPE
    // The status column uses transaction_status_enum but entity expects payment_request_status_enum
    // ============================================

    // Check and fix status column type
    await queryRunner.query(`
      DO $$
      DECLARE
        col_type text;
      BEGIN
        SELECT udt_name INTO col_type
        FROM information_schema.columns
        WHERE table_name = 'payment_requests' AND column_name = 'status';

        -- If column uses wrong enum type, convert it
        IF col_type IS NOT NULL AND col_type = 'transaction_status_enum' THEN
          -- Create a temp column
          ALTER TABLE "payment_requests" ADD COLUMN "status_new" "payment_request_status_enum" NOT NULL DEFAULT 'INITIATED';

          -- Map old values to new
          UPDATE "payment_requests" SET "status_new" =
            CASE
              WHEN "status"::text = 'PENDING' THEN 'INITIATED'::"payment_request_status_enum"
              WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'::"payment_request_status_enum"
              WHEN "status"::text = 'FAILED' THEN 'FAILED'::"payment_request_status_enum"
              ELSE 'INITIATED'::"payment_request_status_enum"
            END;

          -- Drop old column and rename new
          ALTER TABLE "payment_requests" DROP COLUMN "status";
          ALTER TABLE "payment_requests" RENAME COLUMN "status_new" TO "status";
        END IF;
      END $$;
    `);

    // ============================================
    // MAKE wallet_id NULLABLE (entity doesn't require it)
    // ============================================

    await queryRunner.query(`
      ALTER TABLE "payment_requests" ALTER COLUMN "wallet_id" DROP NOT NULL
    `);

    // Drop the foreign key constraint if it exists (allow null wallet_id)
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "payment_requests" DROP CONSTRAINT IF EXISTS "payment_requests_wallet_id_fkey";
      EXCEPTION WHEN undefined_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop added columns
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "callback_retries"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "callback_payload"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "callback_received_at"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "mpesa_receipt_number"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "result_description"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "result_code"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "response_description"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "response_code"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "transaction_desc"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "account_reference"`);
    await queryRunner.query(`ALTER TABLE "payment_requests" DROP COLUMN IF EXISTS "payment_type"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_request_status_enum"`);
  }
}
