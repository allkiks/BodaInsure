import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix job_history table schema
 *
 * The job_history table is missing columns expected by the entity:
 * - job_name: snapshot of the job name
 * - ended_at: execution end time (table has completed_at)
 * - triggered_by: who triggered the job
 */
export class FixJobHistorySchema1736400000000 implements MigrationInterface {
  name = 'FixJobHistorySchema1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add job_name column
    await queryRunner.query(`
      ALTER TABLE "job_history"
      ADD COLUMN IF NOT EXISTS "job_name" varchar(100)
    `);

    // Populate job_name from jobs table
    await queryRunner.query(`
      UPDATE "job_history" jh
      SET "job_name" = j."name"
      FROM "jobs" j
      WHERE jh."job_id" = j."id" AND jh."job_name" IS NULL
    `);

    // Set default for any remaining nulls
    await queryRunner.query(`
      UPDATE "job_history"
      SET "job_name" = 'Unknown'
      WHERE "job_name" IS NULL
    `);

    // Add triggered_by column
    await queryRunner.query(`
      ALTER TABLE "job_history"
      ADD COLUMN IF NOT EXISTS "triggered_by" varchar(100) DEFAULT 'system'
    `);

    // Check if completed_at exists and ended_at doesn't
    const result = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'job_history' AND column_name IN ('completed_at', 'ended_at')
    `);

    const columns = result.map((r: { column_name: string }) => r.column_name);
    const hasCompletedAt = columns.includes('completed_at');
    const hasEndedAt = columns.includes('ended_at');

    if (hasCompletedAt && !hasEndedAt) {
      // Rename completed_at to ended_at
      await queryRunner.query(`
        ALTER TABLE "job_history"
        RENAME COLUMN "completed_at" TO "ended_at"
      `);
      console.log('Renamed completed_at to ended_at');
    } else if (!hasEndedAt) {
      // Add ended_at column
      await queryRunner.query(`
        ALTER TABLE "job_history"
        ADD COLUMN "ended_at" timestamp with time zone
      `);
      console.log('Added ended_at column');
    }

    console.log('Successfully fixed job_history schema');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rename ended_at back to completed_at
    await queryRunner.query(`
      ALTER TABLE "job_history"
      RENAME COLUMN "ended_at" TO "completed_at"
    `);

    // Remove added columns
    await queryRunner.query(`
      ALTER TABLE "job_history"
      DROP COLUMN IF EXISTS "job_name",
      DROP COLUMN IF EXISTS "triggered_by"
    `);
  }
}
