import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix reporting schema mismatches between entities and database.
 * All operations are idempotent - safe to run multiple times.
 */
export class FixReportingSchema1735100000000 implements MigrationInterface {
  name = 'FixReportingSchema1735100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // FIX report_definitions TABLE
    // =====================================================

    // Add available_formats column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'report_definitions' AND column_name = 'available_formats'
        ) THEN
          ALTER TABLE report_definitions ADD COLUMN available_formats TEXT DEFAULT 'JSON,CSV';
        END IF;
      END $$;
    `);

    // Create report_frequency_enum if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_frequency_enum') THEN
          CREATE TYPE report_frequency_enum AS ENUM ('MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');
        END IF;
      END $$;
    `);

    // Add frequency column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'report_definitions' AND column_name = 'frequency'
        ) THEN
          ALTER TABLE report_definitions ADD COLUMN frequency report_frequency_enum DEFAULT 'MANUAL';
        END IF;
      END $$;
    `);

    // Add config column if not exists (consolidates query, parameters, recipients)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'report_definitions' AND column_name = 'config'
        ) THEN
          ALTER TABLE report_definitions ADD COLUMN config JSONB;
          -- Migrate existing data into config
          UPDATE report_definitions
          SET config = jsonb_build_object(
            'query', query,
            'parameters', parameters,
            'recipients', recipients
          )
          WHERE config IS NULL AND (query IS NOT NULL OR parameters IS NOT NULL OR recipients IS NOT NULL);
        END IF;
      END $$;
    `);

    // Add last_scheduled_run column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'report_definitions' AND column_name = 'last_scheduled_run'
        ) THEN
          ALTER TABLE report_definitions ADD COLUMN last_scheduled_run TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `);

    // Add required_roles column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'report_definitions' AND column_name = 'required_roles'
        ) THEN
          ALTER TABLE report_definitions ADD COLUMN required_roles TEXT;
        END IF;
      END $$;
    `);

    // Add organization_id column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'report_definitions' AND column_name = 'organization_id'
        ) THEN
          ALTER TABLE report_definitions ADD COLUMN organization_id UUID;
        END IF;
      END $$;
    `);

    // =====================================================
    // FIX generated_reports TABLE
    // =====================================================

    // Rename definition_id to report_definition_id if needed
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'definition_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'report_definition_id'
        ) THEN
          -- Drop the old foreign key constraint first
          ALTER TABLE generated_reports DROP CONSTRAINT IF EXISTS generated_reports_definition_id_fkey;
          -- Rename the column
          ALTER TABLE generated_reports RENAME COLUMN definition_id TO report_definition_id;
          -- Re-add the foreign key constraint with new column name
          ALTER TABLE generated_reports
            ADD CONSTRAINT generated_reports_report_definition_id_fkey
            FOREIGN KEY (report_definition_id) REFERENCES report_definitions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Add start_date column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'start_date'
        ) THEN
          ALTER TABLE generated_reports ADD COLUMN start_date DATE;
        END IF;
      END $$;
    `);

    // Add end_date column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'end_date'
        ) THEN
          ALTER TABLE generated_reports ADD COLUMN end_date DATE;
        END IF;
      END $$;
    `);

    // Add organization_id column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'organization_id'
        ) THEN
          ALTER TABLE generated_reports ADD COLUMN organization_id UUID;
        END IF;
      END $$;
    `);

    // Rename file_path to file_url if needed
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'file_path'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'file_url'
        ) THEN
          ALTER TABLE generated_reports RENAME COLUMN file_path TO file_url;
        END IF;
      END $$;
    `);

    // Rename row_count to record_count if needed
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'row_count'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'record_count'
        ) THEN
          ALTER TABLE generated_reports RENAME COLUMN row_count TO record_count;
        END IF;
      END $$;
    `);

    // Add processing_time_ms column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'processing_time_ms'
        ) THEN
          ALTER TABLE generated_reports ADD COLUMN processing_time_ms INTEGER;
        END IF;
      END $$;
    `);

    // Add data column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'data'
        ) THEN
          ALTER TABLE generated_reports ADD COLUMN data JSONB;
        END IF;
      END $$;
    `);

    // Rename requested_by to user_id if needed
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'requested_by'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE generated_reports RENAME COLUMN requested_by TO user_id;
        END IF;
      END $$;
    `);

    // Create indexes if not exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_reports_user_status ON generated_reports(user_id, status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON generated_reports(created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_reports_org_id ON generated_reports(organization_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_report_definitions_org_id ON report_definitions(organization_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the renames and drop added columns
    // Note: This is destructive and should be used with caution

    // Drop new indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_generated_reports_org_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_report_definitions_org_id;`);

    // Rename user_id back to requested_by
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'user_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'requested_by'
        ) THEN
          ALTER TABLE generated_reports RENAME COLUMN user_id TO requested_by;
        END IF;
      END $$;
    `);

    // Rename record_count back to row_count
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'record_count'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'row_count'
        ) THEN
          ALTER TABLE generated_reports RENAME COLUMN record_count TO row_count;
        END IF;
      END $$;
    `);

    // Rename file_url back to file_path
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'file_url'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'file_path'
        ) THEN
          ALTER TABLE generated_reports RENAME COLUMN file_url TO file_path;
        END IF;
      END $$;
    `);

    // Rename report_definition_id back to definition_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'report_definition_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'generated_reports' AND column_name = 'definition_id'
        ) THEN
          ALTER TABLE generated_reports DROP CONSTRAINT IF EXISTS generated_reports_report_definition_id_fkey;
          ALTER TABLE generated_reports RENAME COLUMN report_definition_id TO definition_id;
          ALTER TABLE generated_reports
            ADD CONSTRAINT generated_reports_definition_id_fkey
            FOREIGN KEY (definition_id) REFERENCES report_definitions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Drop added columns from generated_reports
    await queryRunner.query(`ALTER TABLE generated_reports DROP COLUMN IF EXISTS data;`);
    await queryRunner.query(`ALTER TABLE generated_reports DROP COLUMN IF EXISTS processing_time_ms;`);
    await queryRunner.query(`ALTER TABLE generated_reports DROP COLUMN IF EXISTS organization_id;`);
    await queryRunner.query(`ALTER TABLE generated_reports DROP COLUMN IF EXISTS end_date;`);
    await queryRunner.query(`ALTER TABLE generated_reports DROP COLUMN IF EXISTS start_date;`);

    // Drop added columns from report_definitions
    await queryRunner.query(`ALTER TABLE report_definitions DROP COLUMN IF EXISTS organization_id;`);
    await queryRunner.query(`ALTER TABLE report_definitions DROP COLUMN IF EXISTS required_roles;`);
    await queryRunner.query(`ALTER TABLE report_definitions DROP COLUMN IF EXISTS last_scheduled_run;`);
    await queryRunner.query(`ALTER TABLE report_definitions DROP COLUMN IF EXISTS config;`);
    await queryRunner.query(`ALTER TABLE report_definitions DROP COLUMN IF EXISTS frequency;`);
    await queryRunner.query(`ALTER TABLE report_definitions DROP COLUMN IF EXISTS available_formats;`);
  }
}
