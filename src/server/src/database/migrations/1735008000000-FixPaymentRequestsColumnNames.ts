import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Payment Requests Column Names Migration
 * Renames columns to match entity definitions
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixPaymentRequestsColumnNames1735008000000 implements MigrationInterface {
  name = 'FixPaymentRequestsColumnNames1735008000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // RENAME COLUMNS TO MATCH ENTITY EXPECTATIONS
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

    // Add checkout_request_id if it doesn't exist (in case the rename didn't happen)
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "checkout_request_id" varchar(100)
    `);

    // Add merchant_request_id if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "merchant_request_id" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rename back to original names
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'checkout_request_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'mpesa_checkout_request_id') THEN
          ALTER TABLE "payment_requests" RENAME COLUMN "checkout_request_id" TO "mpesa_checkout_request_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'merchant_request_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'mpesa_merchant_request_id') THEN
          ALTER TABLE "payment_requests" RENAME COLUMN "merchant_request_id" TO "mpesa_merchant_request_id";
        END IF;
      END $$;
    `);
  }
}
