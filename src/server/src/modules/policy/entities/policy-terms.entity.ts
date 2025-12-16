import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Policy type for terms
 */
export enum PolicyTermsType {
  TPO = 'TPO',                   // Third-Party Only
  COMPREHENSIVE = 'COMPREHENSIVE', // Future: Comprehensive coverage
}

/**
 * Policy Terms Entity
 * CR-IRA-003: Stores policy terms and conditions versions
 *
 * IRA Requirement: Policy terms must be displayed and acknowledged
 * before policy issuance.
 */
@Entity('policy_terms')
@Index(['type', 'effectiveFrom'])
@Index(['isActive'])
export class PolicyTerms {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Version number (e.g., "1.0", "2.0") */
  @Column({ type: 'varchar', length: 20 })
  @Index()
  version!: string;

  /** Policy type these terms apply to */
  @Column({
    type: 'enum',
    enum: PolicyTermsType,
    default: PolicyTermsType.TPO,
  })
  type!: PolicyTermsType;

  /** Terms title */
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Full terms content (HTML supported) */
  @Column({ type: 'text' })
  content!: string;

  /** Plain text summary for USSD/SMS */
  @Column({ type: 'text', nullable: true })
  summary?: string;

  /** Swahili translation of content */
  @Column({ name: 'content_sw', type: 'text', nullable: true })
  contentSw?: string;

  /** Swahili summary */
  @Column({ name: 'summary_sw', type: 'text', nullable: true })
  summarySw?: string;

  /** Key terms highlights (for UI display) */
  @Column({
    name: 'key_terms',
    type: 'simple-array',
    nullable: true,
  })
  keyTerms?: string[];

  /** Key terms in Swahili */
  @Column({
    name: 'key_terms_sw',
    type: 'simple-array',
    nullable: true,
  })
  keyTermsSw?: string[];

  /** Coverage inclusions */
  @Column({
    type: 'simple-array',
    nullable: true,
  })
  inclusions?: string[];

  /** Coverage exclusions */
  @Column({
    type: 'simple-array',
    nullable: true,
  })
  exclusions?: string[];

  /** When these terms become effective */
  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom!: Date;

  /** When these terms expire (null = no expiry) */
  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo?: Date;

  /** Whether this is the active version */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Underwriter reference */
  @Column({ name: 'underwriter_name', type: 'varchar', length: 200 })
  underwriterName!: string;

  /** IRA approval reference (if applicable) */
  @Column({
    name: 'ira_approval_ref',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  iraApprovalRef?: string;

  /** Free look period in days */
  @Column({ name: 'free_look_days', type: 'int', default: 30 })
  freeLookDays!: number;

  /** Cancellation policy text */
  @Column({
    name: 'cancellation_policy',
    type: 'text',
    nullable: true,
  })
  cancellationPolicy?: string;

  /** Claims process summary */
  @Column({
    name: 'claims_process',
    type: 'text',
    nullable: true,
  })
  claimsProcess?: string;

  /** PDF document URL (uploaded terms document) */
  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string;

  /** Created by admin user ID */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Check if terms are currently effective
   */
  isEffective(): boolean {
    const now = new Date();
    if (now < this.effectiveFrom) return false;
    if (this.effectiveTo && now > this.effectiveTo) return false;
    return this.isActive;
  }
}

/**
 * Policy Terms Acknowledgment Entity
 * Records user acceptance of policy terms
 */
@Entity('policy_terms_acknowledgments')
@Index(['userId', 'termsId'])
@Index(['userId', 'acknowledgedAt'])
@Index(['termsId'])
export class PolicyTermsAcknowledgment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User who acknowledged */
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  /** Terms version acknowledged */
  @Column({ name: 'terms_id', type: 'uuid' })
  termsId!: string;

  /** When acknowledged */
  @Column({ name: 'acknowledged_at', type: 'timestamptz' })
  acknowledgedAt!: Date;

  /** IP address at time of acknowledgment */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  /** User agent at time of acknowledgment */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  /** Channel used (app, web, ussd) */
  @Column({ type: 'varchar', length: 20, default: 'app' })
  channel!: string;

  /** Policy ID this acknowledgment is for (if known) */
  @Column({ name: 'policy_id', type: 'uuid', nullable: true })
  policyId?: string;

  /** Consent text shown to user at time of acknowledgment */
  @Column({
    name: 'consent_text',
    type: 'text',
    nullable: true,
  })
  consentText?: string;

  /** Checksum of terms content at acknowledgment time */
  @Column({
    name: 'terms_checksum',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  termsChecksum?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
