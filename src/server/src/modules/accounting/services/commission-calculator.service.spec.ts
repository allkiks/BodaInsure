import { Test, TestingModule } from '@nestjs/testing';
import { CommissionCalculatorService } from './commission-calculator.service.js';

describe('CommissionCalculatorService', () => {
  let service: CommissionCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommissionCalculatorService],
    }).compile();

    service = module.get<CommissionCalculatorService>(CommissionCalculatorService);
  });

  describe('calculateCommission', () => {
    it('should calculate commission for a single policy correctly', () => {
      // Annual premium: 3565 KES
      // Pure premium ratio: 3500/3565
      // Pure premium: 3565 * (3500/3565) = 3500 KES
      // Commission (9%): 3500 * 0.09 = 315 KES
      const result = service.calculateCommission(1);

      expect(result.totalCommission).toBe(31500); // 315 KES in cents
      expect(result.policyCount).toBe(1);
    });

    it('should calculate commission for multiple policies', () => {
      const result = service.calculateCommission(100);

      // 100 policies * 315 KES = 31,500 KES = 3,150,000 cents
      expect(result.totalCommission).toBe(3150000);
      expect(result.policyCount).toBe(100);
    });

    it('should return zero commission for zero policies', () => {
      const result = service.calculateCommission(0);

      expect(result.totalCommission).toBe(0);
      expect(result.breakdown.platformOm).toBe(0);
      expect(result.breakdown.jointMobilization).toBe(0);
      expect(result.breakdown.profitShare).toBe(0);
    });

    it('should handle large policy counts', () => {
      const result = service.calculateCommission(10000);

      // 10,000 policies * 315 KES = 3,150,000 KES
      expect(result.totalCommission).toBe(315000000);
      expect(result.policyCount).toBe(10000);
    });
  });

  describe('commission breakdown', () => {
    it('should allocate Platform O&M correctly (KES 100 per rider)', () => {
      const result = service.calculateCommission(100);

      // Platform O&M: 100 riders * KES 100 = KES 10,000 = 1,000,000 cents
      expect(result.breakdown.platformOm).toBe(1000000);
    });

    it('should allocate joint mobilization correctly (50% KBA, 50% Robs)', () => {
      const result = service.calculateCommission(100);

      // Total commission: 100 * 315 = 31,500 KES
      // After Platform O&M (10,000 KES): 21,500 KES remaining
      // Joint mobilization gets portion of this

      expect(result.breakdown.jointMobilization).toBeGreaterThan(0);
      expect(result.distribution.kbaJointMobilization).toBe(
        result.distribution.robsJointMobilization,
      );
    });

    it('should allocate profit share correctly (3-way split)', () => {
      const result = service.calculateCommission(100);

      // Profit share split 3 ways
      const { platformProfitShare, kbaProfitShare, robsProfitShare } = result.distribution;

      // All three should be equal
      expect(platformProfitShare).toBe(kbaProfitShare);
      expect(kbaProfitShare).toBe(robsProfitShare);
    });

    it('should ensure breakdown components sum to total', () => {
      const result = service.calculateCommission(100);

      const breakdownSum =
        result.breakdown.platformOm +
        result.breakdown.jointMobilization +
        result.breakdown.profitShare;

      expect(breakdownSum).toBe(result.totalCommission);
    });
  });

  describe('distribution calculation', () => {
    it('should calculate platform total correctly', () => {
      const result = service.calculateCommission(100);

      // Platform gets: O&M + 1/3 profit share
      const expectedPlatformTotal =
        result.breakdown.platformOm + result.distribution.platformProfitShare;

      expect(result.distribution.platformTotal).toBe(expectedPlatformTotal);
    });

    it('should calculate KBA total correctly', () => {
      const result = service.calculateCommission(100);

      // KBA gets: 50% joint mobilization + 1/3 profit share
      const expectedKbaTotal =
        result.distribution.kbaJointMobilization + result.distribution.kbaProfitShare;

      expect(result.distribution.kbaTotal).toBe(expectedKbaTotal);
    });

    it('should calculate Robs total correctly', () => {
      const result = service.calculateCommission(100);

      // Robs gets: 50% joint mobilization + 1/3 profit share
      const expectedRobsTotal =
        result.distribution.robsJointMobilization + result.distribution.robsProfitShare;

      expect(result.distribution.robsTotal).toBe(expectedRobsTotal);
    });

    it('should ensure all distributions sum to total commission', () => {
      const result = service.calculateCommission(100);

      const distributionSum =
        result.distribution.platformTotal +
        result.distribution.kbaTotal +
        result.distribution.robsTotal;

      expect(distributionSum).toBe(result.totalCommission);
    });
  });

  describe('calculateMonthlyCommission', () => {
    const mockPolicies = [
      { id: 'p1', riderId: 'r1', status: 'ACTIVE' },
      { id: 'p2', riderId: 'r2', status: 'ACTIVE' },
      { id: 'p3', riderId: 'r3', status: 'ACTIVE' },
    ];

    it('should calculate monthly commission based on policy count', () => {
      const result = service.calculateMonthlyCommission(mockPolicies as any);

      expect(result.policyCount).toBe(3);
      expect(result.totalCommission).toBe(94500); // 3 * 315 KES = 945 KES
    });

    it('should count unique riders correctly', () => {
      const policiesWithDuplicateRiders = [
        { id: 'p1', riderId: 'r1', status: 'ACTIVE' },
        { id: 'p2', riderId: 'r1', status: 'ACTIVE' }, // Same rider
        { id: 'p3', riderId: 'r2', status: 'ACTIVE' },
      ];

      const result = service.calculateMonthlyCommission(policiesWithDuplicateRiders as any);

      expect(result.uniqueRiders).toBe(2);
    });

    it('should handle empty policy array', () => {
      const result = service.calculateMonthlyCommission([]);

      expect(result.policyCount).toBe(0);
      expect(result.totalCommission).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle fractional cents by rounding', () => {
      // With 1 policy, some calculations might result in fractions
      const result = service.calculateCommission(1);

      // All amounts should be integers (cents)
      expect(Number.isInteger(result.totalCommission)).toBe(true);
      expect(Number.isInteger(result.breakdown.platformOm)).toBe(true);
      expect(Number.isInteger(result.breakdown.jointMobilization)).toBe(true);
      expect(Number.isInteger(result.breakdown.profitShare)).toBe(true);
    });

    it('should not produce negative values', () => {
      const result = service.calculateCommission(1);

      expect(result.totalCommission).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.platformOm).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.jointMobilization).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.profitShare).toBeGreaterThanOrEqual(0);
      expect(result.distribution.platformTotal).toBeGreaterThanOrEqual(0);
      expect(result.distribution.kbaTotal).toBeGreaterThanOrEqual(0);
      expect(result.distribution.robsTotal).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large policy counts without overflow', () => {
      // 700,000 target riders
      const result = service.calculateCommission(700000);

      expect(result.policyCount).toBe(700000);
      expect(result.totalCommission).toBeGreaterThan(0);

      // Verify no overflow (should be reasonable KES amount)
      // 700,000 * 315 KES = 220,500,000 KES = 22,050,000,000 cents
      expect(result.totalCommission).toBe(22050000000);
    });
  });

  describe('constants validation', () => {
    it('should use correct pure premium ratio (3500/3565)', () => {
      // This tests that the service uses the correct ratio from Accounting_Remediation.md
      const singlePolicyResult = service.calculateCommission(1);

      // Annual premium: 3565 KES
      // Pure premium: 3565 * (3500/3565) ≈ 3500 KES
      // Commission: 3500 * 0.09 = 315 KES = 31500 cents
      expect(singlePolicyResult.totalCommission).toBe(31500);
    });

    it('should use 9% commission rate', () => {
      const result = service.calculateCommission(1);

      // With 9% rate on 3500 KES pure premium = 315 KES
      expect(result.totalCommission).toBe(31500);
    });

    it('should allocate KES 100 per rider for Platform O&M', () => {
      const result = service.calculateCommission(10);

      // 10 riders * KES 100 = KES 1000 = 100000 cents
      expect(result.breakdown.platformOm).toBe(100000);
    });
  });
});
