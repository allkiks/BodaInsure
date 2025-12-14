import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial database schema migration
 *
 * This migration creates all tables required for the BodaInsure platform.
 * Tables follow the module structure defined in CLAUDE.md Section 4.3.
 */
export class InitialSchema1734200000000 implements MigrationInterface {
  name = 'InitialSchema1734200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ============================================
    // IDENTITY MODULE TABLES
    // ============================================

    // Users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" varchar(20) NOT NULL,
        "phone_hash" varchar(64),
        "email" varchar(255),
        "first_name" varchar(100),
        "last_name" varchar(100),
        "full_name" varchar(255),
        "national_id" varchar(255),
        "kra_pin" varchar(255),
        "date_of_birth" date,
        "gender" varchar(10),
        "role" varchar(50) NOT NULL DEFAULT 'rider',
        "kyc_status" varchar(20) NOT NULL DEFAULT 'pending',
        "language" varchar(5) NOT NULL DEFAULT 'en',
        "terms_accepted_at" timestamp,
        "is_active" boolean NOT NULL DEFAULT true,
        "organization_id" uuid,
        "sacco_membership_number" varchar(50),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_users_phone" ON "users" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_phone_hash" ON "users" ("phone_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_kyc_status" ON "users" ("kyc_status")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_organization" ON "users" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_created_at" ON "users" ("created_at")`);

    // OTPs table
    await queryRunner.query(`
      CREATE TABLE "otps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" varchar(20) NOT NULL,
        "code" varchar(6) NOT NULL,
        "purpose" varchar(20) NOT NULL DEFAULT 'login',
        "attempts" int NOT NULL DEFAULT 0,
        "expires_at" timestamp NOT NULL,
        "verified_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otps" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_otps_phone" ON "otps" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_otps_expires_at" ON "otps" ("expires_at")`);

    // Sessions table
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "device_info" jsonb,
        "ip_address" varchar(45),
        "user_agent" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "expires_at" timestamp NOT NULL,
        "last_activity_at" timestamp NOT NULL DEFAULT now(),
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_sessions_user" ON "sessions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_token" ON "sessions" ("token_hash")`);

    // ============================================
    // ORGANIZATION MODULE TABLES
    // ============================================

    // Organizations table
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "registration_number" varchar(50),
        "phone" varchar(20),
        "email" varchar(255),
        "address" text,
        "county" varchar(100),
        "sub_county" varchar(100),
        "ward" varchar(100),
        "parent_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organizations_parent" FOREIGN KEY ("parent_id") REFERENCES "organizations"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_organizations_type" ON "organizations" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_organizations_parent" ON "organizations" ("parent_id")`);

    // Add foreign key from users to organizations
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "FK_users_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL
    `);

    // Memberships table
    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "membership_number" varchar(50),
        "role" varchar(50) NOT NULL DEFAULT 'member',
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "joined_at" timestamp NOT NULL DEFAULT now(),
        "left_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_memberships_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_memberships_user_org" UNIQUE ("user_id", "organization_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_memberships_user" ON "memberships" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_memberships_organization" ON "memberships" ("organization_id")`);

    // Geography table
    await queryRunner.query(`
      CREATE TABLE "geography" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "code" varchar(50),
        "parent_id" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_geography" PRIMARY KEY ("id"),
        CONSTRAINT "FK_geography_parent" FOREIGN KEY ("parent_id") REFERENCES "geography"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_geography_type" ON "geography" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_geography_code" ON "geography" ("code")`);

    // ============================================
    // KYC MODULE TABLES
    // ============================================

    // Documents table
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "file_path" varchar(500) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "file_size" int NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "rejection_reason" text,
        "reviewed_by" uuid,
        "reviewed_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_documents_user" ON "documents" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_documents_type" ON "documents" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_documents_status" ON "documents" ("status")`);

    // KYC Validations table
    await queryRunner.query(`
      CREATE TABLE "kyc_validations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "document_id" uuid,
        "validation_type" varchar(50) NOT NULL,
        "result" varchar(20) NOT NULL,
        "score" decimal(5,2),
        "details" jsonb,
        "validated_by" varchar(100),
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_validations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_kyc_validations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_kyc_validations_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_kyc_validations_user" ON "kyc_validations" ("user_id")`);

    // ============================================
    // PAYMENT MODULE TABLES
    // ============================================

    // Wallets table
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "balance" decimal(12,2) NOT NULL DEFAULT 0,
        "total_deposited" decimal(12,2) NOT NULL DEFAULT 0,
        "total_withdrawn" decimal(12,2) NOT NULL DEFAULT 0,
        "deposit_paid" boolean NOT NULL DEFAULT false,
        "deposit_amount" decimal(12,2),
        "deposit_paid_at" timestamp,
        "daily_payments_count" int NOT NULL DEFAULT 0,
        "last_daily_payment_at" timestamp,
        "policy_1_eligible" boolean NOT NULL DEFAULT false,
        "policy_2_eligible" boolean NOT NULL DEFAULT false,
        "grace_period_start" timestamp,
        "lapse_status" varchar(20),
        "currency" varchar(3) NOT NULL DEFAULT 'KES',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_wallets_user" UNIQUE ("user_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_wallets_user" ON "wallets" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallets_policy_eligible" ON "wallets" ("policy_1_eligible", "policy_2_eligible")`);

    // Transactions table
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "wallet_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "balance_before" decimal(12,2) NOT NULL,
        "balance_after" decimal(12,2) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "reference" varchar(100),
        "external_reference" varchar(100),
        "description" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transactions_wallet" ON "transactions" ("wallet_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_user" ON "transactions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_type" ON "transactions" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_reference" ON "transactions" ("reference")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_created_at" ON "transactions" ("created_at")`);

    // Payment Requests table (M-Pesa STK Push)
    await queryRunner.query(`
      CREATE TABLE "payment_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "wallet_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "checkout_request_id" varchar(100),
        "merchant_request_id" varchar(100),
        "mpesa_receipt_number" varchar(50),
        "result_code" varchar(10),
        "result_desc" text,
        "idempotency_key" varchar(100),
        "days_count" int,
        "callback_received_at" timestamp,
        "expires_at" timestamp NOT NULL,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payment_requests_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_payment_requests_user" ON "payment_requests" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_requests_status" ON "payment_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_requests_checkout" ON "payment_requests" ("checkout_request_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_requests_idempotency" ON "payment_requests" ("idempotency_key")`);

    // ============================================
    // POLICY MODULE TABLES
    // ============================================

    // Policies table
    await queryRunner.query(`
      CREATE TABLE "policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "policy_number" varchar(50) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "vehicle_registration" varchar(20),
        "vehicle_type" varchar(50),
        "premium_amount" decimal(12,2) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "issued_at" timestamp,
        "cancelled_at" timestamp,
        "cancellation_reason" text,
        "underwriter_policy_number" varchar(100),
        "underwriter_response" jsonb,
        "batch_id" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "PK_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_policies_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_policies_number" UNIQUE ("policy_number")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_policies_user" ON "policies" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_policies_number" ON "policies" ("policy_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_policies_status" ON "policies" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_policies_type" ON "policies" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_policies_vehicle" ON "policies" ("vehicle_registration")`);
    await queryRunner.query(`CREATE INDEX "IDX_policies_dates" ON "policies" ("start_date", "end_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_policies_batch" ON "policies" ("batch_id")`);

    // Policy Documents table
    await queryRunner.query(`
      CREATE TABLE "policy_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "policy_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "file_path" varchar(500) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "file_size" int NOT NULL,
        "generated_at" timestamp NOT NULL DEFAULT now(),
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_policy_documents_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_policy_documents_policy" ON "policy_documents" ("policy_id")`);

    // Policy Batches table
    await queryRunner.query(`
      CREATE TABLE "policy_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_number" varchar(50) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "scheduled_at" timestamp NOT NULL,
        "started_at" timestamp,
        "completed_at" timestamp,
        "total_policies" int NOT NULL DEFAULT 0,
        "processed_policies" int NOT NULL DEFAULT 0,
        "successful_policies" int NOT NULL DEFAULT 0,
        "failed_policies" int NOT NULL DEFAULT 0,
        "error_log" jsonb,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_batches" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_batches_number" UNIQUE ("batch_number")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_policy_batches_status" ON "policy_batches" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_policy_batches_scheduled" ON "policy_batches" ("scheduled_at")`);

    // Add foreign key from policies to batches
    await queryRunner.query(`
      ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_batch"
      FOREIGN KEY ("batch_id") REFERENCES "policy_batches"("id") ON DELETE SET NULL
    `);

    // ============================================
    // NOTIFICATION MODULE TABLES
    // ============================================

    // Notification Templates table
    await queryRunner.query(`
      CREATE TABLE "notification_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "type" varchar(50) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "subject" varchar(255),
        "body_template" text NOT NULL,
        "variables" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_templates_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_notification_templates_type" ON "notification_templates" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_templates_channel" ON "notification_templates" ("channel")`);

    // Notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "template_id" uuid,
        "type" varchar(50) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "recipient" varchar(255) NOT NULL,
        "subject" varchar(255),
        "body" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "sent_at" timestamp,
        "delivered_at" timestamp,
        "read_at" timestamp,
        "failed_at" timestamp,
        "failure_reason" text,
        "retry_count" int NOT NULL DEFAULT 0,
        "external_id" varchar(100),
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_template" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_notifications_user" ON "notifications" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_type" ON "notifications" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_status" ON "notifications" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_created_at" ON "notifications" ("created_at")`);

    // Notification Preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "type" varchar(50) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_notification_preferences" UNIQUE ("user_id", "channel", "type")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_notification_preferences_user" ON "notification_preferences" ("user_id")`);

    // ============================================
    // REPORTING MODULE TABLES
    // ============================================

    // Report Definitions table
    await queryRunner.query(`
      CREATE TABLE "report_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "type" varchar(50) NOT NULL,
        "query" text NOT NULL,
        "parameters" jsonb,
        "output_format" varchar(20) NOT NULL DEFAULT 'csv',
        "schedule" varchar(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_definitions_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_report_definitions_type" ON "report_definitions" ("type")`);

    // Generated Reports table
    await queryRunner.query(`
      CREATE TABLE "generated_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "definition_id" uuid,
        "name" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "file_path" varchar(500),
        "file_name" varchar(255),
        "file_size" int,
        "parameters" jsonb,
        "started_at" timestamp,
        "completed_at" timestamp,
        "error" text,
        "generated_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generated_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_generated_reports_definition" FOREIGN KEY ("definition_id") REFERENCES "report_definitions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_generated_reports_generated_by" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_generated_reports_status" ON "generated_reports" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_generated_reports_created_at" ON "generated_reports" ("created_at")`);

    // ============================================
    // SCHEDULER MODULE TABLES
    // ============================================

    // Jobs table
    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "type" varchar(50) NOT NULL,
        "cron_expression" varchar(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "last_run_at" timestamp,
        "next_run_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_jobs_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_jobs_type" ON "jobs" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_next_run" ON "jobs" ("next_run_at")`);

    // Job History table
    await queryRunner.query(`
      CREATE TABLE "job_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL,
        "started_at" timestamp NOT NULL,
        "completed_at" timestamp,
        "duration_ms" int,
        "result" jsonb,
        "error" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_history_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_job_history_job" ON "job_history" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_job_history_status" ON "job_history" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_job_history_started_at" ON "job_history" ("started_at")`);

    // ============================================
    // AUDIT MODULE TABLES
    // ============================================

    // Audit Events table
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_type" varchar(100) NOT NULL,
        "entity_type" varchar(100),
        "entity_id" varchar(100),
        "user_id" uuid,
        "action" varchar(50) NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "ip_address" varchar(45),
        "user_agent" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_audit_events_type" ON "audit_events" ("event_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_events_entity" ON "audit_events" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_events_user" ON "audit_events" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_events_created_at" ON "audit_events" ("created_at")`);

    // Create audit trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_log_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO audit_events (event_type, entity_type, entity_id, action, old_values, new_values)
        VALUES (
          TG_TABLE_NAME || '_' || TG_OP,
          TG_TABLE_NAME,
          COALESCE(NEW.id::text, OLD.id::text),
          TG_OP,
          CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
          CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END
        );
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop audit trigger function
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_log_changes CASCADE`);

    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "generated_reports" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_definitions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_documents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_batches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_requests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_validations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geography" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otps" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE`);
  }
}
