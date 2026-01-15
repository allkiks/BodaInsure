import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EscrowTracking, RemittanceStatus } from '../entities/escrow-tracking.entity.js';
import { PartnerType } from '../entities/partner-settlement.entity.js';

/**
 * Rider premium data for commission calculation
 */
export interface RiderPremiumData {
  riderId: string;
  totalPremium: number; // in cents
  isFullTerm: boolean;
  daysCompleted: number;
}

/**
 * Commission calculation result
 */
export interface CommissionCalculationResult {
  periodStart: Date;
  periodEnd: Date;
  totalPremiumToDefinite: number;
  purePremium: number;
  totalCommission: number;
  distribution: {
    platformOM: number;
    platformProfit: number;
    kba: number;
    robs: number;
  };
  fullTermRiders: number;
  partialRiders: number;
  totalRiders: number;
  breakdown: CommissionBreakdown;
}

/**
 * Detailed commission breakdown
 */
export interface CommissionBreakdown {
  kbaMobilization: number;
  robsMobilization: number;
  kbaJointPortion: number;
  robsJointPortion: number;
  profitSharePerParty: number;
  remainingAfterOM: number;
}

/**
 * Partner commission summary
 */
export interface PartnerCommissionSummary {
  partnerType: PartnerType;
  partnerName: string;
  commissionAmount: number;
  components: {
    name: string;
    amount: number;
  }[];
}

/**
 * Commission Calculator Service
 *
 * Implements the commission calculation algorithm per Boda Ledger specification.
 *
 * Per Accounting_Remediation.md - Epic 7
 *
 * Commission Distribution Algorithm:
 * 1. Calculate total premium remitted to Definite
 * 2. Calculate pure premium (3500/3565 ratio)
 * 3. Calculate total commission (9% of pure premium)
 * 4. Distribute:
 *    - Platform O&M: KES 100 per full-term rider
 *    - Joint Mobilization: KES 100 per full-term rider (50% KBA, 50% Robs)
 *    - Joint Portion: KES 4 per full-term rider (50% KBA, 50% Robs)
 *    - Remaining: Split 3 ways (Platform, KBA, Robs)
 */
@Injectable()
export class CommissionCalculatorService {
  private readonly logger = new Logger(CommissionCalculatorService.name);

  // Constants from Boda Ledger specification
  private readonly PURE_PREMIUM_RATIO = 3500 / 3565;
  private readonly COMMISSION_RATE = 0.09; // 9%
  private readonly PLATFORM_OM_PER_RIDER = 10000; // KES 100 in cents
  private readonly JOINT_MOBILIZATION_PER_RIDER = 10000; // KES 100 total in cents
  private readonly JOINT_PORTION_PER_RIDER = 400; // KES 4 total in cents
  private readonly FULL_TERM_DAYS = 31; // Day 1 deposit + 30 daily payments

  constructor(
    @InjectRepository(EscrowTracking)
    private readonly escrowRepository: Repository<EscrowTracking>,
  ) {}

  /**
   * Calculate commission for a settlement period
   *
   * @param riderPremiums - Array of rider premium data
   * @param periodStart - Start of commission period
   * @param periodEnd - End of commission period
   */
  calculateMonthlyCommission(
    riderPremiums: RiderPremiumData[],
    periodStart: Date,
    periodEnd: Date,
  ): CommissionCalculationResult {
    // Step 1: Calculate total premium to Definite
    const totalPremiumToDefinite = riderPremiums.reduce(
      (sum, r) => sum + r.totalPremium,
      0,
    );

    // Step 2: Calculate pure premium
    const purePremium = Math.round(totalPremiumToDefinite * this.PURE_PREMIUM_RATIO);

    // Step 3: Calculate total commission (9% of pure premium)
    const totalCommission = Math.round(purePremium * this.COMMISSION_RATE);

    // Step 4: Count full-term riders
    const fullTermRiders = riderPremiums.filter((r) => r.isFullTerm).length;
    const partialRiders = riderPremiums.length - fullTermRiders;

    // Step 5: Calculate distribution
    const platformOM = this.PLATFORM_OM_PER_RIDER * fullTermRiders;
    const jointMobilization = this.JOINT_MOBILIZATION_PER_RIDER * fullTermRiders;
    const jointPortion = this.JOINT_PORTION_PER_RIDER * fullTermRiders;

    const kbaMobilization = Math.round(jointMobilization / 2);
    const robsMobilization = jointMobilization - kbaMobilization; // Remainder to avoid rounding
    const kbaJointPortion = Math.round(jointPortion / 2);
    const robsJointPortion = jointPortion - kbaJointPortion; // Remainder

    const remainingAfterOM = totalCommission - platformOM - jointMobilization - jointPortion;
    const profitSharePerParty = Math.round(remainingAfterOM / 3);

    // Final distribution (ensure totals match)
    const distribution = {
      platformOM,
      platformProfit: profitSharePerParty,
      kba: kbaMobilization + kbaJointPortion + profitSharePerParty,
      robs: robsMobilization + robsJointPortion + profitSharePerParty,
    };

    // Verify total distribution matches commission
    const distributionTotal =
      distribution.platformOM +
      distribution.platformProfit +
      distribution.kba +
      distribution.robs;

    // Adjust for any rounding differences (assign to platform profit)
    if (distributionTotal !== totalCommission) {
      const difference = totalCommission - distributionTotal;
      distribution.platformProfit += difference;
      this.logger.debug(
        `Adjusted platform profit by ${difference / 100} KES for rounding`,
      );
    }

    const breakdown: CommissionBreakdown = {
      kbaMobilization,
      robsMobilization,
      kbaJointPortion,
      robsJointPortion,
      profitSharePerParty,
      remainingAfterOM,
    };

    this.logger.log(
      `Calculated commission: total=${totalCommission / 100} KES, ` +
      `fullTerm=${fullTermRiders}, partial=${partialRiders}`,
    );

    return {
      periodStart,
      periodEnd,
      totalPremiumToDefinite,
      purePremium,
      totalCommission,
      distribution,
      fullTermRiders,
      partialRiders,
      totalRiders: riderPremiums.length,
      breakdown,
    };
  }

  /**
   * Get rider premium data from escrow records for a period
   *
   * @param periodStart - Start of period
   * @param periodEnd - End of period
   */
  async getRiderPremiumsForPeriod(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RiderPremiumData[]> {
    // Get all remitted escrow records for the period
    const escrowRecords = await this.escrowRepository.find({
      where: {
        remittanceStatus: RemittanceStatus.REMITTED,
        remittedAt: Between(periodStart, periodEnd),
      },
    });

    // Group by rider
    const riderMap = new Map<string, { premiums: number[]; days: Set<number> }>();

    for (const escrow of escrowRecords) {
      const existing = riderMap.get(escrow.riderId) || { premiums: [], days: new Set() };
      existing.premiums.push(Number(escrow.premiumAmount));
      existing.days.add(escrow.paymentDay);
      riderMap.set(escrow.riderId, existing);
    }

    // Convert to RiderPremiumData
    const riderPremiums: RiderPremiumData[] = [];
    for (const [riderId, data] of riderMap) {
      const totalPremium = data.premiums.reduce((sum, p) => sum + p, 0);
      const daysCompleted = data.days.size;
      const isFullTerm = daysCompleted >= this.FULL_TERM_DAYS;

      riderPremiums.push({
        riderId,
        totalPremium,
        isFullTerm,
        daysCompleted,
      });
    }

    return riderPremiums;
  }

  /**
   * Calculate and return partner commission summaries
   *
   * @param calculationResult - Result from calculateMonthlyCommission
   */
  getPartnerCommissionSummaries(
    calculationResult: CommissionCalculationResult,
  ): PartnerCommissionSummary[] {
    const { distribution, breakdown } = calculationResult;

    return [
      {
        partnerType: PartnerType.ATRONACH,
        partnerName: 'Atronach K Ltd (Platform)',
        commissionAmount: distribution.platformOM + distribution.platformProfit,
        components: [
          { name: 'O&M Fee', amount: distribution.platformOM },
          { name: 'Profit Share', amount: distribution.platformProfit },
        ],
      },
      {
        partnerType: PartnerType.KBA,
        partnerName: 'Kenya Bodaboda Association',
        commissionAmount: distribution.kba,
        components: [
          { name: 'Mobilization Fee', amount: breakdown.kbaMobilization },
          { name: 'Joint Portion', amount: breakdown.kbaJointPortion },
          { name: 'Profit Share', amount: breakdown.profitSharePerParty },
        ],
      },
      {
        partnerType: PartnerType.ROBS_INSURANCE,
        partnerName: 'Robs Insurance Agency',
        commissionAmount: distribution.robs,
        components: [
          { name: 'Mobilization Fee', amount: breakdown.robsMobilization },
          { name: 'Joint Portion', amount: breakdown.robsJointPortion },
          { name: 'Profit Share', amount: breakdown.profitSharePerParty },
        ],
      },
    ];
  }

  /**
   * Run full commission calculation for a period
   *
   * Convenience method that fetches rider data and calculates commission.
   *
   * @param periodStart - Start of period
   * @param periodEnd - End of period
   */
  async calculateForPeriod(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<CommissionCalculationResult> {
    const riderPremiums = await this.getRiderPremiumsForPeriod(periodStart, periodEnd);
    return this.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);
  }

  /**
   * Validate commission calculation
   *
   * Ensures all amounts balance correctly.
   */
  validateCalculation(result: CommissionCalculationResult): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check distribution sums to total commission
    const distributionTotal =
      result.distribution.platformOM +
      result.distribution.platformProfit +
      result.distribution.kba +
      result.distribution.robs;

    if (distributionTotal !== result.totalCommission) {
      errors.push(
        `Distribution total (${distributionTotal}) does not match total commission (${result.totalCommission})`,
      );
    }

    // Check pure premium calculation
    const expectedPurePremium = Math.round(
      result.totalPremiumToDefinite * this.PURE_PREMIUM_RATIO,
    );
    if (Math.abs(result.purePremium - expectedPurePremium) > 1) {
      errors.push(
        `Pure premium (${result.purePremium}) does not match expected (${expectedPurePremium})`,
      );
    }

    // Check commission rate
    const expectedCommission = Math.round(result.purePremium * this.COMMISSION_RATE);
    if (Math.abs(result.totalCommission - expectedCommission) > 1) {
      errors.push(
        `Total commission (${result.totalCommission}) does not match expected (${expectedCommission})`,
      );
    }

    // Check rider counts
    if (result.fullTermRiders + result.partialRiders !== result.totalRiders) {
      errors.push(
        `Rider counts don't add up: ${result.fullTermRiders} + ${result.partialRiders} != ${result.totalRiders}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
