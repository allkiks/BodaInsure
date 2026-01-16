import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Force fix required_variables column type
 *
 * The required_variables column was created as text[] but the entity
 * expects jsonb. This migration forcefully converts it.
 */
export class FixRequiredVariablesColumn1736100000000 implements MigrationInterface {
  name = 'FixRequiredVariablesColumn1736100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check current column type
    const result = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'notification_templates'
      AND column_name = 'required_variables'
    `);

    if (result.length > 0) {
      const { data_type, udt_name } = result[0];
      console.log(`Current required_variables column: data_type=${data_type}, udt_name=${udt_name}`);

      // If it's an array type, convert to jsonb
      if (data_type === 'ARRAY' || udt_name === '_text') {
        console.log('Converting required_variables from text[] to jsonb...');

        // First, backup existing data by converting array to jsonb format
        await queryRunner.query(`
          ALTER TABLE "notification_templates"
          ADD COLUMN IF NOT EXISTS "required_variables_backup" jsonb
        `);

        // Convert existing text[] data to jsonb (empty array if null)
        await queryRunner.query(`
          UPDATE "notification_templates"
          SET "required_variables_backup" = COALESCE(to_jsonb("required_variables"), '[]'::jsonb)
        `);

        // Drop the old column
        await queryRunner.query(`
          ALTER TABLE "notification_templates"
          DROP COLUMN "required_variables"
        `);

        // Rename backup to required_variables
        await queryRunner.query(`
          ALTER TABLE "notification_templates"
          RENAME COLUMN "required_variables_backup" TO "required_variables"
        `);

        // Set default
        await queryRunner.query(`
          ALTER TABLE "notification_templates"
          ALTER COLUMN "required_variables" SET DEFAULT '[]'::jsonb
        `);

        console.log('Successfully converted required_variables to jsonb');
      } else {
        console.log('Column is already jsonb or compatible type, skipping conversion');
      }
    } else {
      // Column doesn't exist, create it
      console.log('Creating required_variables column as jsonb...');
      await queryRunner.query(`
        ALTER TABLE "notification_templates"
        ADD COLUMN "required_variables" jsonb DEFAULT '[]'::jsonb
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Convert back to text[] if needed
    const result = await queryRunner.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'notification_templates'
      AND column_name = 'required_variables'
    `);

    if (result.length > 0 && result[0].data_type === 'jsonb') {
      // Create backup as text[]
      await queryRunner.query(`
        ALTER TABLE "notification_templates"
        ADD COLUMN "required_variables_backup" text[]
      `);

      // Convert jsonb to text[]
      await queryRunner.query(`
        UPDATE "notification_templates"
        SET "required_variables_backup" = ARRAY(SELECT jsonb_array_elements_text("required_variables"))
        WHERE "required_variables" IS NOT NULL
      `);

      // Drop and rename
      await queryRunner.query(`
        ALTER TABLE "notification_templates"
        DROP COLUMN "required_variables"
      `);

      await queryRunner.query(`
        ALTER TABLE "notification_templates"
        RENAME COLUMN "required_variables_backup" TO "required_variables"
      `);
    }
  }
}
