import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity.js';

/**
 * Validation Type enum
 */
export enum ValidationType {
  QUALITY = 'QUALITY',           // Image quality check
  TYPE_MATCH = 'TYPE_MATCH',     // Document matches declared type
  READABILITY = 'READABILITY',   // Text can be extracted
  FACE_MATCH = 'FACE_MATCH',     // Face matches photo ID
  EXPIRY_CHECK = 'EXPIRY_CHECK', // Document not expired
  FRAUD_CHECK = 'FRAUD_CHECK',   // No tampering detected
  MANUAL = 'MANUAL',             // Manual review result
}

/**
 * Validation Result enum
 */
export enum ValidationResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  PENDING = 'PENDING',
}

/**
 * KYC Validation entity
 * Stores individual validation results for documents
 * Multiple validations can be performed per document
 */
@Entity('kyc_validations')
@Index(['documentId', 'validationType'])
export class KycValidation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  @Column({
    name: 'validation_type',
    type: 'enum',
    enum: ValidationType,
  })
  validationType!: ValidationType;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'COMPLETED',
  })
  status!: string;

  @Column({
    type: 'enum',
    enum: ValidationResult,
    default: ValidationResult.PENDING,
  })
  result!: ValidationResult;

  /**
   * Confidence score (0-100) for automated validations
   */
  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidenceScore?: number;

  /**
   * Detailed message explaining the result
   */
  @Column({ type: 'text', nullable: true })
  message?: string;

  /**
   * Additional validation details (JSON)
   * e.g., { issues: ["blurry", "low_contrast"] }
   */
  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  /**
   * Whether this validation was automated or manual
   */
  @Column({ name: 'is_automated', type: 'boolean', default: true })
  isAutomated!: boolean;

  /**
   * User ID of validator (if manual)
   */
  @Column({ name: 'validated_by', type: 'uuid', nullable: true })
  validatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
