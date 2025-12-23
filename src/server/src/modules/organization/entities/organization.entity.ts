import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

/**
 * Organization type
 */
export enum OrganizationType {
  UMBRELLA_BODY = 'UMBRELLA_BODY', // e.g., Kenya Bodaboda Association (KBA)
  SACCO = 'SACCO', // Savings and Credit Cooperative
  ASSOCIATION = 'ASSOCIATION', // Local bodaboda association
  STAGE = 'STAGE', // Bodaboda stage/station
}

/**
 * Organization status
 */
export enum OrganizationStatus {
  PENDING = 'PENDING', // Awaiting verification
  ACTIVE = 'ACTIVE', // Verified and active
  SUSPENDED = 'SUSPENDED', // Temporarily suspended
  INACTIVE = 'INACTIVE', // No longer operating
}

/**
 * Organization Entity
 * Represents KBA, SACCOs, and other umbrella bodies
 *
 * Per module_architecture.md:
 * - KBA/SACCO hierarchy
 * - Member organization management
 */
@Entity('organizations')
@Index(['type', 'status'])
@Index(['parentId'])
@Index(['countyCode'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Organization name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Short code/identifier */
  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  code!: string;

  /** Organization type */
  @Column({
    type: 'enum',
    enum: OrganizationType,
  })
  type!: OrganizationType;

  /** Organization status */
  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    default: OrganizationStatus.PENDING,
  })
  status!: OrganizationStatus;

  /** Parent organization (for hierarchy) */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Organization;

  @OneToMany(() => Organization, (org) => org.parent)
  children?: Organization[];

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Registration number (e.g., SACCO registration) */
  @Column({ name: 'registration_number', type: 'varchar', length: 50, nullable: true })
  registrationNumber?: string;

  /** Kenya Revenue Authority PIN */
  @Column({ name: 'kra_pin', type: 'varchar', length: 20, nullable: true })
  kraPin?: string;

  /** Primary contact phone */
  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone?: string;

  /** Primary contact email */
  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  /** Physical address */
  @Column({ type: 'text', nullable: true })
  address?: string;

  /** County code (Kenya counties) */
  @Column({ name: 'county_code', type: 'varchar', length: 10, nullable: true })
  countyCode?: string;

  /** Sub-county */
  @Column({ name: 'sub_county', type: 'varchar', length: 100, nullable: true })
  subCounty?: string;

  /** Ward */
  @Column({ type: 'varchar', length: 100, nullable: true })
  ward?: string;

  /** GPS coordinates */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  /** Chairperson/Leader name */
  @Column({ name: 'leader_name', type: 'varchar', length: 200, nullable: true })
  leaderName?: string;

  /** Leader phone */
  @Column({ name: 'leader_phone', type: 'varchar', length: 20, nullable: true })
  leaderPhone?: string;

  /** Secretary name */
  @Column({ name: 'secretary_name', type: 'varchar', length: 200, nullable: true })
  secretaryName?: string;

  /** Secretary phone */
  @Column({ name: 'secretary_phone', type: 'varchar', length: 20, nullable: true })
  secretaryPhone?: string;

  /** Treasurer name */
  @Column({ name: 'treasurer_name', type: 'varchar', length: 200, nullable: true })
  treasurerName?: string;

  /** Treasurer phone */
  @Column({ name: 'treasurer_phone', type: 'varchar', length: 20, nullable: true })
  treasurerPhone?: string;

  /** Estimated member count */
  @Column({ name: 'estimated_members', type: 'integer', default: 0 })
  estimatedMembers!: number;

  /** Verified member count (from system) */
  @Column({ name: 'verified_members', type: 'integer', default: 0 })
  verifiedMembers!: number;

  /** Commission rate (percentage) for this organization */
  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionRate?: number;

  /** Bank account for commission disbursement */
  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bankAccount?: string;

  @Column({ name: 'bank_branch', type: 'varchar', length: 100, nullable: true })
  bankBranch?: string;

  /** M-Pesa paybill/till for the organization */
  @Column({ name: 'mpesa_number', type: 'varchar', length: 20, nullable: true })
  mpesaNumber?: string;

  /** Logo URL */
  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  /** Verification date */
  @Column({ name: 'verified_at', type: 'timestamp with time zone', nullable: true })
  verifiedAt?: Date;

  /** Verified by (admin user ID) */
  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy?: string;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date;

  /**
   * Check if organization is active
   */
  isActive(): boolean {
    return this.status === OrganizationStatus.ACTIVE;
  }

  /**
   * Check if this is a top-level organization (no parent)
   */
  isTopLevel(): boolean {
    return !this.parentId;
  }

  /**
   * Check if this is an umbrella body
   */
  isUmbrellaBody(): boolean {
    return this.type === OrganizationType.UMBRELLA_BODY;
  }

  /**
   * Get full address string
   */
  getFullAddress(): string {
    const parts = [this.address, this.ward, this.subCounty, this.countyCode].filter(Boolean);
    return parts.join(', ');
  }
}
