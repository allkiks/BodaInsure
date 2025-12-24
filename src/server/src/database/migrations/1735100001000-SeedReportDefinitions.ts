import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds default report definitions.
 * This migration is idempotent - it only inserts if the report doesn't already exist.
 */
export class SeedReportDefinitions1735100001000 implements MigrationInterface {
  name = 'SeedReportDefinitions1735100001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed default report definitions using INSERT ... ON CONFLICT DO NOTHING
    // Note: Using CUSTOM for Financial Summary since FINANCIAL enum value doesn't exist in the database
    await queryRunner.query(`
      INSERT INTO report_definitions (name, description, type, query, default_format, available_formats, frequency, is_active)
      VALUES
        ('Enrollment Report', 'User enrollment statistics including registration dates, KYC status, and demographics', 'ENROLLMENT'::report_type_enum, 'SELECT * FROM users WHERE role = ''rider''', 'CSV'::report_format_enum, 'JSON,CSV,EXCEL', 'MANUAL'::report_frequency_enum, true),
        ('Payment Report', 'Payment transactions including deposits, daily payments, and payment status', 'PAYMENT'::report_type_enum, 'SELECT * FROM transactions', 'CSV'::report_format_enum, 'JSON,CSV,EXCEL', 'MANUAL'::report_frequency_enum, true),
        ('Policy Report', 'Policy issuance and status report including active, expired, and lapsed policies', 'POLICY'::report_type_enum, 'SELECT * FROM policies', 'CSV'::report_format_enum, 'JSON,CSV,EXCEL', 'MANUAL'::report_frequency_enum, true),
        ('Organization Report', 'SACCO and organization membership statistics and performance metrics', 'ORGANIZATION'::report_type_enum, 'SELECT * FROM organizations', 'CSV'::report_format_enum, 'JSON,CSV,EXCEL', 'MANUAL'::report_frequency_enum, true),
        ('Financial Summary', 'Financial summary including revenue, collections, and wallet balances', 'CUSTOM'::report_type_enum, 'SELECT * FROM wallets', 'CSV'::report_format_enum, 'JSON,CSV,EXCEL,PDF', 'MANUAL'::report_frequency_enum, true),
        ('KYC Status Report', 'KYC verification status and document submission statistics', 'CUSTOM'::report_type_enum, 'SELECT * FROM documents', 'CSV'::report_format_enum, 'JSON,CSV,EXCEL', 'MANUAL'::report_frequency_enum, true)
      ON CONFLICT (name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded report definitions
    const names = [
      'Enrollment Report',
      'Payment Report',
      'Policy Report',
      'Organization Report',
      'Financial Summary',
      'KYC Status Report',
    ];

    for (const name of names) {
      await queryRunner.query(`DELETE FROM report_definitions WHERE name = $1`, [name]);
    }
  }
}
