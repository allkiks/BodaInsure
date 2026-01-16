import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add SUPERUSER role to user_role_enum
 *
 * This migration adds the 'superuser' value to the user_role_enum type
 * to support the SUPERUSER system account.
 *
 * The SUPERUSER role is used for:
 * - System administration accounts
 * - Full platform access
 * - Emergency operations
 */
export class AddSuperuserRole1735900000000 implements MigrationInterface {
  name = 'AddSuperuserRole1735900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'superuser' to the user_role_enum
    // PostgreSQL requires recreating the enum type to add values in older versions,
    // but in PostgreSQL 9.1+ we can use ALTER TYPE ... ADD VALUE
    await queryRunner.query(`
      ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'superuser';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing values from enums directly.
    // To fully revert, we would need to:
    // 1. Create a new enum without 'superuser'
    // 2. Update all columns using the enum
    // 3. Drop the old enum
    // 4. Rename the new enum
    //
    // For safety, we only log a warning here since removing enum values
    // could cause data integrity issues if any users have this role.
    console.warn(
      'WARNING: Cannot remove enum value "superuser" from user_role_enum. ' +
      'Manual intervention required if rollback is needed.',
    );
  }
}
