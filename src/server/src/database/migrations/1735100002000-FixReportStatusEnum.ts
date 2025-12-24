import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes report_status_enum to include PROCESSING and EXPIRED values.
 * This migration is idempotent - it only adds values if they don't exist.
 *
 * Database has: PENDING, GENERATING, COMPLETED, FAILED
 * Entity needs: PENDING, PROCESSING, COMPLETED, FAILED, EXPIRED
 *
 * NOTE: ADD VALUE cannot be used in a transaction and the new value
 * cannot be used until after the transaction commits. So we only
 * add the enum values here - any data updates must happen in a separate migration.
 */
export class FixReportStatusEnum1735100002000 implements MigrationInterface {
  name = 'FixReportStatusEnum1735100002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add PROCESSING to enum if it doesn't exist
    // Using IF NOT EXISTS for idempotency (PostgreSQL 9.3+)
    await queryRunner.query(`
      ALTER TYPE report_status_enum ADD VALUE IF NOT EXISTS 'PROCESSING'
    `);

    // Add EXPIRED to enum if it doesn't exist
    await queryRunner.query(`
      ALTER TYPE report_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'
    `);

    // Note: Cannot update existing GENERATING records to PROCESSING in same transaction
    // The new enum values must be committed first
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing enum values easily
    // Just update any PROCESSING back to PENDING
    await queryRunner.query(`
      UPDATE generated_reports
      SET status = 'PENDING'::report_status_enum
      WHERE status = 'PROCESSING'::report_status_enum
    `);

    await queryRunner.query(`
      UPDATE generated_reports
      SET status = 'FAILED'::report_status_enum
      WHERE status = 'EXPIRED'::report_status_enum
    `);
  }
}
