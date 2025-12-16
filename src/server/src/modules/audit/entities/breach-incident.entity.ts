import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Breach severity level
 */
export enum BreachSeverity {
  LOW = 'LOW',           // Minor security event, no PII exposed
  MEDIUM = 'MEDIUM',     // Limited PII exposure, few users affected
  HIGH = 'HIGH',         // Significant PII exposure, many users affected
  CRITICAL = 'CRITICAL', // Major breach, widespread PII exposure
}

/**
 * Breach incident status
 */
export enum BreachStatus {
  DETECTED = 'DETECTED',           // Initial detection
  INVESTIGATING = 'INVESTIGATING', // Under investigation
  CONFIRMED = 'CONFIRMED',         // Breach confirmed
  CONTAINED = 'CONTAINED',         // Breach contained
  NOTIFIED = 'NOTIFIED',           // Stakeholders notified
  RESOLVED = 'RESOLVED',           // Incident resolved
  CLOSED = 'CLOSED',               // Case closed
}

/**
 * Breach type classification
 */
export enum BreachType {
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',   // Unauthorized system access
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',       // Data stolen/leaked
  CREDENTIAL_COMPROMISE = 'CREDENTIAL_COMPROMISE', // User credentials compromised
  SYSTEM_INTRUSION = 'SYSTEM_INTRUSION',         // External system intrusion
  INSIDER_THREAT = 'INSIDER_THREAT',             // Internal malicious activity
  ACCIDENTAL_DISCLOSURE = 'ACCIDENTAL_DISCLOSURE', // Unintentional data exposure
  LOST_DEVICE = 'LOST_DEVICE',                   // Device with data lost/stolen
  RANSOMWARE = 'RANSOMWARE',                     // Ransomware attack
  PHISHING = 'PHISHING',                         // Phishing attack
  OTHER = 'OTHER',                               // Other breach type
}

/**
 * Breach Incident Entity
 * Records data breach incidents per Kenya Data Protection Act 2019
 *
 * CR-DPA-003: Breach notification workflow
 * - 72-hour notification requirement to Data Commissioner
 * - User notification for high-risk breaches
 */
@Entity('breach_incidents')
@Index(['status', 'severity'])
@Index(['createdAt'])
@Index(['detectedAt'])
export class BreachIncident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Incident reference number */
  @Column({ name: 'incident_ref', type: 'varchar', length: 50, unique: true })
  incidentRef!: string;

  /** Breach type */
  @Column({
    name: 'breach_type',
    type: 'enum',
    enum: BreachType,
  })
  breachType!: BreachType;

  /** Severity level */
  @Column({
    type: 'enum',
    enum: BreachSeverity,
  })
  severity!: BreachSeverity;

  /** Current status */
  @Column({
    type: 'enum',
    enum: BreachStatus,
    default: BreachStatus.DETECTED,
  })
  status!: BreachStatus;

  /** Brief title */
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Detailed description */
  @Column({ type: 'text' })
  description!: string;

  /** Affected data types (PII fields) */
  @Column({
    name: 'affected_data_types',
    type: 'simple-array',
    nullable: true,
  })
  affectedDataTypes?: string[];

  /** Estimated number of affected users */
  @Column({
    name: 'affected_users_count',
    type: 'int',
    default: 0,
  })
  affectedUsersCount!: number;

  /** List of affected user IDs (for notification) */
  @Column({
    name: 'affected_user_ids',
    type: 'simple-array',
    nullable: true,
  })
  affectedUserIds?: string[];

  /** How the breach was detected */
  @Column({
    name: 'detection_method',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  detectionMethod?: string;

  /** When the breach was detected */
  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date;

  /** Estimated time when breach occurred */
  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt?: Date;

  /** When breach was contained */
  @Column({ name: 'contained_at', type: 'timestamptz', nullable: true })
  containedAt?: Date;

  /** When stakeholders were notified */
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date;

  /** When incident was resolved */
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  /** User who reported/detected the breach */
  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy?: string;

  /** User assigned to handle the incident */
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo?: string;

  /** Root cause analysis */
  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause?: string;

  /** Immediate actions taken */
  @Column({
    name: 'immediate_actions',
    type: 'text',
    nullable: true,
  })
  immediateActions?: string;

  /** Remediation steps */
  @Column({
    name: 'remediation_steps',
    type: 'text',
    nullable: true,
  })
  remediationSteps?: string;

  /** Preventive measures for future */
  @Column({
    name: 'preventive_measures',
    type: 'text',
    nullable: true,
  })
  preventiveMeasures?: string;

  // Notification tracking

  /** Data Commissioner notification sent */
  @Column({
    name: 'commissioner_notified',
    type: 'boolean',
    default: false,
  })
  commissionerNotified!: boolean;

  /** Data Commissioner notification timestamp */
  @Column({
    name: 'commissioner_notified_at',
    type: 'timestamptz',
    nullable: true,
  })
  commissionerNotifiedAt?: Date;

  /** Affected users notified */
  @Column({
    name: 'users_notified',
    type: 'boolean',
    default: false,
  })
  usersNotified!: boolean;

  /** Users notification timestamp */
  @Column({
    name: 'users_notified_at',
    type: 'timestamptz',
    nullable: true,
  })
  usersNotifiedAt?: Date;

  /** Management notified */
  @Column({
    name: 'management_notified',
    type: 'boolean',
    default: false,
  })
  managementNotified!: boolean;

  /** Management notification timestamp */
  @Column({
    name: 'management_notified_at',
    type: 'timestamptz',
    nullable: true,
  })
  managementNotifiedAt?: Date;

  /** Additional notes/timeline */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  timeline?: Array<{
    timestamp: Date;
    action: string;
    actor?: string;
    notes?: string;
  }>;

  /** Related audit event IDs */
  @Column({
    name: 'related_audit_events',
    type: 'simple-array',
    nullable: true,
  })
  relatedAuditEvents?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Check if 72-hour notification deadline is approaching
   */
  isNotificationDeadlineApproaching(): boolean {
    if (this.commissionerNotified) return false;
    const hoursSinceDetection =
      (Date.now() - this.detectedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceDetection >= 48 && hoursSinceDetection < 72;
  }

  /**
   * Check if 72-hour notification deadline has passed
   */
  isNotificationOverdue(): boolean {
    if (this.commissionerNotified) return false;
    const hoursSinceDetection =
      (Date.now() - this.detectedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceDetection >= 72;
  }

  /**
   * Hours remaining until notification deadline
   */
  hoursUntilDeadline(): number {
    const hoursSinceDetection =
      (Date.now() - this.detectedAt.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 72 - hoursSinceDetection);
  }
}
