import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Partner Settlement Tables
 *
 * Per Accounting_Remediation.md - Epic 6
 *
 * Creates tables for tracking partner settlements:
 * - partner_settlements: Settlement records for each partner
 * - settlement_line_items: Individual line items in a settlement
 */
export class CreatePartnerSettlements1735400000000 implements MigrationInterface {
  name = 'CreatePartnerSettlements1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create partner type enum
    await queryRunner.query(`
      CREATE TYPE partner_type_enum AS ENUM (
        'DEFINITE_ASSURANCE',
        'KBA',
        'ROBS_INSURANCE',
        'ATRONACH'
      )
    `);

    // Create settlement type enum
    await queryRunner.query(`
      CREATE TYPE settlement_type_enum AS ENUM (
        'SERVICE_FEE',
        'COMMISSION',
        'PREMIUM_REMITTANCE',
        'REVERSAL_FEE'
      )
    `);

    // Create settlement status enum
    await queryRunner.query(`
      CREATE TYPE settlement_status_enum AS ENUM (
        'PENDING',
        'APPROVED',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
      )
    `);

    // Create partner_settlements table
    await queryRunner.query(`
      CREATE TABLE partner_settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_number VARCHAR(50) NOT NULL UNIQUE,
        partner_type partner_type_enum NOT NULL,
        settlement_type settlement_type_enum NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_amount BIGINT NOT NULL DEFAULT 0,
        transaction_count INT NOT NULL DEFAULT 0,
        status settlement_status_enum NOT NULL DEFAULT 'PENDING',
        created_by UUID,
        approved_by UUID,
        approved_at TIMESTAMPTZ,
        bank_reference VARCHAR(100),
        bank_account VARCHAR(50),
        settled_at TIMESTAMPTZ,
        journal_entry_id UUID REFERENCES journal_entries(id),
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create settlement_line_items table
    await queryRunner.query(`
      CREATE TABLE settlement_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_id UUID NOT NULL REFERENCES partner_settlements(id) ON DELETE CASCADE,
        line_number INT NOT NULL,
        rider_id UUID,
        transaction_id UUID,
        escrow_id UUID,
        amount BIGINT NOT NULL,
        description TEXT,
        reference_date DATE,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (settlement_id, line_number)
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_partner_settlements_partner ON partner_settlements(partner_type)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_partner_settlements_type ON partner_settlements(settlement_type)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_partner_settlements_status ON partner_settlements(status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_partner_settlements_period ON partner_settlements(period_start, period_end)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_settlement_line_items_settlement ON settlement_line_items(settlement_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_settlement_line_items_rider ON settlement_line_items(rider_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_settlement_line_items_rider`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_settlement_line_items_settlement`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_partner_settlements_period`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_partner_settlements_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_partner_settlements_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_partner_settlements_partner`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS settlement_line_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS partner_settlements`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS settlement_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS settlement_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS partner_type_enum`);
  }
}
