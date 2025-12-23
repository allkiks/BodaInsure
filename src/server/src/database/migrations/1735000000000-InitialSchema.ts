import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial Schema Migration
 * Creates all database tables from entity definitions
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class InitialSchema1735000000000 implements MigrationInterface {
  name = 'InitialSchema1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ============================================
    // CREATE ENUMS
    // ============================================

    // User enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_status_enum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('rider', 'sacco_admin', 'kba_admin', 'insurance_admin', 'platform_admin');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "kyc_status_enum" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'INCOMPLETE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "language_enum" AS ENUM ('en', 'sw');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Session enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "device_type_enum" AS ENUM ('MOBILE_APP', 'WEB', 'USSD');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "session_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // OTP enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "otp_purpose_enum" AS ENUM ('REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'PHONE_CHANGE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "otp_status_enum" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'EXHAUSTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Organization enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organization_type_enum" AS ENUM ('UMBRELLA_BODY', 'SACCO', 'ASSOCIATION', 'STAGE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organization_status_enum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Membership enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "membership_status_enum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "member_role_enum" AS ENUM ('MEMBER', 'OFFICIAL', 'ADMIN', 'CHAIRPERSON', 'SECRETARY', 'TREASURER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Wallet enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "wallet_status_enum" AS ENUM ('ACTIVE', 'FROZEN', 'SUSPENDED', 'LAPSED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Transaction enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_type_enum" AS ENUM ('DEPOSIT', 'DAILY_PAYMENT', 'REFUND', 'ADJUSTMENT', 'REVERSAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_provider_enum" AS ENUM ('MPESA', 'MANUAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Policy enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "policy_type_enum" AS ENUM ('ONE_MONTH', 'ELEVEN_MONTH');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "policy_status_enum" AS ENUM ('PENDING_ISSUANCE', 'PROCESSING', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'LAPSED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "batch_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "batch_schedule_enum" AS ENUM ('BATCH_1', 'BATCH_2', 'BATCH_3', 'MANUAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Job enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "job_type_enum" AS ENUM ('POLICY_BATCH', 'PAYMENT_REMINDER', 'POLICY_EXPIRY_REMINDER', 'LAPSE_CHECK', 'REPORT_GENERATION', 'REPORT_CLEANUP', 'DATA_SYNC', 'NOTIFICATION_RETRY', 'WALLET_RECONCILIATION', 'CUSTOM');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "job_status_enum" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Document enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "document_type_enum" AS ENUM ('NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'KRA_PIN', 'DRIVING_LICENSE', 'LOGBOOK', 'SELFIE', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "document_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Notification enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_channel_enum" AS ENUM ('SMS', 'WHATSAPP', 'PUSH', 'EMAIL', 'USSD');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_status_enum" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_type_enum" AS ENUM ('OTP', 'PAYMENT_CONFIRMATION', 'POLICY_ISSUED', 'POLICY_EXPIRING', 'PAYMENT_REMINDER', 'KYC_STATUS', 'GENERAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Audit enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_event_type_enum" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'POLICY_CREATED', 'POLICY_ISSUED', 'POLICY_CANCELLED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'KYC_REJECTED', 'DATA_EXPORTED', 'DATA_DELETED', 'ADMIN_ACTION', 'SYSTEM_EVENT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Report enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_type_enum" AS ENUM ('ENROLLMENT', 'PAYMENT', 'POLICY', 'ORGANIZATION', 'CUSTOM');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_status_enum" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_format_enum" AS ENUM ('PDF', 'CSV', 'EXCEL', 'JSON');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ============================================
    // CREATE TABLES
    // ============================================

    // Users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "phone" varchar(20) NOT NULL UNIQUE,
        "national_id" varchar(500),
        "full_name" varchar(500),
        "email" varchar(500),
        "kra_pin" varchar(500),
        "date_of_birth" date,
        "gender" "gender_enum",
        "status" "user_status_enum" NOT NULL DEFAULT 'PENDING',
        "role" "user_role_enum" NOT NULL DEFAULT 'rider',
        "kyc_status" "kyc_status_enum" NOT NULL DEFAULT 'PENDING',
        "language" "language_enum" NOT NULL DEFAULT 'en',
        "terms_accepted_at" timestamptz,
        "consent_given_at" timestamptz,
        "last_login_at" timestamptz,
        "failed_login_attempts" int NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        "organization_id" uuid,
        "reminder_opt_out" boolean NOT NULL DEFAULT false,
        "username" varchar(50) UNIQUE,
        "password_hash" varchar(255),
        "is_system_account" boolean NOT NULL DEFAULT false,
        "deletion_scheduled_for" timestamptz,
        "deletion_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz
      )
    `);

    // Sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "refresh_token_hash" varchar(255) NOT NULL UNIQUE,
        "device_type" "device_type_enum" NOT NULL,
        "status" "session_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "expires_at" timestamptz NOT NULL,
        "last_activity_at" timestamptz NOT NULL DEFAULT NOW(),
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "device_id" varchar(255),
        "device_name" varchar(255),
        "revoked_reason" varchar(255),
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz
      )
    `);

    // OTPs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otps" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "phone" varchar(20) NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "purpose" "otp_purpose_enum" NOT NULL,
        "status" "otp_status_enum" NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "verified_at" timestamptz,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz
      )
    `);

    // Organizations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "code" varchar(20) NOT NULL UNIQUE,
        "type" "organization_type_enum" NOT NULL,
        "status" "organization_status_enum" NOT NULL DEFAULT 'PENDING',
        "parent_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "description" text,
        "registration_number" varchar(50),
        "kra_pin" varchar(20),
        "contact_phone" varchar(20),
        "contact_email" varchar(255),
        "address" text,
        "county_code" varchar(10),
        "sub_county" varchar(100),
        "ward" varchar(100),
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "leader_name" varchar(200),
        "leader_phone" varchar(20),
        "secretary_name" varchar(200),
        "secretary_phone" varchar(20),
        "treasurer_name" varchar(200),
        "treasurer_phone" varchar(20),
        "estimated_members" int NOT NULL DEFAULT 0,
        "verified_members" int NOT NULL DEFAULT 0,
        "commission_rate" decimal(5,2),
        "bank_name" varchar(100),
        "bank_account" varchar(50),
        "bank_branch" varchar(100),
        "mpesa_number" varchar(20),
        "logo_url" varchar(500),
        "verified_at" timestamptz,
        "verified_by" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz
      )
    `);

    // Memberships table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memberships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "status" "membership_status_enum" NOT NULL DEFAULT 'PENDING',
        "role" "member_role_enum" NOT NULL DEFAULT 'MEMBER',
        "member_number" varchar(50),
        "joined_at" timestamptz,
        "expires_at" timestamptz,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "suspension_reason" text,
        "suspended_by" uuid,
        "suspended_at" timestamptz,
        "is_primary" boolean NOT NULL DEFAULT false,
        "fee_paid" int NOT NULL DEFAULT 0,
        "fee_reference" varchar(100),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE("user_id", "organization_id")
      )
    `);

    // Wallets table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "status" "wallet_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "balance" bigint NOT NULL DEFAULT 0,
        "total_deposited" bigint NOT NULL DEFAULT 0,
        "total_paid" bigint NOT NULL DEFAULT 0,
        "deposit_completed" boolean NOT NULL DEFAULT false,
        "deposit_completed_at" timestamptz,
        "daily_payments_count" int NOT NULL DEFAULT 0,
        "last_daily_payment_at" timestamptz,
        "daily_payments_completed" boolean NOT NULL DEFAULT false,
        "daily_payments_completed_at" timestamptz,
        "currency" varchar(3) NOT NULL DEFAULT 'KES',
        "version" int NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Transactions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
        "type" "transaction_type_enum" NOT NULL,
        "status" "transaction_status_enum" NOT NULL DEFAULT 'PENDING',
        "provider" "payment_provider_enum" NOT NULL DEFAULT 'MPESA',
        "amount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'KES',
        "phone" varchar(15),
        "mpesa_receipt_number" varchar(50),
        "mpesa_checkout_request_id" varchar(100),
        "mpesa_merchant_request_id" varchar(100),
        "idempotency_key" varchar(100),
        "daily_payment_number" int,
        "days_count" int NOT NULL DEFAULT 1,
        "description" text,
        "failure_reason" text,
        "result_code" varchar(10),
        "result_description" text,
        "policy_id" uuid,
        "adjusted_by" uuid,
        "adjustment_reason" text,
        "ip_address" varchar(45),
        "metadata" jsonb,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Payment Requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
        "transaction_id" uuid REFERENCES "transactions"("id"),
        "type" "transaction_type_enum" NOT NULL,
        "status" "transaction_status_enum" NOT NULL DEFAULT 'PENDING',
        "amount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'KES',
        "phone" varchar(15) NOT NULL,
        "mpesa_checkout_request_id" varchar(100),
        "mpesa_merchant_request_id" varchar(100),
        "idempotency_key" varchar(100) UNIQUE,
        "days_count" int NOT NULL DEFAULT 1,
        "expires_at" timestamptz NOT NULL,
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Policy Batches table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_batches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "batch_number" varchar(50) NOT NULL UNIQUE,
        "schedule" "batch_schedule_enum" NOT NULL,
        "batch_date" date NOT NULL,
        "status" "batch_status_enum" NOT NULL DEFAULT 'PENDING',
        "scheduled_for" timestamptz NOT NULL,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "payment_window_start" timestamptz NOT NULL,
        "payment_window_end" timestamptz NOT NULL,
        "total_policies" int NOT NULL DEFAULT 0,
        "processed_count" int NOT NULL DEFAULT 0,
        "failed_count" int NOT NULL DEFAULT 0,
        "one_month_count" int NOT NULL DEFAULT 0,
        "eleven_month_count" int NOT NULL DEFAULT 0,
        "total_premium" bigint NOT NULL DEFAULT 0,
        "processing_duration_ms" bigint,
        "error_details" jsonb,
        "failed_policies" jsonb,
        "triggered_by" uuid,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE("batch_date", "schedule")
      )
    `);

    // Policies table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policies" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "policy_type" "policy_type_enum" NOT NULL,
        "status" "policy_status_enum" NOT NULL DEFAULT 'PENDING_ISSUANCE',
        "policy_number" varchar(50) UNIQUE,
        "certificate_number" varchar(50),
        "batch_id" uuid REFERENCES "policy_batches"("id") ON DELETE SET NULL,
        "triggering_transaction_id" uuid,
        "premium_amount" bigint NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'KES',
        "coverage_start" timestamptz,
        "coverage_end" timestamptz,
        "expires_at" timestamptz,
        "issued_at" timestamptz,
        "activated_at" timestamptz,
        "cancelled_at" timestamptz,
        "cancellation_reason" text,
        "previous_policy_id" uuid,
        "next_policy_id" uuid,
        "vehicle_registration" varchar(20),
        "insured_name" varchar(100),
        "national_id" varchar(20),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Policy Documents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_documents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "policy_id" uuid NOT NULL REFERENCES "policies"("id") ON DELETE CASCADE,
        "document_type" varchar(50) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "file_path" varchar(500) NOT NULL,
        "file_size" int,
        "mime_type" varchar(100),
        "storage_bucket" varchar(100),
        "generated_at" timestamptz,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Policy Terms Type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "policy_terms_type_enum" AS ENUM ('TPO', 'COMPREHENSIVE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Policy Terms table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_terms" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Policy Terms Acknowledgments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "policy_terms_acknowledgments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "terms_id" uuid NOT NULL REFERENCES "policy_terms"("id") ON DELETE CASCADE,
        "acknowledged_at" timestamptz NOT NULL,
        "ip_address" varchar(45),
        "user_agent" text,
        "channel" varchar(20) NOT NULL DEFAULT 'app',
        "policy_id" uuid,
        "consent_text" text,
        "terms_checksum" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // KYC Documents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "document_type" "document_type_enum" NOT NULL,
        "status" "document_status_enum" NOT NULL DEFAULT 'PENDING',
        "file_name" varchar(255) NOT NULL,
        "file_path" varchar(500) NOT NULL,
        "file_size" int,
        "mime_type" varchar(100),
        "storage_bucket" varchar(100),
        "extracted_data" jsonb,
        "validation_errors" jsonb,
        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "review_notes" text,
        "expires_at" timestamptz,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz
      )
    `);

    // KYC Validations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kyc_validations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "document_id" uuid REFERENCES "documents"("id") ON DELETE CASCADE,
        "validation_type" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL,
        "result" jsonb,
        "confidence_score" decimal(5,4),
        "error_message" text,
        "validated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Geography table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "geography" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "county_code" varchar(10) NOT NULL,
        "county_name" varchar(100) NOT NULL,
        "sub_county" varchar(100),
        "ward" varchar(100),
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Jobs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "type" "job_type_enum" NOT NULL,
        "status" "job_status_enum" NOT NULL DEFAULT 'SCHEDULED',
        "cron_expression" varchar(50),
        "is_recurring" boolean NOT NULL DEFAULT false,
        "config" jsonb,
        "scheduled_at" timestamptz NOT NULL,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "next_run_at" timestamptz,
        "duration_ms" int,
        "result" jsonb,
        "error_message" text,
        "error_stack" text,
        "retry_count" int NOT NULL DEFAULT 0,
        "max_retries" int NOT NULL DEFAULT 3,
        "last_retry_at" timestamptz,
        "created_by" uuid,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Job History table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
        "status" "job_status_enum" NOT NULL,
        "started_at" timestamptz NOT NULL,
        "completed_at" timestamptz,
        "duration_ms" int,
        "result" jsonb,
        "error_message" text,
        "error_stack" text,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Notification Templates table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL UNIQUE,
        "type" "notification_type_enum" NOT NULL,
        "channel" "notification_channel_enum" NOT NULL,
        "language" "language_enum" NOT NULL DEFAULT 'en',
        "subject" varchar(255),
        "content" text NOT NULL,
        "variables" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Notification Preferences table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "sms_enabled" boolean NOT NULL DEFAULT true,
        "whatsapp_enabled" boolean NOT NULL DEFAULT true,
        "push_enabled" boolean NOT NULL DEFAULT true,
        "email_enabled" boolean NOT NULL DEFAULT false,
        "payment_reminders" boolean NOT NULL DEFAULT true,
        "policy_updates" boolean NOT NULL DEFAULT true,
        "promotional" boolean NOT NULL DEFAULT false,
        "quiet_hours_start" time,
        "quiet_hours_end" time,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Notifications table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "template_id" uuid REFERENCES "notification_templates"("id"),
        "type" "notification_type_enum" NOT NULL,
        "channel" "notification_channel_enum" NOT NULL,
        "status" "notification_status_enum" NOT NULL DEFAULT 'PENDING',
        "recipient" varchar(255) NOT NULL,
        "subject" varchar(255),
        "content" text NOT NULL,
        "variables" jsonb,
        "provider_message_id" varchar(255),
        "provider_response" jsonb,
        "error_message" text,
        "sent_at" timestamptz,
        "delivered_at" timestamptz,
        "failed_at" timestamptz,
        "retry_count" int NOT NULL DEFAULT 0,
        "max_retries" int NOT NULL DEFAULT 3,
        "next_retry_at" timestamptz,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Audit Events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "event_type" "audit_event_type_enum" NOT NULL,
        "user_id" uuid,
        "target_user_id" uuid,
        "entity_type" varchar(50),
        "entity_id" uuid,
        "action" varchar(50) NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "ip_address" varchar(45),
        "user_agent" varchar(500),
        "request_id" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Breach Incidents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "breach_incidents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "severity" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "detected_at" timestamptz NOT NULL,
        "reported_at" timestamptz,
        "resolved_at" timestamptz,
        "affected_users_count" int NOT NULL DEFAULT 0,
        "affected_user_ids" jsonb,
        "data_types_affected" jsonb,
        "root_cause" text,
        "remediation_steps" text,
        "notification_sent" boolean NOT NULL DEFAULT false,
        "notification_sent_at" timestamptz,
        "reported_by" uuid,
        "assigned_to" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Report Definitions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_definitions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "type" "report_type_enum" NOT NULL,
        "query" text NOT NULL,
        "parameters" jsonb,
        "default_format" "report_format_enum" NOT NULL DEFAULT 'CSV',
        "is_scheduled" boolean NOT NULL DEFAULT false,
        "schedule_cron" varchar(50),
        "recipients" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // Generated Reports table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_reports" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "definition_id" uuid REFERENCES "report_definitions"("id") ON DELETE SET NULL,
        "name" varchar(255) NOT NULL,
        "type" "report_type_enum" NOT NULL,
        "status" "report_status_enum" NOT NULL DEFAULT 'PENDING',
        "format" "report_format_enum" NOT NULL,
        "parameters" jsonb,
        "file_path" varchar(500),
        "file_size" int,
        "row_count" int,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "expires_at" timestamptz,
        "error_message" text,
        "requested_by" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    // ============================================
    // CREATE INDEXES
    // ============================================

    // User indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_phone" ON "users" ("phone")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_status" ON "users" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_kyc_status" ON "users" ("kyc_status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_created_at" ON "users" ("created_at")`);

    // Session indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sessions_user_status" ON "sessions" ("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sessions_expires_at" ON "sessions" ("expires_at")`);

    // OTP indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otps_phone_purpose_status" ON "otps" ("phone", "purpose", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otps_expires_at" ON "otps" ("expires_at")`);

    // Organization indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_type_status" ON "organizations" ("type", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_parent" ON "organizations" ("parent_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_county" ON "organizations" ("county_code")`);

    // Membership indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_memberships_user" ON "memberships" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_memberships_org_status" ON "memberships" ("organization_id", "status")`);

    // Transaction indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_user_created" ON "transactions" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_wallet_type" ON "transactions" ("wallet_id", "type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_status_created" ON "transactions" ("status", "created_at")`);

    // Policy indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_policies_user_status" ON "policies" ("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_policies_status_expires" ON "policies" ("status", "expires_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_policies_batch" ON "policies" ("batch_id")`);

    // Job indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jobs_type_status" ON "jobs" ("type", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jobs_scheduled" ON "jobs" ("scheduled_at")`);

    // Audit indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_events_user" ON "audit_events" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_events_type_created" ON "audit_events" ("event_type", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_events_entity" ON "audit_events" ("entity_type", "entity_id")`);

    // Notification indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_user_status" ON "notifications" ("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_type_status" ON "notifications" ("type", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "generated_reports" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_definitions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "breach_incidents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geography" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_validations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_terms_acknowledgments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_terms" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_documents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_batches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_requests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otps" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "report_format_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_event_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "batch_schedule_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "batch_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_provider_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wallet_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "member_role_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "membership_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "otp_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "otp_purpose_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "session_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "device_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gender_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "language_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "policy_terms_type_enum" CASCADE`);
  }
}
