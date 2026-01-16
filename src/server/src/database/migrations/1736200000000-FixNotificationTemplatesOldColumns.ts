import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix notification_templates old columns
 *
 * The table has old columns (type, content, language) with NOT NULL constraints
 * that conflict with the entity which uses new columns (notification_type, body, locale).
 * This migration:
 * 1. Makes old columns nullable or removes NOT NULL constraint
 * 2. Ensures data is migrated from old to new columns
 * 3. Sets proper defaults on new columns
 */
export class FixNotificationTemplatesOldColumns1736200000000 implements MigrationInterface {
  name = 'FixNotificationTemplatesOldColumns1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if old columns exist and make them nullable
    const columns = ['type', 'content', 'language'];

    for (const col of columns) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_templates' AND column_name = $1
      `, [col]);

      if (exists.length > 0) {
        console.log(`Making column '${col}' nullable...`);
        await queryRunner.query(`
          ALTER TABLE "notification_templates"
          ALTER COLUMN "${col}" DROP NOT NULL
        `);
      }
    }

    // Migrate data from old columns to new columns where new is null
    console.log('Migrating data from old columns to new columns...');

    // type -> notification_type
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "notification_type" = "type"
      WHERE "notification_type" IS NULL AND "type" IS NOT NULL
    `);

    // content -> body
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "body" = "content"
      WHERE "body" IS NULL AND "content" IS NOT NULL
    `);

    // language -> locale (need to handle enum to varchar conversion)
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "locale" = "language"::text
      WHERE "locale" IS NULL AND "language" IS NOT NULL
    `);

    // Now make the new columns NOT NULL where required by the entity
    // First, set defaults for any remaining nulls
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "notification_type" = 'OTP'
      WHERE "notification_type" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "body" = ''
      WHERE "body" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "locale" = 'en'
      WHERE "locale" IS NULL
    `);

    // Make code NOT NULL (it's required by the entity)
    // First ensure all rows have a code
    await queryRunner.query(`
      UPDATE "notification_templates"
      SET "code" = UPPER(REPLACE(REPLACE("name", ' ', '_'), '-', '_'))
      WHERE "code" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "code" SET NOT NULL
    `);

    // Make body NOT NULL
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "body" SET NOT NULL
    `);

    // Make notification_type NOT NULL
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "notification_type" SET NOT NULL
    `);

    // Make locale NOT NULL with default
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "locale" SET NOT NULL,
      ALTER COLUMN "locale" SET DEFAULT 'en'
    `);

    console.log('Successfully fixed notification_templates columns');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore NOT NULL on old columns
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "type" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "content" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "language" SET NOT NULL
    `);

    // Make new columns nullable again
    await queryRunner.query(`
      ALTER TABLE "notification_templates"
      ALTER COLUMN "code" DROP NOT NULL,
      ALTER COLUMN "body" DROP NOT NULL,
      ALTER COLUMN "notification_type" DROP NOT NULL,
      ALTER COLUMN "locale" DROP NOT NULL
    `);
  }
}
