import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix Payment Requests Type Column Migration
 * Makes the old 'type' column nullable since entity uses 'payment_type'
 *
 * This migration is idempotent - safe to run multiple times
 */
export class FixPaymentRequestsTypeColumn1735009000000 implements MigrationInterface {
  name = 'FixPaymentRequestsTypeColumn1735009000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make the old 'type' column nullable since entity uses 'payment_type'
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'type') THEN
          ALTER TABLE "payment_requests" ALTER COLUMN "type" DROP NOT NULL;
        END IF;
      END $$;
    `);

    // Set default for type column based on payment_type
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'type')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'payment_type') THEN
          UPDATE "payment_requests" SET "type" = "payment_type" WHERE "type" IS NULL AND "payment_type" IS NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Make type NOT NULL again
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_requests' AND column_name = 'type') THEN
          ALTER TABLE "payment_requests" ALTER COLUMN "type" SET NOT NULL;
        END IF;
      END $$;
    `);
  }
}
