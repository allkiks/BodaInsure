import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Document type for policies
 */
export enum PolicyDocumentType {
  /** Main policy certificate/schedule */
  POLICY_CERTIFICATE = 'POLICY_CERTIFICATE',
  /** Terms and conditions */
  TERMS_CONDITIONS = 'TERMS_CONDITIONS',
  /** Cover note (temporary proof) */
  COVER_NOTE = 'COVER_NOTE',
  /** Receipt */
  RECEIPT = 'RECEIPT',
}

/**
 * Document generation status
 */
export enum DocumentStatus {
  /** Queued for generation */
  PENDING = 'PENDING',
  /** Currently being generated */
  GENERATING = 'GENERATING',
  /** Successfully generated */
  GENERATED = 'GENERATED',
  /** Generation failed */
  FAILED = 'FAILED',
}

/**
 * Delivery status for document
 */
export enum DeliveryStatus {
  /** Not yet sent */
  PENDING = 'PENDING',
  /** Sent via at least one channel */
  SENT = 'SENT',
  /** Confirmed delivered */
  DELIVERED = 'DELIVERED',
  /** All delivery attempts failed */
  FAILED = 'FAILED',
}

/**
 * Policy Document Entity
 * Stores generated policy PDFs and their delivery status
 *
 * Per FEAT-POL-002
 */
@Entity('policy_documents')
@Index(['policyId', 'documentType'])
export class PolicyDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Associated policy */
  @Column({ name: 'policy_id', type: 'uuid' })
  @Index()
  policyId!: string;

  /** User who owns this document */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  /** Type of document */
  @Column({
    name: 'document_type',
    type: 'enum',
    enum: PolicyDocumentType,
    default: PolicyDocumentType.POLICY_CERTIFICATE,
  })
  documentType!: PolicyDocumentType;

  /** Generation status */
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status!: DocumentStatus;

  /** Delivery status */
  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  deliveryStatus!: DeliveryStatus;

  /** Original filename */
  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  /** MIME type */
  @Column({ name: 'mime_type', type: 'varchar', length: 100, default: 'application/pdf' })
  mimeType!: string;

  /** File size in bytes */
  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number;

  /** Storage path (S3 key or local path) */
  @Column({ name: 'storage_path', type: 'varchar', length: 500, nullable: true })
  storagePath?: string;

  /** Storage bucket */
  @Column({ name: 'storage_bucket', type: 'varchar', length: 100, nullable: true })
  storageBucket?: string;

  /** Content hash (SHA-256) for integrity verification */
  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash?: string;

  /** Short-lived download URL (signed URL) */
  @Column({ name: 'download_url', type: 'text', nullable: true })
  downloadUrl?: string;

  /** Download URL expiry time */
  @Column({ name: 'download_url_expires_at', type: 'timestamp with time zone', nullable: true })
  downloadUrlExpiresAt?: Date;

  /** When document was generated */
  @Column({ name: 'generated_at', type: 'timestamp with time zone', nullable: true })
  generatedAt?: Date;

  /** Number of times downloaded */
  @Column({ name: 'download_count', type: 'int', default: 0 })
  downloadCount!: number;

  /** Last download time */
  @Column({ name: 'last_downloaded_at', type: 'timestamp with time zone', nullable: true })
  lastDownloadedAt?: Date;

  /** WhatsApp delivery status */
  @Column({ name: 'whatsapp_sent', type: 'boolean', default: false })
  whatsappSent!: boolean;

  /** WhatsApp delivery time */
  @Column({ name: 'whatsapp_sent_at', type: 'timestamp with time zone', nullable: true })
  whatsappSentAt?: Date;

  /** SMS notification sent */
  @Column({ name: 'sms_sent', type: 'boolean', default: false })
  smsSent!: boolean;

  /** SMS sent time */
  @Column({ name: 'sms_sent_at', type: 'timestamp with time zone', nullable: true })
  smsSentAt?: Date;

  /** Email delivery status */
  @Column({ name: 'email_sent', type: 'boolean', default: false })
  emailSent!: boolean;

  /** Email sent time */
  @Column({ name: 'email_sent_at', type: 'timestamp with time zone', nullable: true })
  emailSentAt?: Date;

  /** Error message if generation failed */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  /** Number of generation attempts */
  @Column({ name: 'generation_attempts', type: 'int', default: 0 })
  generationAttempts!: number;

  /** Data used to generate the document (for regeneration) */
  @Column({ name: 'generation_data', type: 'jsonb', nullable: true })
  generationData?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Check if document is ready for download
   */
  isReady(): boolean {
    return this.status === DocumentStatus.GENERATED && !!this.storagePath;
  }

  /**
   * Check if download URL is valid
   */
  hasValidDownloadUrl(): boolean {
    if (!this.downloadUrl || !this.downloadUrlExpiresAt) return false;
    return new Date() < this.downloadUrlExpiresAt;
  }

  /**
   * Check if document was delivered via any channel
   */
  wasDelivered(): boolean {
    return this.whatsappSent || this.smsSent || this.emailSent;
  }
}
