import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Breach Incidents and Policy Terms tables
 * CR-DPA-003: Breach notification workflow
 * CR-IRA-003: Policy terms acknowledgment
 */
export class AddBreachAndPolicyTerms1734300000000 implements MigrationInterface {
  name = 'AddBreachAndPolicyTerms1734300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create breach_severity enum
    await queryRunner.query(`
      CREATE TYPE "breach_severity_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    `);

    // Create breach_status enum
    await queryRunner.query(`
      CREATE TYPE "breach_status_enum" AS ENUM (
        'DETECTED', 'INVESTIGATING', 'CONFIRMED', 'CONTAINED', 'NOTIFIED', 'RESOLVED', 'CLOSED'
      )
    `);

    // Create breach_type enum
    await queryRunner.query(`
      CREATE TYPE "breach_type_enum" AS ENUM (
        'UNAUTHORIZED_ACCESS', 'DATA_EXFILTRATION', 'CREDENTIAL_COMPROMISE',
        'SYSTEM_INTRUSION', 'INSIDER_THREAT', 'ACCIDENTAL_DISCLOSURE',
        'LOST_DEVICE', 'RANSOMWARE', 'PHISHING', 'OTHER'
      )
    `);

    // Create policy_terms_type enum
    await queryRunner.query(`
      CREATE TYPE "policy_terms_type_enum" AS ENUM ('TPO', 'COMPREHENSIVE')
    `);

    // Create breach_incidents table
    await queryRunner.query(`
      CREATE TABLE "breach_incidents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "incident_ref" varchar(50) NOT NULL,
        "breach_type" "breach_type_enum" NOT NULL,
        "severity" "breach_severity_enum" NOT NULL,
        "status" "breach_status_enum" NOT NULL DEFAULT 'DETECTED',
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "affected_data_types" text,
        "affected_users_count" int NOT NULL DEFAULT 0,
        "affected_user_ids" text,
        "detection_method" varchar(200),
        "detected_at" timestamptz NOT NULL,
        "occurred_at" timestamptz,
        "contained_at" timestamptz,
        "notified_at" timestamptz,
        "resolved_at" timestamptz,
        "reported_by" uuid,
        "assigned_to" uuid,
        "root_cause" text,
        "immediate_actions" text,
        "remediation_steps" text,
        "preventive_measures" text,
        "commissioner_notified" boolean NOT NULL DEFAULT false,
        "commissioner_notified_at" timestamptz,
        "users_notified" boolean NOT NULL DEFAULT false,
        "users_notified_at" timestamptz,
        "management_notified" boolean NOT NULL DEFAULT false,
        "management_notified_at" timestamptz,
        "timeline" jsonb,
        "related_audit_events" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_breach_incidents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_breach_incidents_ref" UNIQUE ("incident_ref")
      )
    `);

    // Create breach_incidents indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_breach_incidents_status_severity" ON "breach_incidents" ("status", "severity")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_breach_incidents_created_at" ON "breach_incidents" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_breach_incidents_detected_at" ON "breach_incidents" ("detected_at")
    `);

    // Create policy_terms table
    await queryRunner.query(`
      CREATE TABLE "policy_terms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "version" varchar(20) NOT NULL,
        "type" "policy_terms_type_enum" NOT NULL DEFAULT 'TPO',
        "title" varchar(200) NOT NULL,
        "content" text NOT NULL,
        "summary" text,
        "content_sw" text,
        "summary_sw" text,
        "key_terms" text,
        "key_terms_sw" text,
        "inclusions" text,
        "exclusions" text,
        "effective_from" timestamptz NOT NULL,
        "effective_to" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "underwriter_name" varchar(200) NOT NULL,
        "ira_approval_ref" varchar(100),
        "free_look_days" int NOT NULL DEFAULT 30,
        "cancellation_policy" text,
        "claims_process" text,
        "pdf_url" varchar(500),
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_terms" PRIMARY KEY ("id")
      )
    `);

    // Create policy_terms indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_policy_terms_version" ON "policy_terms" ("version")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_policy_terms_type_effective" ON "policy_terms" ("type", "effective_from")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_policy_terms_is_active" ON "policy_terms" ("is_active")
    `);

    // Create policy_terms_acknowledgments table
    await queryRunner.query(`
      CREATE TABLE "policy_terms_acknowledgments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "terms_id" uuid NOT NULL,
        "acknowledged_at" timestamptz NOT NULL,
        "ip_address" varchar(45),
        "user_agent" text,
        "channel" varchar(20) NOT NULL DEFAULT 'app',
        "policy_id" uuid,
        "consent_text" text,
        "terms_checksum" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_terms_acknowledgments" PRIMARY KEY ("id")
      )
    `);

    // Create policy_terms_acknowledgments indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_policy_terms_ack_user_terms" ON "policy_terms_acknowledgments" ("user_id", "terms_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_policy_terms_ack_user_date" ON "policy_terms_acknowledgments" ("user_id", "acknowledged_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_policy_terms_ack_terms" ON "policy_terms_acknowledgments" ("terms_id")
    `);

    // Add update trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_breach_incidents_updated_at
        BEFORE UPDATE ON breach_incidents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_policy_terms_updated_at
        BEFORE UPDATE ON policy_terms
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_breach_incidents_updated_at ON breach_incidents`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_policy_terms_updated_at ON policy_terms`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_terms_acknowledgments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_terms"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "breach_incidents"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_terms_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "breach_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "breach_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "breach_severity_enum"`);
  }
}
