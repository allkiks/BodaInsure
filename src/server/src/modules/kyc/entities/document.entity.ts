import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../identity/entities/user.entity.js';

/**
 * Document Type enum
 * Per FEAT-KYC-001, FEAT-KYC-002
 */
export enum DocumentType {
  ID_FRONT = 'ID_FRONT',
  ID_BACK = 'ID_BACK',
  LICENSE = 'LICENSE',
  LOGBOOK = 'LOGBOOK',
  KRA_PIN = 'KRA_PIN',
  PHOTO = 'PHOTO',
}

/**
 * Document Status enum
 */
export enum DocumentStatus {
  PENDING = 'PENDING',         // Uploaded but not processed
  PROCESSING = 'PROCESSING',   // Being validated
  IN_REVIEW = 'IN_REVIEW',     // Awaiting manual review
  APPROVED = 'APPROVED',       // Verification passed
  REJECTED = 'REJECTED',       // Verification failed
}

/**
 * Document entity
 * Stores KYC document metadata
 * Actual files stored in S3-compatible object storage
 *
 * Per FEAT-KYC-002 business rules:
 * - Maximum 3 versions per document type (soft limit, superseded versions)
 * - Previous versions retained for audit
 */
@Entity('documents')
@Index(['userId', 'documentType'])
@Index(['userId', 'status'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
  })
  documentType!: DocumentType;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status!: DocumentStatus;

  /**
   * Version number for this document type
   * Increments when user re-uploads
   */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /**
   * Whether this is the current active version
   * Only one document per type per user can be active
   */
  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent!: boolean;

  /**
   * Storage location in object storage (S3 key)
   * Format: kyc/{user_id}/{document_type}/{document_id}.{ext}
   */
  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  /**
   * Original filename from upload
   */
  @Column({ name: 'original_filename', type: 'varchar', length: 255, nullable: true })
  originalFilename?: string;

  /**
   * MIME type (e.g., image/jpeg, image/png)
   */
  @Column({ name: 'mime_type', type: 'varchar', length: 50 })
  mimeType!: string;

  /**
   * File size in bytes
   */
  @Column({ name: 'file_size', type: 'int' })
  fileSize!: number;

  /**
   * Quality score from client-side processing (0-100)
   */
  @Column({ name: 'quality_score', type: 'int', nullable: true })
  qualityScore?: number;

  /**
   * Device metadata from capture
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  device?: string;

  /**
   * Timestamp when image was captured on device
   */
  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt?: Date;

  /**
   * Rejection reason (if status = REJECTED)
   */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  /**
   * Reviewer notes (internal)
   */
  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes?: string;

  /**
   * User ID of reviewer (if manually reviewed)
   */
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  /**
   * Timestamp when reviewed
   */
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  /**
   * Hash of file content for deduplication
   */
  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash?: string;

  /**
   * Extracted data from OCR/validation (JSON)
   * e.g., { nationalId: "12345678", name: "John Doe", expiryDate: "2025-01-01" }
   */
  @Column({ name: 'extracted_data', type: 'jsonb', nullable: true })
  extractedData?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Document type labels for display
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.ID_FRONT]: 'National ID (Front)',
  [DocumentType.ID_BACK]: 'National ID (Back)',
  [DocumentType.LICENSE]: 'Driving License',
  [DocumentType.LOGBOOK]: 'Vehicle Logbook',
  [DocumentType.KRA_PIN]: 'KRA PIN Certificate',
  [DocumentType.PHOTO]: 'Passport Photo',
};

/**
 * Required documents for KYC completion
 * Per BR-001: All 6 document types required before payment
 */
export const REQUIRED_DOCUMENTS: DocumentType[] = [
  DocumentType.ID_FRONT,
  DocumentType.ID_BACK,
  DocumentType.LICENSE,
  DocumentType.LOGBOOK,
  DocumentType.KRA_PIN,
  DocumentType.PHOTO,
];
