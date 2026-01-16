import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity.js';
import {
  Membership,
  MembershipStatus,
  MemberRole,
} from '../organization/entities/membership.entity.js';
import {
  PolicyTerms,
  PolicyTermsType,
} from '../policy/entities/policy-terms.entity.js';
import { User, UserRole, UserStatus, KycStatus } from '../identity/entities/user.entity.js';
import {
  GlAccount,
  GlAccountStatus,
} from '../accounting/entities/gl-account.entity.js';
import {
  NotificationTemplate,
  TemplateStatus,
  DEFAULT_TEMPLATES,
} from '../notification/entities/notification-template.entity.js';
import { NotificationChannel, NotificationType } from '../notification/entities/notification.entity.js';
import {
  // Organizations seed data
  KBA_CONFIG,
  SACCO_SEEDS,
  SACCO_DEFAULT_CONFIG,
  // Policy terms seed data
  TPO_POLICY_TERMS_SEED,
  // Users seed data (for phone numbers)
  SEEDED_PHONES,
  ADDITIONAL_RIDERS,
  // Chart of Accounts seed data
  CHART_OF_ACCOUNTS,
  CHART_OF_ACCOUNTS_SUMMARY,
  getNormalBalanceForType,
} from '../../database/seeds/index.js';
import { SimpleProgress } from '../../common/utils/progress.util.js';

/**
 * Data seeding result
 */
export interface DataSeedingResult {
  success: boolean;
  organizationsSeeded: number;
  policyTermsSeeded: number;
  testPoliciesSeeded: number;
  usersMapped: number;
  glAccountsSeeded: number;
  templatesSeeded: number;
  error?: string;
}

/**
 * Data Seeder Service
 *
 * Seeds essential configuration data:
 * - Organizations (KBA, SACCOs)
 * - Policy Terms (TPO terms)
 * - User-Organization mappings
 * - Test Policies (for rider users in development)
 *
 * Seed data is sourced from: src/database/seeds/
 *
 * This service is called by SeedingRunnerService after user seeding completes.
 * All seeding is idempotent - safe to run multiple times.
 */
@Injectable()
export class DataSeederService {
  private readonly logger = new Logger(DataSeederService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(PolicyTerms)
    private readonly policyTermsRepository: Repository<PolicyTerms>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(GlAccount)
    private readonly glAccountRepository: Repository<GlAccount>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
  ) {}

  /**
   * Run data seeding
   * Called by SeedingRunnerService
   *
   * Progress visibility:
   * - Displays each seeding step with status indicators
   * - Shows whether data was created or already exists
   */
  async seed(): Promise<DataSeedingResult> {
    const progress = new SimpleProgress('DataSeeder');

    let organizationsSeeded = 0;
    let policyTermsSeeded = 0;
    let testPoliciesSeeded = 0;
    let usersMapped = 0;
    let glAccountsSeeded = 0;
    let templatesSeeded = 0;

    try {
      // Step 1: Seed organizations
      progress.start('Seeding organizations (KBA + SACCOs)');
      const orgResult = await this.seedOrganizations();
      organizationsSeeded = orgResult;
      if (orgResult > 0) {
        progress.complete('Organizations seeded', `${orgResult} created`);
      } else {
        progress.skip('Organizations', 'already exist');
      }

      // Step 2: Seed policy terms
      progress.start('Seeding policy terms (TPO)');
      const termsResult = await this.seedPolicyTerms();
      policyTermsSeeded = termsResult;
      if (termsResult > 0) {
        progress.complete('Policy terms seeded', `${termsResult} created`);
      } else {
        progress.skip('Policy terms', 'already exist');
      }

      // Step 3: Seed Chart of Accounts (GL accounts)
      progress.start('Seeding GL accounts (Chart of Accounts)');
      const glResult = await this.seedChartOfAccounts();
      glAccountsSeeded = glResult;
      if (glResult > 0) {
        progress.complete('GL accounts seeded', `${glResult} created`);
      } else {
        progress.skip('GL accounts', 'already exist');
      }

      // Step 4: Seed notification templates
      progress.start('Seeding notification templates (SMS + Email)');
      const templateResult = await this.seedNotificationTemplates();
      templatesSeeded = templateResult;
      if (templateResult > 0) {
        progress.complete('Templates seeded', `${templateResult} created`);
      } else {
        progress.skip('Templates', 'already exist');
      }

      // Step 5: Map users to organizations
      progress.start('Mapping users to organizations');
      const mappingResult = await this.mapUsersToOrganizations();
      usersMapped = mappingResult;
      if (mappingResult > 0) {
        progress.complete('User mappings created', `${mappingResult} memberships`);
      } else {
        progress.skip('User mappings', 'already exist');
      }

      // NOTE: Test policies are NOT seeded because:
      // - Riders start with PENDING KYC status
      // - Riders cannot make payments until KYC is APPROVED
      // - No payments = no policies
      testPoliciesSeeded = 0;

      return {
        success: true,
        organizationsSeeded,
        policyTermsSeeded,
        testPoliciesSeeded,
        usersMapped,
        glAccountsSeeded,
        templatesSeeded,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.fail('Configuration seeding failed', errorMessage);
      return {
        success: false,
        organizationsSeeded,
        policyTermsSeeded,
        testPoliciesSeeded,
        usersMapped,
        glAccountsSeeded,
        templatesSeeded,
        error: errorMessage,
      };
    }
  }

  /**
   * Seed organizations (KBA and SACCOs)
   * Idempotent - skips if organizations already exist
   * @returns Number of organizations seeded
   */
  private async seedOrganizations(): Promise<number> {
    // Check if KBA already exists
    const existingKba = await this.organizationRepository.findOne({
      where: { code: KBA_CONFIG.code },
    });

    if (existingKba) {
      this.logger.log('Organizations already seeded, skipping...');
      return 0;
    }

    this.logger.log('Seeding organizations...');

    // Create Kenya Bodaboda Association (KBA) - Umbrella Body
    const kba = this.organizationRepository.create({
      name: KBA_CONFIG.name,
      code: KBA_CONFIG.code,
      type: KBA_CONFIG.type,
      status: KBA_CONFIG.status,
      description: KBA_CONFIG.description,
      registrationNumber: KBA_CONFIG.registrationNumber,
      kraPin: KBA_CONFIG.kraPin,
      contactPhone: KBA_CONFIG.contactPhone,
      contactEmail: KBA_CONFIG.contactEmail,
      address: KBA_CONFIG.address,
      countyCode: KBA_CONFIG.countyCode,
      subCounty: KBA_CONFIG.subCounty,
      leaderName: KBA_CONFIG.leaderName,
      leaderPhone: KBA_CONFIG.leaderPhone,
      secretaryName: KBA_CONFIG.secretaryName,
      secretaryPhone: KBA_CONFIG.secretaryPhone,
      treasurerName: KBA_CONFIG.treasurerName,
      treasurerPhone: KBA_CONFIG.treasurerPhone,
      estimatedMembers: KBA_CONFIG.estimatedMembers,
      verifiedMembers: KBA_CONFIG.verifiedMembers,
      commissionRate: KBA_CONFIG.commissionRate,
      verifiedAt: new Date(),
    });

    const savedKba = await this.organizationRepository.save(kba);

    // Create SACCOs from seed data
    for (const saccoData of SACCO_SEEDS) {
      const sacco = this.organizationRepository.create({
        name: saccoData.name,
        code: saccoData.code,
        type: SACCO_DEFAULT_CONFIG.type,
        status: SACCO_DEFAULT_CONFIG.status,
        parentId: savedKba.id,
        countyCode: saccoData.countyCode,
        subCounty: saccoData.subCounty,
        estimatedMembers: saccoData.estimatedMembers,
        verifiedMembers: SACCO_DEFAULT_CONFIG.verifiedMembers,
        leaderName: saccoData.leaderName,
        contactPhone: saccoData.contactPhone,
        commissionRate: SACCO_DEFAULT_CONFIG.commissionRate,
        verifiedAt: new Date(),
      });

      await this.organizationRepository.save(sacco);
    }

    const totalSeeded = 1 + SACCO_SEEDS.length; // KBA + SACCOs
    this.logger.log(`Seeded KBA and ${SACCO_SEEDS.length} SACCOs`);
    this.displayOrganizationSummary(savedKba.id, SACCO_SEEDS.length);

    return totalSeeded;
  }

  /**
   * Seed policy terms (TPO terms)
   * Idempotent - skips if terms already exist
   * @returns Number of policy terms seeded
   */
  private async seedPolicyTerms(): Promise<number> {
    // Check if TPO terms already exist
    const existingTerms = await this.policyTermsRepository.findOne({
      where: { type: PolicyTermsType.TPO, isActive: true },
    });

    if (existingTerms) {
      this.logger.log('Policy terms already seeded, skipping...');
      return 0;
    }

    this.logger.log('Seeding policy terms...');

    const tpoTerms = this.policyTermsRepository.create({
      version: TPO_POLICY_TERMS_SEED.version,
      type: TPO_POLICY_TERMS_SEED.type,
      title: TPO_POLICY_TERMS_SEED.title,
      content: TPO_POLICY_TERMS_SEED.content,
      summary: TPO_POLICY_TERMS_SEED.summary,
      contentSw: TPO_POLICY_TERMS_SEED.contentSw,
      summarySw: TPO_POLICY_TERMS_SEED.summarySw,
      keyTerms: [...TPO_POLICY_TERMS_SEED.keyTerms],
      keyTermsSw: [...TPO_POLICY_TERMS_SEED.keyTermsSw],
      inclusions: [...TPO_POLICY_TERMS_SEED.inclusions],
      exclusions: [...TPO_POLICY_TERMS_SEED.exclusions],
      freeLookDays: TPO_POLICY_TERMS_SEED.freeLookDays,
      underwriterName: TPO_POLICY_TERMS_SEED.underwriterName,
      cancellationPolicy: TPO_POLICY_TERMS_SEED.cancellationPolicy,
      claimsProcess: TPO_POLICY_TERMS_SEED.claimsProcess,
      effectiveFrom: new Date(),
      isActive: TPO_POLICY_TERMS_SEED.isActive,
    });

    await this.policyTermsRepository.save(tpoTerms);
    this.logger.log(`Seeded TPO policy terms v${TPO_POLICY_TERMS_SEED.version}`);

    return 1;
  }

  /**
   * Seed Chart of Accounts (GL accounts)
   * Idempotent - skips if accounts already exist
   * @returns Number of GL accounts seeded
   */
  private async seedChartOfAccounts(): Promise<number> {
    // Check if accounts already exist by looking for the first account
    const existingAccount = await this.glAccountRepository.findOne({
      where: { accountCode: '1001' },
    });

    if (existingAccount) {
      this.logger.log('Chart of Accounts already seeded, skipping...');
      return 0;
    }

    this.logger.log('Seeding Chart of Accounts...');

    let seededCount = 0;
    for (const accountConfig of CHART_OF_ACCOUNTS) {
      const normalBalance = getNormalBalanceForType(accountConfig.type);

      const account = this.glAccountRepository.create({
        accountCode: accountConfig.code,
        accountName: accountConfig.name,
        accountType: accountConfig.type,
        description: accountConfig.description,
        normalBalance,
        status: GlAccountStatus.ACTIVE,
        isSystemAccount: true,
        balance: 0,
      });

      await this.glAccountRepository.save(account);
      seededCount++;
    }

    this.logger.log(`Seeded ${seededCount} GL accounts`);
    this.displayChartOfAccountsSummary();

    return seededCount;
  }

  /**
   * Display Chart of Accounts seeding summary
   */
  private displayChartOfAccountsSummary(): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║              CHART OF ACCOUNTS SUMMARY                        ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Asset Accounts:     ${String(CHART_OF_ACCOUNTS_SUMMARY.assetAccounts).padEnd(38)}║`);
    this.logger.log(`║  Liability Accounts: ${String(CHART_OF_ACCOUNTS_SUMMARY.liabilityAccounts).padEnd(38)}║`);
    this.logger.log(`║  Income Accounts:    ${String(CHART_OF_ACCOUNTS_SUMMARY.incomeAccounts).padEnd(38)}║`);
    this.logger.log(`║  Expense Accounts:   ${String(CHART_OF_ACCOUNTS_SUMMARY.expenseAccounts).padEnd(38)}║`);
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Total GL Accounts:  ${String(CHART_OF_ACCOUNTS_SUMMARY.totalAccounts).padEnd(38)}║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');
  }

  /**
   * Map seeded users to their organizations
   * Creates both user.organizationId mapping AND membership records
   * Idempotent - only creates records if they don't exist
   * @returns Number of users mapped
   */
  private async mapUsersToOrganizations(): Promise<number> {
    // Find KBA organization
    const kba = await this.organizationRepository.findOne({
      where: { code: 'KBA' },
    });

    // Find first SACCO (Nairobi Metro SACCO)
    const nairobiSacco = await this.organizationRepository.findOne({
      where: { code: 'NMS' },
    });

    if (!kba || !nairobiSacco) {
      this.logger.warn('Organizations not found, skipping user mapping');
      return 0;
    }

    let mappedCount = 0;

    // Map test RIDER to Nairobi Metro SACCO
    const rider = await this.userRepository.findOne({
      where: { phone: SEEDED_PHONES.RIDER, role: UserRole.RIDER },
    });

    if (rider) {
      // Update user's organizationId if not set
      if (!rider.organizationId) {
        rider.organizationId = nairobiSacco.id;
        await this.userRepository.save(rider);
      }

      // Always check/create membership record
      await this.ensureMembership(rider.id, nairobiSacco.id, MemberRole.MEMBER, `NMS-${rider.phone.slice(-4)}`);
      mappedCount++;
    }

    // Map SACCO_ADMIN to Nairobi Metro SACCO
    const saccoAdmin = await this.userRepository.findOne({
      where: { phone: SEEDED_PHONES.SACCO_ADMIN, role: UserRole.SACCO_ADMIN },
    });

    if (saccoAdmin) {
      // Update user's organizationId if not set
      if (!saccoAdmin.organizationId) {
        saccoAdmin.organizationId = nairobiSacco.id;
        await this.userRepository.save(saccoAdmin);
      }

      // Always check/create membership record
      await this.ensureMembership(saccoAdmin.id, nairobiSacco.id, MemberRole.ADMIN);
      mappedCount++;
    }

    // Map KBA_ADMIN to KBA
    const kbaAdmin = await this.userRepository.findOne({
      where: { phone: SEEDED_PHONES.KBA_ADMIN, role: UserRole.KBA_ADMIN },
    });

    if (kbaAdmin) {
      // Update user's organizationId if not set
      if (!kbaAdmin.organizationId) {
        kbaAdmin.organizationId = kba.id;
        await this.userRepository.save(kbaAdmin);
      }

      // Always check/create membership record
      await this.ensureMembership(kbaAdmin.id, kba.id, MemberRole.ADMIN);
      mappedCount++;
    }

    // Seed additional rider members for Nairobi Metro SACCO
    for (const riderConfig of ADDITIONAL_RIDERS) {
      // Check if user exists, create if not
      let additionalRider = await this.userRepository.findOne({
        where: { phone: riderConfig.phone },
      });

      if (!additionalRider) {
        // Riders start with PENDING KYC status - no documents uploaded yet
        additionalRider = this.userRepository.create({
          phone: riderConfig.phone,
          fullName: riderConfig.fullName,
          nationalId: riderConfig.nationalId,
          role: UserRole.RIDER,
          status: UserStatus.ACTIVE,
          kycStatus: KycStatus.PENDING,
          organizationId: nairobiSacco.id,
        });
        await this.userRepository.save(additionalRider);
        this.logger.log(`Created rider user: ${riderConfig.fullName}`);
      }

      // Always check/create membership record
      await this.ensureMembership(
        additionalRider.id,
        nairobiSacco.id,
        MemberRole.MEMBER,
        `NMS-${additionalRider.phone.slice(-4)}`,
      );
      mappedCount++;
    }

    if (mappedCount > 0) {
      this.logger.log(`Created ${mappedCount} membership(s)`);
      this.displayUserMappingSummary(rider, saccoAdmin, kbaAdmin, nairobiSacco, kba);
    } else {
      this.logger.log('Memberships already exist, skipping...');
    }

    return mappedCount;
  }

  /**
   * Ensure a membership record exists for a user in an organization
   * Creates the membership if it doesn't exist, skips if it does
   */
  private async ensureMembership(
    userId: string,
    organizationId: string,
    role: MemberRole,
    memberNumber?: string,
  ): Promise<void> {
    // Check if membership already exists
    const existing = await this.membershipRepository.findOne({
      where: { userId, organizationId },
    });

    if (existing) {
      return; // Membership already exists, nothing to do
    }

    // Create new membership record
    const membership = this.membershipRepository.create({
      userId,
      organizationId,
      status: MembershipStatus.ACTIVE,
      role,
      isPrimary: true,
      joinedAt: new Date(),
      approvedAt: new Date(),
      memberNumber,
    });

    await this.membershipRepository.save(membership);
    this.logger.log(`Created membership: user=${userId.slice(0, 8)}... org=${organizationId.slice(0, 8)}... role=${role}`);
  }

  /**
   * Display user-organization mapping summary
   */
  private displayUserMappingSummary(
    rider: User | null,
    saccoAdmin: User | null,
    kbaAdmin: User | null,
    sacco: Organization,
    kba: Organization,
  ): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║              USER-ORGANIZATION MAPPINGS                       ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log('║  Role          │ Phone           │ Organization              ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    if (rider) {
      this.logger.log(`║  RIDER         │ ${SEEDED_PHONES.RIDER}  │ ${sacco.name.padEnd(25)}║`);
    }
    if (saccoAdmin) {
      this.logger.log(`║  SACCO_ADMIN   │ ${SEEDED_PHONES.SACCO_ADMIN}  │ ${sacco.name.padEnd(25)}║`);
    }
    if (kbaAdmin) {
      this.logger.log(`║  KBA_ADMIN     │ ${SEEDED_PHONES.KBA_ADMIN}  │ ${kba.name.padEnd(25)}║`);
    }
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');
  }

  /**
   * Display organization seeding summary
   */
  private displayOrganizationSummary(_kbaId: string, saccoCount: number): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║              SEEDED ORGANIZATIONS SUMMARY                     ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log('║  Type           │ Code  │ Name                               ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  UMBRELLA_BODY  │ ${KBA_CONFIG.code.padEnd(5)} │ ${KBA_CONFIG.name.padEnd(34)}║`);
    for (const sacco of SACCO_SEEDS) {
      this.logger.log(`║  SACCO          │ ${sacco.code.padEnd(5)} │ ${sacco.name.padEnd(34)}║`);
    }
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Total: 1 Umbrella Body + ${saccoCount} SACCOs                          ║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');
  }

  /**
   * Seed notification templates (SMS and Email)
   * Idempotent - skips if templates already exist by code
   * @returns Number of templates seeded
   */
  private async seedNotificationTemplates(): Promise<number> {
    // Check if any templates exist by looking for the first default SMS template
    const existingTemplate = await this.templateRepository.findOne({
      where: { code: 'SMS_OTP' },
    });

    if (existingTemplate) {
      this.logger.log('Notification templates already seeded, skipping...');
      return 0;
    }

    this.logger.log('Seeding notification templates...');

    let seededCount = 0;

    // Seed SMS templates from DEFAULT_TEMPLATES
    for (const defaultTemplate of DEFAULT_TEMPLATES) {
      const existing = await this.templateRepository.findOne({
        where: { code: defaultTemplate.code },
      });

      if (!existing) {
        await this.templateRepository.save(
          this.templateRepository.create({
            ...defaultTemplate,
            status: TemplateStatus.ACTIVE,
            locale: 'en',
            version: 1,
          }),
        );
        seededCount++;
      }
    }

    // Seed email templates
    const emailTemplates = this.getDefaultEmailTemplates();
    for (const emailTemplate of emailTemplates) {
      const existing = await this.templateRepository.findOne({
        where: { code: emailTemplate.code },
      });

      if (!existing) {
        await this.templateRepository.save(
          this.templateRepository.create({
            ...emailTemplate,
            status: TemplateStatus.ACTIVE,
            locale: 'en',
            version: 1,
          }),
        );
        seededCount++;
      }
    }

    this.logger.log(`Seeded ${seededCount} notification templates`);
    this.displayTemplateSummary(seededCount);

    return seededCount;
  }

  /**
   * Get default email templates for seeding
   */
  private getDefaultEmailTemplates(): Array<Partial<NotificationTemplate>> {
    return [
      {
        code: 'EMAIL_WELCOME',
        name: 'Welcome Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.WELCOME,
        subject: 'Welcome to BodaInsure!',
        body: `Welcome to BodaInsure, {{name}}!

Thank you for registering with BodaInsure. You're now part of Kenya's first micro-payment insurance platform for bodaboda riders.

To get started:
1. Complete your KYC verification
2. Make your initial deposit of KES 1,048
3. Receive your 1-month TPO insurance policy
4. Pay KES 87 daily to build up to your 11-month policy

Stay safe on the roads!

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('Welcome to BodaInsure!', 'Hi {{name}},', `
          <p>Thank you for registering with BodaInsure! You're now part of Kenya's first micro-payment insurance platform for bodaboda riders.</p>
          <h3>To get started:</h3>
          <ol>
            <li>Complete your KYC verification</li>
            <li>Make your initial deposit of KES 1,048</li>
            <li>Receive your 1-month TPO insurance policy</li>
            <li>Pay KES 87 daily to build up to your 11-month policy</li>
          </ol>
          <p>Stay safe on the roads!</p>
        `),
        previewText: 'Welcome to BodaInsure! Get started with your insurance today.',
        requiredVariables: ['name'],
      },
      {
        code: 'EMAIL_PAYMENT_CONFIRMATION',
        name: 'Payment Confirmation Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.PAYMENT_RECEIVED,
        subject: 'Payment Received - KES {{amount}}',
        body: `Payment Received - BodaInsure

Hi {{name}},

We received your payment of KES {{amount}}.

Transaction ID: {{transactionId}}
Date: {{paymentDate}}
Wallet Balance: KES {{walletBalance}}

Thank you for your payment!

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('Payment Received', 'Hi {{name}},', `
          <p>We've received your payment. Thank you!</p>
          <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p><strong>Amount:</strong> KES {{amount}}</p>
            <p><strong>Transaction ID:</strong> {{transactionId}}</p>
            <p><strong>Wallet Balance:</strong> KES {{walletBalance}}</p>
          </div>
        `),
        previewText: 'Your payment of KES {{amount}} has been received.',
        requiredVariables: ['name', 'amount', 'transactionId', 'paymentDate', 'walletBalance'],
      },
      {
        code: 'EMAIL_POLICY_ISSUED',
        name: 'Policy Certificate Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.POLICY_ISSUED,
        subject: 'Your BodaInsure Policy Certificate - {{policyNumber}}',
        body: `Your BodaInsure Policy Certificate

Hi {{name}},

Your insurance policy has been issued!

Policy Number: {{policyNumber}}
Vehicle: {{vehicleReg}}
Valid From: {{validFrom}}
Valid To: {{validTo}}

Please find your policy certificate attached to this email.
Keep this document safe - you may need it for traffic police verification.

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('Your Policy Certificate', 'Hi {{name}},', `
          <p>Great news! Your insurance policy has been issued.</p>
          <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p><strong>Policy Number:</strong> {{policyNumber}}</p>
            <p><strong>Vehicle:</strong> {{vehicleReg}}</p>
            <p><strong>Valid From:</strong> {{validFrom}}</p>
            <p><strong>Valid To:</strong> {{validTo}}</p>
          </div>
          <p>Your policy certificate is attached to this email. Please keep it safe!</p>
        `),
        previewText: 'Your insurance policy {{policyNumber}} is now active!',
        requiredVariables: ['name', 'policyNumber', 'vehicleReg', 'validFrom', 'validTo'],
      },
      {
        code: 'EMAIL_PAYMENT_REMINDER',
        name: 'Payment Reminder Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.PAYMENT_REMINDER,
        subject: 'Payment Reminder - BodaInsure',
        body: `Payment Reminder - BodaInsure

Hi {{name}},

Your daily payment is {{daysOverdue}} day(s) overdue.

Amount Due: KES {{amountDue}}
Grace Period Remaining: {{graceDaysRemaining}} days

Please make your payment to maintain your insurance coverage.

Pay now via M-Pesa PayBill: 247247
Account: BodaInsure

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('Payment Reminder', 'Hi {{name}},', `
          <p>Your daily payment is <strong>{{daysOverdue}} day(s)</strong> overdue.</p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p><strong>Amount Due:</strong> KES {{amountDue}}</p>
            <p><strong>Grace Period Remaining:</strong> {{graceDaysRemaining}} days</p>
          </div>
          <p>Please make your payment to maintain your insurance coverage.</p>
          <p><strong>PayBill:</strong> 247247<br><strong>Account:</strong> BodaInsure</p>
        `, '#dc2626'),
        previewText: 'Your daily payment is overdue. Please pay to maintain coverage.',
        requiredVariables: ['name', 'daysOverdue', 'amountDue', 'graceDaysRemaining'],
      },
      {
        code: 'EMAIL_POLICY_EXPIRY',
        name: 'Policy Expiry Warning Email',
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.POLICY_EXPIRING,
        subject: 'Policy Expiring Soon - {{policyNumber}}',
        body: `Policy Expiry Warning - BodaInsure

Hi {{name}},

Your policy {{policyNumber}} will expire in {{daysUntilExpiry}} days.

Expiry Date: {{expiryDate}}

Continue your daily payments to maintain coverage, or make a deposit payment to start a new policy cycle.

BodaInsure Team`,
        htmlBody: this.generateEmailHtml('Policy Expiring Soon', 'Hi {{name}},', `
          <p>Your policy <strong>{{policyNumber}}</strong> will expire in <strong>{{daysUntilExpiry}} days</strong>.</p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p><strong>Expiry Date:</strong> {{expiryDate}}</p>
          </div>
          <p>Continue your daily payments to maintain coverage.</p>
        `, '#f59e0b'),
        previewText: 'Your policy {{policyNumber}} expires in {{daysUntilExpiry}} days.',
        requiredVariables: ['name', 'policyNumber', 'daysUntilExpiry', 'expiryDate'],
      },
    ];
  }

  /**
   * Generate consistent HTML email template for seeding
   */
  private generateEmailHtml(title: string, greeting: string, content: string, headerColor = '#2563eb'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: ${headerColor}; color: white; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <p>${greeting}</p>
      ${content}
    </div>
    <div style="padding: 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">
      <p style="margin: 4px 0;"><strong>BodaInsure</strong> - Insurance Made Simple</p>
      <p style="margin: 4px 0;">Questions? Email us at <a href="mailto:support@bodainsure.co.ke" style="color: #3b82f6; text-decoration: none;">support@bodainsure.co.ke</a></p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Display template seeding summary
   */
  private displayTemplateSummary(count: number): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║              NOTIFICATION TEMPLATES SUMMARY                   ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  SMS Templates:    ${String(DEFAULT_TEMPLATES.length).padEnd(40)}║`);
    this.logger.log(`║  Email Templates:  ${String(5).padEnd(40)}║`);
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Total Templates:  ${String(count).padEnd(40)}║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');
  }

}
