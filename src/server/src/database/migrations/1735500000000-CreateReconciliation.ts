import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Reconciliation Tables
 *
 * Per Accounting_Remediation.md - Epic 8
 *
 * Creates tables for reconciliation:
 * - reconciliation_records: Daily/monthly reconciliation runs
 * - reconciliation_items: Individual items being reconciled
 */
export class CreateReconciliation1735500000000 implements MigrationInterface {
  name = 'CreateReconciliation1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create reconciliation type enum
    await queryRunner.query(`
      CREATE TYPE reconciliation_type_enum AS ENUM (
        'DAILY_MPESA',
        'MONTHLY_BANK',
        'PARTNER_SETTLEMENT'
      )
    `);

    // Create reconciliation status enum
    await queryRunner.query(`
      CREATE TYPE reconciliation_status_enum AS ENUM (
        'PENDING',
        'IN_PROGRESS',
        'MATCHED',
        'UNMATCHED',
        'RESOLVED'
      )
    `);

    // Create reconciliation_records table
    await queryRunner.query(`
      CREATE TABLE reconciliation_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_type reconciliation_type_enum NOT NULL,
        reconciliation_date DATE NOT NULL,
        source_name VARCHAR(100) NOT NULL,
        source_balance BIGINT NOT NULL DEFAULT 0,
        ledger_balance BIGINT NOT NULL DEFAULT 0,
        variance BIGINT NOT NULL DEFAULT 0,
        status reconciliation_status_enum NOT NULL DEFAULT 'PENDING',
        total_items INT NOT NULL DEFAULT 0,
        matched_count INT NOT NULL DEFAULT 0,
        unmatched_count INT NOT NULL DEFAULT 0,
        auto_matched_count INT NOT NULL DEFAULT 0,
        manual_matched_count INT NOT NULL DEFAULT 0,
        created_by UUID,
        resolved_by UUID,
        resolved_at TIMESTAMPTZ,
        resolution_notes TEXT,
        source_file_path VARCHAR(500),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create reconciliation_items table
    await queryRunner.query(`
      CREATE TABLE reconciliation_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id) ON DELETE CASCADE,
        line_number INT NOT NULL,
        source_reference VARCHAR(100),
        source_amount BIGINT,
        source_date DATE,
        source_description TEXT,
        ledger_transaction_id UUID,
        ledger_amount BIGINT,
        ledger_date DATE,
        ledger_description TEXT,
        status reconciliation_status_enum NOT NULL DEFAULT 'PENDING',
        variance BIGINT DEFAULT 0,
        match_type VARCHAR(50),
        match_confidence DECIMAL(5, 2),
        resolved_by UUID,
        resolved_at TIMESTAMPTZ,
        resolution_notes TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (reconciliation_id, line_number)
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_reconciliation_records_type ON reconciliation_records(reconciliation_type)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reconciliation_records_date ON reconciliation_records(reconciliation_date)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reconciliation_records_status ON reconciliation_records(status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reconciliation_items_reconciliation ON reconciliation_items(reconciliation_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reconciliation_items_status ON reconciliation_items(status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reconciliation_items_source_ref ON reconciliation_items(source_reference)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reconciliation_items_source_ref`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reconciliation_items_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reconciliation_items_reconciliation`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reconciliation_records_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reconciliation_records_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reconciliation_records_type`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS reconciliation_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS reconciliation_records`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS reconciliation_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS reconciliation_type_enum`);
  }
}
