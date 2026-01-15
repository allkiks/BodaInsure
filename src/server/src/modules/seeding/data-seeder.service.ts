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
  ) {}

  /**
   * Run data seeding
   * Called by SeedingRunnerService
   */
  async seed(): Promise<DataSeedingResult> {
    this.logger.log('Starting configuration data seeding...');

    let organizationsSeeded = 0;
    let policyTermsSeeded = 0;
    let testPoliciesSeeded = 0;
    let usersMapped = 0;
    let glAccountsSeeded = 0;

    try {
      // Seed organizations
      const orgResult = await this.seedOrganizations();
      organizationsSeeded = orgResult;

      // Seed policy terms
      const termsResult = await this.seedPolicyTerms();
      policyTermsSeeded = termsResult;

      // Map users to organizations
      const mappingResult = await this.mapUsersToOrganizations();
      usersMapped = mappingResult;

      // Seed Chart of Accounts (GL accounts)
      const glResult = await this.seedChartOfAccounts();
      glAccountsSeeded = glResult;

      // NOTE: Test policies are NOT seeded because:
      // - Riders start with PENDING KYC status
      // - Riders cannot make payments until KYC is APPROVED
      // - No payments = no policies
      // To test policies, complete KYC for a rider first, then make a payment
      testPoliciesSeeded = 0;

      this.logger.log('Configuration data seeding completed');

      return {
        success: true,
        organizationsSeeded,
        policyTermsSeeded,
        testPoliciesSeeded,
        usersMapped,
        glAccountsSeeded,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Configuration data seeding failed', error);
      return {
        success: false,
        organizationsSeeded,
        policyTermsSeeded,
        testPoliciesSeeded,
        usersMapped,
        glAccountsSeeded,
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

}
