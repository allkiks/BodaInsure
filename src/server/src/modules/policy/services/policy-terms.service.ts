import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, Or } from 'typeorm';
import * as crypto from 'crypto';
import {
  PolicyTerms,
  PolicyTermsType,
  PolicyTermsAcknowledgment,
} from '../entities/policy-terms.entity.js';

/**
 * Create policy terms request
 */
export interface CreatePolicyTermsRequest {
  version: string;
  type?: PolicyTermsType;
  title: string;
  content: string;
  summary?: string;
  contentSw?: string;
  summarySw?: string;
  keyTerms?: string[];
  keyTermsSw?: string[];
  inclusions?: string[];
  exclusions?: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  underwriterName: string;
  iraApprovalRef?: string;
  freeLookDays?: number;
  cancellationPolicy?: string;
  claimsProcess?: string;
  pdfUrl?: string;
  createdBy?: string;
}

/**
 * Acknowledge terms request
 */
export interface AcknowledgeTermsRequest {
  userId: string;
  termsId: string;
  ipAddress?: string;
  userAgent?: string;
  channel?: string;
  policyId?: string;
}

/**
 * Terms acknowledgment status
 */
export interface TermsAcknowledgmentStatus {
  acknowledged: boolean;
  acknowledgment?: PolicyTermsAcknowledgment;
  currentTerms?: PolicyTerms;
  requiresReAcknowledgment: boolean;
}

/**
 * Policy Terms Service
 * CR-IRA-003: Policy terms display and acknowledgment
 *
 * IRA Requirements:
 * - Terms must be displayed before policy issuance
 * - User acknowledgment must be recorded with timestamp
 * - 30-day free look period disclosure
 */
@Injectable()
export class PolicyTermsService {
  private readonly logger = new Logger(PolicyTermsService.name);

  constructor(
    @InjectRepository(PolicyTerms)
    private readonly termsRepository: Repository<PolicyTerms>,
    @InjectRepository(PolicyTermsAcknowledgment)
    private readonly acknowledgmentRepository: Repository<PolicyTermsAcknowledgment>,
  ) {}

  /**
   * Create new policy terms version
   */
  async createTerms(request: CreatePolicyTermsRequest): Promise<PolicyTerms> {
    const terms = this.termsRepository.create({
      version: request.version,
      type: request.type ?? PolicyTermsType.TPO,
      title: request.title,
      content: request.content,
      summary: request.summary,
      contentSw: request.contentSw,
      summarySw: request.summarySw,
      keyTerms: request.keyTerms,
      keyTermsSw: request.keyTermsSw,
      inclusions: request.inclusions,
      exclusions: request.exclusions,
      effectiveFrom: request.effectiveFrom,
      effectiveTo: request.effectiveTo,
      underwriterName: request.underwriterName,
      iraApprovalRef: request.iraApprovalRef,
      freeLookDays: request.freeLookDays ?? 30,
      cancellationPolicy: request.cancellationPolicy,
      claimsProcess: request.claimsProcess,
      pdfUrl: request.pdfUrl,
      createdBy: request.createdBy,
      isActive: true,
    });

    await this.termsRepository.save(terms);

    this.logger.log(
      `Created policy terms v${request.version} for ${request.type ?? 'TPO'}`,
    );

    return terms;
  }

  /**
   * Get current active terms for a policy type
   */
  async getCurrentTerms(type: PolicyTermsType = PolicyTermsType.TPO): Promise<PolicyTerms | null> {
    const now = new Date();

    return this.termsRepository.findOne({
      where: {
        type,
        isActive: true,
        effectiveFrom: LessThanOrEqual(now),
        effectiveTo: Or(IsNull(), LessThanOrEqual(now)) as any,
      },
      order: { effectiveFrom: 'DESC', version: 'DESC' },
    });
  }

  /**
   * Get terms by ID
   */
  async getTermsById(termsId: string): Promise<PolicyTerms | null> {
    return this.termsRepository.findOne({
      where: { id: termsId },
    });
  }

  /**
   * Get terms by version
   */
  async getTermsByVersion(
    version: string,
    type: PolicyTermsType = PolicyTermsType.TPO,
  ): Promise<PolicyTerms | null> {
    return this.termsRepository.findOne({
      where: { version, type },
    });
  }

  /**
   * List all terms versions
   */
  async listTerms(options?: {
    type?: PolicyTermsType;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ terms: PolicyTerms[]; total: number }> {
    const { type, activeOnly = false, page = 1, limit = 20 } = options ?? {};

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (activeOnly) where.isActive = true;

    const [terms, total] = await this.termsRepository.findAndCount({
      where,
      order: { effectiveFrom: 'DESC', version: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { terms, total };
  }

  /**
   * Deactivate terms version
   */
  async deactivateTerms(termsId: string): Promise<PolicyTerms> {
    const terms = await this.termsRepository.findOne({
      where: { id: termsId },
    });

    if (!terms) {
      throw new NotFoundException(`Terms not found: ${termsId}`);
    }

    terms.isActive = false;
    await this.termsRepository.save(terms);

    this.logger.log(`Deactivated policy terms v${terms.version}`);

    return terms;
  }

  /**
   * Record user acknowledgment of terms
   */
  async acknowledgeTerms(
    request: AcknowledgeTermsRequest,
  ): Promise<PolicyTermsAcknowledgment> {
    const { userId, termsId, ipAddress, userAgent, channel, policyId } = request;

    // Verify terms exist
    const terms = await this.termsRepository.findOne({
      where: { id: termsId },
    });

    if (!terms) {
      throw new NotFoundException(`Terms not found: ${termsId}`);
    }

    // Check for existing acknowledgment
    const existing = await this.acknowledgmentRepository.findOne({
      where: { userId, termsId },
    });

    if (existing) {
      this.logger.debug(
        `User ${userId} already acknowledged terms v${terms.version}`,
      );
      return existing;
    }

    // Generate checksum of terms content
    const termsChecksum = crypto
      .createHash('sha256')
      .update(terms.content)
      .digest('hex');

    // Create acknowledgment record
    const acknowledgment = this.acknowledgmentRepository.create({
      userId,
      termsId,
      acknowledgedAt: new Date(),
      ipAddress,
      userAgent,
      channel: channel ?? 'app',
      policyId,
      consentText: `I have read and agree to the ${terms.title} (Version ${terms.version})`,
      termsChecksum,
    });

    await this.acknowledgmentRepository.save(acknowledgment);

    this.logger.log(
      `User ${userId} acknowledged terms v${terms.version} via ${channel ?? 'app'}`,
    );

    return acknowledgment;
  }

  /**
   * Check if user has acknowledged current terms
   */
  async checkAcknowledgmentStatus(
    userId: string,
    type: PolicyTermsType = PolicyTermsType.TPO,
  ): Promise<TermsAcknowledgmentStatus> {
    // Get current active terms
    const currentTerms = await this.getCurrentTerms(type);

    if (!currentTerms) {
      return {
        acknowledged: true, // No terms = no acknowledgment needed
        requiresReAcknowledgment: false,
      };
    }

    // Get user's acknowledgment for current terms
    const acknowledgment = await this.acknowledgmentRepository.findOne({
      where: {
        userId,
        termsId: currentTerms.id,
      },
      order: { acknowledgedAt: 'DESC' },
    });

    if (acknowledgment) {
      // Verify checksum matches (terms haven't changed)
      const currentChecksum = crypto
        .createHash('sha256')
        .update(currentTerms.content)
        .digest('hex');

      const requiresReAcknowledgment =
        acknowledgment.termsChecksum !== currentChecksum;

      return {
        acknowledged: !requiresReAcknowledgment,
        acknowledgment,
        currentTerms,
        requiresReAcknowledgment,
      };
    }

    return {
      acknowledged: false,
      currentTerms,
      requiresReAcknowledgment: false,
    };
  }

  /**
   * Get user's acknowledgment history
   */
  async getUserAcknowledgments(
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{
    acknowledgments: Array<PolicyTermsAcknowledgment & { terms?: PolicyTerms }>;
    total: number;
  }> {
    const { page = 1, limit = 20 } = options ?? {};

    const [acknowledgments, total] =
      await this.acknowledgmentRepository.findAndCount({
        where: { userId },
        order: { acknowledgedAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    // Fetch associated terms
    const result = await Promise.all(
      acknowledgments.map(async (ack) => {
        const terms = await this.termsRepository.findOne({
          where: { id: ack.termsId },
        });
        return { ...ack, terms: terms ?? undefined };
      }),
    );

    return {
      acknowledgments: result,
      total,
    };
  }

  /**
   * Validate terms acknowledgment for policy issuance
   * Returns true if user can proceed with policy
   */
  async validateForPolicyIssuance(
    userId: string,
    type: PolicyTermsType = PolicyTermsType.TPO,
  ): Promise<{
    canProceed: boolean;
    reason?: string;
    termsId?: string;
  }> {
    const status = await this.checkAcknowledgmentStatus(userId, type);

    if (!status.currentTerms) {
      // No terms configured - allow (but log warning)
      this.logger.warn(
        `No active terms found for ${type}, allowing policy issuance`,
      );
      return { canProceed: true };
    }

    if (!status.acknowledged) {
      return {
        canProceed: false,
        reason: 'User must acknowledge policy terms before issuance',
        termsId: status.currentTerms.id,
      };
    }

    if (status.requiresReAcknowledgment) {
      return {
        canProceed: false,
        reason: 'Terms have been updated, user must re-acknowledge',
        termsId: status.currentTerms.id,
      };
    }

    return { canProceed: true };
  }

  /**
   * Get terms for USSD display (short format)
   */
  async getTermsForUssd(
    type: PolicyTermsType = PolicyTermsType.TPO,
    language: 'en' | 'sw' = 'en',
  ): Promise<{
    summary: string;
    keyTerms: string[];
    termsId: string;
  } | null> {
    const terms = await this.getCurrentTerms(type);

    if (!terms) {
      return null;
    }

    const summary =
      language === 'sw' && terms.summarySw
        ? terms.summarySw
        : terms.summary ?? terms.title;

    const keyTerms =
      language === 'sw' && terms.keyTermsSw
        ? terms.keyTermsSw
        : terms.keyTerms ?? [];

    return {
      summary,
      keyTerms,
      termsId: terms.id,
    };
  }

  /**
   * Get free look period info
   */
  async getFreeLookPeriod(
    type: PolicyTermsType = PolicyTermsType.TPO,
  ): Promise<number> {
    const terms = await this.getCurrentTerms(type);
    return terms?.freeLookDays ?? 30;
  }

  /**
   * Seed default TPO terms (for initial setup)
   */
  async seedDefaultTerms(): Promise<PolicyTerms> {
    const existing = await this.getCurrentTerms(PolicyTermsType.TPO);
    if (existing) {
      this.logger.debug('Default terms already exist');
      return existing;
    }

    const defaultTerms = await this.createTerms({
      version: '1.0',
      type: PolicyTermsType.TPO,
      title: 'BodaInsure Third-Party Only (TPO) Insurance Terms',
      content: `
<h2>BodaInsure Third-Party Only (TPO) Insurance Policy Terms and Conditions</h2>

<h3>1. Coverage</h3>
<p>This policy provides Third-Party Only (TPO) insurance coverage for bodaboda (motorcycle taxi) operators in Kenya, as required by the Insurance (Motor Vehicle Third Party Risks) Act.</p>

<h3>2. What is Covered</h3>
<ul>
  <li>Legal liability for death or bodily injury to third parties</li>
  <li>Legal liability for damage to third party property</li>
  <li>Legal costs awarded against you</li>
  <li>Emergency medical treatment costs</li>
</ul>

<h3>3. What is NOT Covered</h3>
<ul>
  <li>Damage to your own motorcycle</li>
  <li>Personal injury to yourself</li>
  <li>Loss of personal property</li>
  <li>Damage while driving under influence of alcohol/drugs</li>
  <li>Use for purposes other than licensed bodaboda operations</li>
  <li>Unlicensed drivers</li>
</ul>

<h3>4. Policy Period</h3>
<ul>
  <li>Policy 1 (Initial): 1 month from deposit payment</li>
  <li>Policy 2 (Extended): 11 months after 30 daily payments completed</li>
</ul>

<h3>5. Premium Payment</h3>
<ul>
  <li>Initial Deposit: KES 1,048</li>
  <li>Daily Payment: KES 87 for 30 days</li>
  <li>Total Annual Premium: KES 3,658</li>
</ul>

<h3>6. Grace Period</h3>
<p>A 7-day grace period applies for late payments. After this period, coverage may lapse.</p>

<h3>7. Free Look Period</h3>
<p>You have 30 days from the policy start date to cancel and receive a full refund if you are not satisfied.</p>

<h3>8. Claims Process</h3>
<p>To file a claim:</p>
<ol>
  <li>Report the incident to police within 24 hours</li>
  <li>Contact Definite Assurance Company within 48 hours</li>
  <li>Provide police abstract, P3 form, and claim form</li>
</ol>

<h3>9. Cancellation</h3>
<p>You may cancel this policy at any time. Refunds are calculated on a pro-rata basis after the free look period.</p>

<h3>10. Underwriter</h3>
<p>This policy is underwritten by Definite Assurance Company Ltd, registered with the Insurance Regulatory Authority of Kenya.</p>
      `.trim(),
      summary:
        'TPO insurance covering third-party liability for bodaboda riders. Covers injury to others and property damage. Does NOT cover your motorcycle or personal injury.',
      contentSw: `
<h2>Masharti ya Bima ya Wahusika wa Tatu (TPO) ya BodaInsure</h2>

<h3>1. Chanzo</h3>
<p>Sera hii inatoa bima ya Third-Party Only (TPO) kwa waendesha bodaboda nchini Kenya.</p>

<h3>2. Nini Kinacholindwa</h3>
<ul>
  <li>Dhima ya kisheria kwa kifo au jeraha la wahusika wa tatu</li>
  <li>Dhima ya kisheria kwa uharibifu wa mali ya wahusika wa tatu</li>
</ul>

<h3>3. Nini HAKIJAFUNIKWA</h3>
<ul>
  <li>Uharibifu wa pikipiki yako</li>
  <li>Jeraha lako binafsi</li>
</ul>

<h3>7. Kipindi cha Kuangalia Bure</h3>
<p>Una siku 30 kuanzia tarehe ya kuanza sera kufuta na kupokea marejesho kamili.</p>
      `.trim(),
      summarySw:
        'Bima ya TPO inayofunika dhima ya wahusika wa tatu kwa waendesha bodaboda. Inashughulikia jeraha kwa wengine na uharibifu wa mali.',
      keyTerms: [
        'Third-party liability coverage',
        '30-day free look period',
        '7-day grace period for payments',
        'KES 1,048 initial deposit',
        'KES 87 daily payment',
      ],
      keyTermsSw: [
        'Bima ya wahusika wa tatu',
        'Siku 30 za kuangalia bure',
        'Siku 7 za neema kwa malipo',
        'Amana ya awali KES 1,048',
        'Malipo ya kila siku KES 87',
      ],
      inclusions: [
        'Third-party death or bodily injury',
        'Third-party property damage',
        'Legal costs',
        'Emergency medical treatment',
      ],
      exclusions: [
        'Own motorcycle damage',
        'Personal injury to rider',
        'Driving under influence',
        'Unlicensed operation',
        'Non-bodaboda use',
      ],
      effectiveFrom: new Date(),
      underwriterName: 'Definite Assurance Company Ltd',
      freeLookDays: 30,
      cancellationPolicy:
        'Full refund within 30 days. Pro-rata refund thereafter minus admin fee.',
      claimsProcess:
        '1. Report to police within 24hrs. 2. Contact Definite Assurance within 48hrs. 3. Submit police abstract, P3 form, and claim form.',
    });

    this.logger.log('Seeded default TPO policy terms v1.0');
    return defaultTerms;
  }
}
