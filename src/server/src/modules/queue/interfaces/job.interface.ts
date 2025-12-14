/**
 * Queue Job Interfaces
 * Per GAP-020: BullMQ job type definitions
 */

/**
 * Queue names used across the application
 */
export enum QueueName {
  NOTIFICATION = 'notification',
  POLICY = 'policy',
  REPORT = 'report',
  KYC = 'kyc',
  PAYMENT = 'payment',
}

/**
 * Job types for notification queue
 */
export enum NotificationJobType {
  SEND_SMS = 'send_sms',
  SEND_EMAIL = 'send_email',
  SEND_WHATSAPP = 'send_whatsapp',
  SEND_BULK_SMS = 'send_bulk_sms',
  SEND_PAYMENT_REMINDER = 'send_payment_reminder',
  SEND_POLICY_EXPIRY_WARNING = 'send_policy_expiry_warning',
}

/**
 * Job types for policy queue
 */
export enum PolicyJobType {
  GENERATE_CERTIFICATE = 'generate_certificate',
  PROCESS_BATCH = 'process_batch',
  EXPIRE_POLICY = 'expire_policy',
  LAPSE_POLICY = 'lapse_policy',
}

/**
 * Job types for report queue
 */
export enum ReportJobType {
  GENERATE_REPORT = 'generate_report',
  EXPORT_REPORT = 'export_report',
  CLEANUP_EXPIRED = 'cleanup_expired',
}

/**
 * Job types for KYC queue
 */
export enum KycJobType {
  VALIDATE_DOCUMENT = 'validate_document',
  VERIFY_NATIONAL_ID = 'verify_national_id',
}

/**
 * Job types for payment queue
 */
export enum PaymentJobType {
  PROCESS_CALLBACK = 'process_callback',
  RECONCILE_PAYMENT = 'reconcile_payment',
  PROCESS_REFUND = 'process_refund',
}

/**
 * Base job data interface
 */
export interface BaseJobData {
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  createdAt: Date;
}

/**
 * SMS job data
 */
export interface SmsJobData extends BaseJobData {
  type: NotificationJobType.SEND_SMS;
  phone: string;
  message: string;
  provider?: string;
}

/**
 * Bulk SMS job data
 */
export interface BulkSmsJobData extends BaseJobData {
  type: NotificationJobType.SEND_BULK_SMS;
  recipients: Array<{
    phone: string;
    message: string;
  }>;
  provider?: string;
}

/**
 * Email job data
 */
export interface EmailJobData extends BaseJobData {
  type: NotificationJobType.SEND_EMAIL;
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * WhatsApp job data
 */
export interface WhatsAppJobData extends BaseJobData {
  type: NotificationJobType.SEND_WHATSAPP;
  phone: string;
  template: string;
  parameters: string[];
}

/**
 * Payment reminder job data
 */
export interface PaymentReminderJobData extends BaseJobData {
  type: NotificationJobType.SEND_PAYMENT_REMINDER;
  userIds: string[];
  reminderType: 'daily' | 'weekly' | 'final';
}

/**
 * Policy certificate generation job data
 */
export interface PolicyCertificateJobData extends BaseJobData {
  type: PolicyJobType.GENERATE_CERTIFICATE;
  policyId: string;
  deliveryMethod: 'sms' | 'whatsapp' | 'email';
  deliveryAddress: string;
}

/**
 * Policy batch processing job data
 */
export interface PolicyBatchJobData extends BaseJobData {
  type: PolicyJobType.PROCESS_BATCH;
  batchId: string;
  policyType: '1_month' | '11_month';
}

/**
 * Policy expiration job data
 */
export interface PolicyExpirationJobData extends BaseJobData {
  type: PolicyJobType.EXPIRE_POLICY | PolicyJobType.LAPSE_POLICY;
  policyIds: string[];
}

/**
 * Report generation job data
 */
export interface ReportGenerationJobData extends BaseJobData {
  type: ReportJobType.GENERATE_REPORT;
  reportDefinitionId: string;
  startDate: Date;
  endDate: Date;
  parameters?: Record<string, unknown>;
  deliverTo?: string[];
}

/**
 * Report export job data
 */
export interface ReportExportJobData extends BaseJobData {
  type: ReportJobType.EXPORT_REPORT;
  reportId: string;
  format: 'pdf' | 'excel' | 'csv';
  deliverTo?: string[];
}

/**
 * KYC document validation job data
 */
export interface KycValidationJobData extends BaseJobData {
  type: KycJobType.VALIDATE_DOCUMENT | KycJobType.VERIFY_NATIONAL_ID;
  documentId: string;
  documentType: string;
}

/**
 * Payment callback processing job data
 */
export interface PaymentCallbackJobData extends BaseJobData {
  type: PaymentJobType.PROCESS_CALLBACK;
  callbackType: 'mpesa_stk' | 'mpesa_b2c';
  payload: Record<string, unknown>;
}

/**
 * Payment reconciliation job data
 */
export interface PaymentReconciliationJobData extends BaseJobData {
  type: PaymentJobType.RECONCILE_PAYMENT;
  transactionIds: string[];
}

/**
 * Refund processing job data
 */
export interface RefundJobData extends BaseJobData {
  type: PaymentJobType.PROCESS_REFUND;
  policyId: string;
  amount: number;
  reason: string;
}

/**
 * Union type for all notification job data
 */
export type NotificationJobData =
  | SmsJobData
  | BulkSmsJobData
  | EmailJobData
  | WhatsAppJobData
  | PaymentReminderJobData;

/**
 * Union type for all policy job data
 */
export type PolicyQueueJobData =
  | PolicyCertificateJobData
  | PolicyBatchJobData
  | PolicyExpirationJobData;

/**
 * Union type for all report job data
 */
export type ReportQueueJobData =
  | ReportGenerationJobData
  | ReportExportJobData;

/**
 * Job result interface
 */
export interface JobResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  processedAt: Date;
  duration: number;
}

/**
 * Default job options
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 60 * 60, // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 60 * 60, // 7 days
  },
};
