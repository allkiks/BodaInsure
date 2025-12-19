import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Organization,
  OrganizationType,
  OrganizationStatus,
} from '../organization/entities/organization.entity.js';
import {
  PolicyTerms,
  PolicyTermsType,
} from '../policy/entities/policy-terms.entity.js';
import { User, UserRole } from '../identity/entities/user.entity.js';

/**
 * Data Seeder Service
 *
 * Seeds essential configuration data on first run:
 * - Organizations (KBA, SACCOs)
 * - Policy Terms (TPO terms)
 * - User-Organization mappings
 *
 * Idempotent: Only seeds if data doesn't exist
 */
@Injectable()
export class DataSeederService implements OnModuleInit {
  private readonly logger = new Logger(DataSeederService.name);

  // Phone numbers for seeded admin users (from SeederService)
  private readonly KBA_ADMIN_PHONE = '+254722000002';
  private readonly SACCO_ADMIN_PHONE = '+254722000001';

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(PolicyTerms)
    private readonly policyTermsRepository: Repository<PolicyTerms>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Starting configuration data seeding...');

    try {
      await this.seedOrganizations();
      await this.seedPolicyTerms();
      await this.mapUsersToOrganizations();
      this.logger.log('Configuration data seeding completed');
    } catch (error) {
      this.logger.error('Configuration data seeding failed', error);
    }
  }

  /**
   * Seed organizations (KBA and SACCOs)
   * Idempotent - skips if organizations already exist
   */
  private async seedOrganizations(): Promise<void> {
    // Check if KBA already exists
    const existingKba = await this.organizationRepository.findOne({
      where: { code: 'KBA' },
    });

    if (existingKba) {
      this.logger.log('Organizations already seeded, skipping...');
      return;
    }

    this.logger.log('Seeding organizations...');

    // Create Kenya Bodaboda Association (KBA) - Umbrella Body
    const kba = this.organizationRepository.create({
      name: 'Kenya Bodaboda Association',
      code: 'KBA',
      type: OrganizationType.UMBRELLA_BODY,
      status: OrganizationStatus.ACTIVE,
      description: 'National umbrella body for all bodaboda operators in Kenya',
      registrationNumber: 'KBA/REG/2020/001',
      kraPin: 'P051234567A',
      contactPhone: '+254700000001',
      contactEmail: 'info@kba.co.ke',
      address: 'Nairobi CBD, Kenya',
      countyCode: '047', // Nairobi
      subCounty: 'Nairobi Central',
      leaderName: 'John Kamau',
      leaderPhone: '+254700000002',
      secretaryName: 'Mary Wanjiku',
      secretaryPhone: '+254700000003',
      treasurerName: 'Peter Ochieng',
      treasurerPhone: '+254700000004',
      estimatedMembers: 700000,
      verifiedMembers: 0,
      commissionRate: 5.0,
      verifiedAt: new Date(),
    });

    const savedKba = await this.organizationRepository.save(kba);

    // Create sample SACCOs under KBA
    const saccos = [
      {
        name: 'Nairobi Metro SACCO',
        code: 'NMS',
        countyCode: '047',
        subCounty: 'Westlands',
        estimatedMembers: 5000,
        leaderName: 'James Mwangi',
        contactPhone: '+254711000001',
      },
      {
        name: 'Mombasa Riders SACCO',
        code: 'MRS',
        countyCode: '001',
        subCounty: 'Mvita',
        estimatedMembers: 3500,
        leaderName: 'Hassan Ali',
        contactPhone: '+254711000002',
      },
      {
        name: 'Kisumu Boda SACCO',
        code: 'KBS',
        countyCode: '042',
        subCounty: 'Kisumu Central',
        estimatedMembers: 2800,
        leaderName: 'Otieno Ouma',
        contactPhone: '+254711000003',
      },
      {
        name: 'Nakuru Riders SACCO',
        code: 'NRS',
        countyCode: '032',
        subCounty: 'Nakuru Town East',
        estimatedMembers: 2200,
        leaderName: 'David Kiprop',
        contactPhone: '+254711000004',
      },
      {
        name: 'Eldoret Express SACCO',
        code: 'EES',
        countyCode: '027',
        subCounty: 'Eldoret',
        estimatedMembers: 1800,
        leaderName: 'Kibet Cheruiyot',
        contactPhone: '+254711000005',
      },
    ];

    for (const saccoData of saccos) {
      const sacco = this.organizationRepository.create({
        name: saccoData.name,
        code: saccoData.code,
        type: OrganizationType.SACCO,
        status: OrganizationStatus.ACTIVE,
        parentId: savedKba.id,
        countyCode: saccoData.countyCode,
        subCounty: saccoData.subCounty,
        estimatedMembers: saccoData.estimatedMembers,
        verifiedMembers: 0,
        leaderName: saccoData.leaderName,
        contactPhone: saccoData.contactPhone,
        commissionRate: 2.5,
        verifiedAt: new Date(),
      });

      await this.organizationRepository.save(sacco);
    }

    this.logger.log(`Seeded KBA and ${saccos.length} SACCOs`);
    this.displayOrganizationSummary(savedKba.id, saccos.length);
  }

  /**
   * Seed policy terms (TPO terms)
   * Idempotent - skips if terms already exist
   */
  private async seedPolicyTerms(): Promise<void> {
    // Check if TPO terms already exist
    const existingTerms = await this.policyTermsRepository.findOne({
      where: { type: PolicyTermsType.TPO, isActive: true },
    });

    if (existingTerms) {
      this.logger.log('Policy terms already seeded, skipping...');
      return;
    }

    this.logger.log('Seeding policy terms...');

    const tpoTerms = this.policyTermsRepository.create({
      version: '1.0',
      type: PolicyTermsType.TPO,
      title: 'Third Party Only (TPO) Motor Insurance Policy',
      content: `
<h1>Third Party Only (TPO) Motor Insurance Policy</h1>

<h2>1. POLICY COVERAGE</h2>
<p>This policy provides coverage for third-party liability arising from the use of your motorcycle (bodaboda) on public roads in Kenya.</p>

<h3>1.1 What is Covered</h3>
<ul>
  <li>Legal liability for death or bodily injury to third parties</li>
  <li>Legal liability for damage to third-party property</li>
  <li>Legal costs and expenses incurred with the insurer's consent</li>
</ul>

<h3>1.2 Coverage Limits</h3>
<ul>
  <li>Bodily Injury: Unlimited</li>
  <li>Property Damage: Up to KES 3,000,000 per occurrence</li>
</ul>

<h2>2. EXCLUSIONS</h2>
<p>This policy does NOT cover:</p>
<ul>
  <li>Damage to your own motorcycle</li>
  <li>Your own bodily injury</li>
  <li>Theft of your motorcycle</li>
  <li>Loss of use or consequential losses</li>
  <li>Contractual liabilities</li>
  <li>Racing, speed testing, or competitions</li>
  <li>Use under the influence of alcohol or drugs</li>
  <li>Unlicensed or unauthorized drivers</li>
</ul>

<h2>3. PREMIUM PAYMENT</h2>
<p>Premium is payable as follows:</p>
<ul>
  <li>Initial Deposit: KES 1,048 (provides 1-month coverage)</li>
  <li>Daily Payments: KES 87 for 30 days (provides 11-month coverage)</li>
  <li>Total Annual Premium: KES 3,658</li>
</ul>

<h2>4. POLICY PERIOD</h2>
<p>This policy is valid for the period shown in your policy schedule. Coverage begins at 00:01 hours on the commencement date.</p>

<h2>5. CLAIMS PROCEDURE</h2>
<p>In the event of an accident:</p>
<ol>
  <li>Report to the nearest police station within 24 hours</li>
  <li>Notify BodaInsure via the app or USSD within 48 hours</li>
  <li>Do not admit liability or make any settlement</li>
  <li>Provide all requested documentation</li>
</ol>

<h2>6. CANCELLATION</h2>
<p>You may cancel this policy within 30 days of commencement for a full refund (Free Look Period). After 30 days, refunds are calculated on a pro-rata basis.</p>

<h2>7. GOVERNING LAW</h2>
<p>This policy is governed by the laws of Kenya and subject to the jurisdiction of Kenyan courts.</p>

<h2>8. REGULATORY COMPLIANCE</h2>
<p>This policy complies with the Insurance Act (Cap 487) and regulations by the Insurance Regulatory Authority (IRA) of Kenya.</p>
      `.trim(),
      summary: 'TPO insurance covering third-party liability for bodaboda riders. Covers injury to others and damage to their property. Does not cover your own motorcycle or injuries.',
      contentSw: `
<h1>Bima ya Mtu wa Tatu Pekee (TPO) kwa Pikipiki</h1>

<h2>1. ULINZI WA BIMA</h2>
<p>Bima hii inalinda dhidi ya madai ya kisheria kutoka kwa watu wengine yatokanayo na matumizi ya pikipiki yako (bodaboda) katika barabara za umma nchini Kenya.</p>

<h3>1.1 Kinacholindwa</h3>
<ul>
  <li>Dhima ya kisheria kwa kifo au majeraha ya watu wengine</li>
  <li>Dhima ya kisheria kwa uharibifu wa mali ya watu wengine</li>
  <li>Gharama za kisheria zinazokubaliwa na bima</li>
</ul>

<h2>2. YASIYOLINDWA</h2>
<p>Bima hii HAILINDI:</p>
<ul>
  <li>Uharibifu wa pikipiki yako</li>
  <li>Majeraha yako mwenyewe</li>
  <li>Wizi wa pikipiki yako</li>
</ul>

<h2>3. MALIPO YA BIMA</h2>
<ul>
  <li>Amana ya Awali: KES 1,048 (ulinzi wa mwezi 1)</li>
  <li>Malipo ya Kila Siku: KES 87 kwa siku 30 (ulinzi wa miezi 11)</li>
  <li>Jumla ya Bima ya Mwaka: KES 3,658</li>
</ul>
      `.trim(),
      summarySw: 'Bima ya TPO inalinda dhidi ya madai ya watu wengine. Inalinda majeraha ya wengine na uharibifu wa mali yao. Hailindi pikipiki yako au majeraha yako.',
      keyTerms: [
        'Third-party liability coverage',
        'Unlimited bodily injury cover',
        'Property damage up to KES 3M',
        '30-day free look period',
        'Daily payment option available',
      ],
      keyTermsSw: [
        'Ulinzi wa dhima ya mtu wa tatu',
        'Ulinzi usio na kikomo kwa majeraha',
        'Uharibifu wa mali hadi KES 3M',
        'Kipindi cha siku 30 cha kutazama bure',
        'Chaguo la malipo ya kila siku',
      ],
      inclusions: [
        'Third-party bodily injury liability',
        'Third-party property damage liability',
        'Legal defense costs',
        'Emergency assistance hotline',
      ],
      exclusions: [
        'Own damage to motorcycle',
        'Personal injury to policyholder',
        'Theft or loss of motorcycle',
        'Racing or speed testing',
        'Driving under influence',
        'Unlicensed drivers',
      ],
      freeLookDays: 30,
      underwriterName: 'Definite Assurance Company Ltd',
      cancellationPolicy: 'Full refund within 30-day free look period. Pro-rata refund thereafter minus administrative fee of KES 500.',
      claimsProcess: '1. Report to police within 24 hours. 2. Notify BodaInsure within 48 hours. 3. Submit required documents. 4. Claim assessment within 14 days.',
      effectiveFrom: new Date(),
      isActive: true,
    });

    await this.policyTermsRepository.save(tpoTerms);
    this.logger.log('Seeded TPO policy terms v1.0');
  }

  /**
   * Map seeded admin users to their organizations
   * Idempotent - only updates users not already mapped
   */
  private async mapUsersToOrganizations(): Promise<void> {
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
      return;
    }

    let mappedCount = 0;

    // Map KBA_ADMIN to KBA
    const kbaAdmin = await this.userRepository.findOne({
      where: { phone: this.KBA_ADMIN_PHONE, role: UserRole.KBA_ADMIN },
    });

    if (kbaAdmin && !kbaAdmin.organizationId) {
      kbaAdmin.organizationId = kba.id;
      await this.userRepository.save(kbaAdmin);
      this.logger.log(`Mapped KBA_ADMIN to ${kba.name}`);
      mappedCount++;
    }

    // Map SACCO_ADMIN to Nairobi Metro SACCO
    const saccoAdmin = await this.userRepository.findOne({
      where: { phone: this.SACCO_ADMIN_PHONE, role: UserRole.SACCO_ADMIN },
    });

    if (saccoAdmin && !saccoAdmin.organizationId) {
      saccoAdmin.organizationId = nairobiSacco.id;
      await this.userRepository.save(saccoAdmin);
      this.logger.log(`Mapped SACCO_ADMIN to ${nairobiSacco.name}`);
      mappedCount++;
    }

    if (mappedCount > 0) {
      this.logger.log(`Mapped ${mappedCount} user(s) to organizations`);
      this.displayUserMappingSummary(kbaAdmin, saccoAdmin, kba, nairobiSacco);
    } else {
      this.logger.log('Users already mapped to organizations, skipping...');
    }
  }

  /**
   * Display user-organization mapping summary
   */
  private displayUserMappingSummary(
    kbaAdmin: User | null,
    saccoAdmin: User | null,
    kba: Organization,
    sacco: Organization,
  ): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log('║              USER-ORGANIZATION MAPPINGS                       ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log('║  Role          │ Phone           │ Organization              ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    if (kbaAdmin) {
      this.logger.log(`║  KBA_ADMIN     │ ${this.KBA_ADMIN_PHONE}  │ ${kba.name.padEnd(25)}║`);
    }
    if (saccoAdmin) {
      this.logger.log(`║  SACCO_ADMIN   │ ${this.SACCO_ADMIN_PHONE}  │ ${sacco.name.padEnd(25)}║`);
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
    this.logger.log('║  UMBRELLA_BODY  │ KBA   │ Kenya Bodaboda Association         ║');
    this.logger.log('║  SACCO          │ NMS   │ Nairobi Metro SACCO                ║');
    this.logger.log('║  SACCO          │ MRS   │ Mombasa Riders SACCO               ║');
    this.logger.log('║  SACCO          │ KBS   │ Kisumu Boda SACCO                  ║');
    this.logger.log('║  SACCO          │ NRS   │ Nakuru Riders SACCO                ║');
    this.logger.log('║  SACCO          │ EES   │ Eldoret Express SACCO              ║');
    this.logger.log('╠══════════════════════════════════════════════════════════════╣');
    this.logger.log(`║  Total: 1 Umbrella Body + ${saccoCount} SACCOs                          ║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');
  }
}
