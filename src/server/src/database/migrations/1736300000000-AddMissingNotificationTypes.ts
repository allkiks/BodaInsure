import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add missing notification type enum values
 *
 * The entity has more NotificationType values than the database enum.
 * This migration adds the missing values.
 */
export class AddMissingNotificationTypes1736300000000 implements MigrationInterface {
  name = 'AddMissingNotificationTypes1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Values that need to be added to notification_type_enum
    const missingValues = [
      'PAYMENT_RECEIVED',
      'PAYMENT_FAILED',
      'POLICY_EXPIRED',
      'POLICY_DOCUMENT',
      'KYC_APPROVED',
      'KYC_REJECTED',
      'WELCOME',
      'ACCOUNT_UPDATE',
      'SUPPORT',
    ];

    for (const value of missingValues) {
      try {
        await queryRunner.query(`
          ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS '${value}';
        `);
        console.log(`Added enum value: ${value}`);
      } catch (error) {
        // Value might already exist
        console.log(`Enum value '${value}' already exists or error: ${(error as Error).message}`);
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing values from enums
    console.warn(
      'WARNING: Cannot remove enum values from notification_type_enum. ' +
      'Manual intervention required if rollback is needed.',
    );
  }
}
