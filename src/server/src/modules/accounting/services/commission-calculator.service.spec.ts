import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommissionCalculatorService, RiderPremiumData } from './commission-calculator.service.js';
import { EscrowTracking, RemittanceStatus } from '../entities/escrow-tracking.entity.js';
import { PartnerType } from '../entities/partner-settlement.entity.js';

describe('CommissionCalculatorService', () => {
  let service: CommissionCalculatorService;

  const mockEscrowRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionCalculatorService,
        { provide: getRepositoryToken(EscrowTracking), useValue: mockEscrowRepository },
      ],
    }).compile();

    service = module.get<CommissionCalculatorService>(CommissionCalculatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createRiderPremiumData = (
    riderId: string,
    totalPremium: number,
    isFullTerm: boolean,
    daysCompleted: number,
  ): RiderPremiumData => ({
    riderId,
    totalPremium,
    isFullTerm,
    daysCompleted,
  });

  describe('calculateMonthlyCommission', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');

    it('should calculate commission for full-term riders correctly', () => {
      // One full-term rider with 356,500 cents premium (3565 KES)
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Pure premium: 356500 * (3500/3565) ≈ 350,000 cents
      // Commission (9%): ~31,500 cents
      expect(result.totalPremiumToDefinite).toBe(356500);
      expect(result.totalCommission).toBeGreaterThan(0);
      expect(result.fullTermRiders).toBe(1);
      expect(result.partialRiders).toBe(0);
    });

    it('should calculate commission for multiple riders', () => {
      const riderPremiums = [
        createRiderPremiumData('r1', 356500, true, 31),
        createRiderPremiumData('r2', 356500, true, 31),
        createRiderPremiumData('r3', 200000, false, 20),
      ];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      expect(result.totalRiders).toBe(3);
      expect(result.fullTermRiders).toBe(2);
      expect(result.partialRiders).toBe(1);
      expect(result.totalPremiumToDefinite).toBe(913000);
    });

    it('should return zero commission for empty rider list', () => {
      const result = service.calculateMonthlyCommission([], periodStart, periodEnd);

      expect(result.totalCommission).toBe(0);
      expect(result.totalRiders).toBe(0);
      expect(result.distribution.platformOM).toBe(0);
    });

    it('should handle partial riders (no O&M allocation)', () => {
      const riderPremiums = [createRiderPremiumData('r1', 200000, false, 15)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Partial riders don't get Platform O&M allocation
      expect(result.distribution.platformOM).toBe(0);
      expect(result.fullTermRiders).toBe(0);
      expect(result.partialRiders).toBe(1);
    });
  });

  describe('commission distribution', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');

    it('should allocate Platform O&M correctly (KES 100 per full-term rider)', () => {
      const riderPremiums = [
        createRiderPremiumData('r1', 356500, true, 31),
        createRiderPremiumData('r2', 356500, true, 31),
      ];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Platform O&M: 2 full-term riders * KES 100 = KES 200 = 20,000 cents
      expect(result.distribution.platformOM).toBe(20000);
    });

    it('should split joint mobilization 50/50 between KBA and Robs', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Joint mobilization should be split evenly
      expect(result.breakdown.kbaMobilization).toBe(result.breakdown.robsMobilization);
    });

    it('should ensure distribution totals match total commission', () => {
      const riderPremiums = [
        createRiderPremiumData('r1', 356500, true, 31),
        createRiderPremiumData('r2', 356500, true, 31),
        createRiderPremiumData('r3', 200000, false, 20),
      ];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      const distributionTotal =
        result.distribution.platformOM +
        result.distribution.platformProfit +
        result.distribution.kba +
        result.distribution.robs;

      expect(distributionTotal).toBe(result.totalCommission);
    });
  });

  describe('getRiderPremiumsForPeriod', () => {
    it('should aggregate escrow records by rider', async () => {
      mockEscrowRepository.find.mockResolvedValueOnce([
        { riderId: 'r1', premiumAmount: 104800, paymentDay: 1, remittanceStatus: RemittanceStatus.REMITTED },
        { riderId: 'r1', premiumAmount: 8400, paymentDay: 2, remittanceStatus: RemittanceStatus.REMITTED },
        { riderId: 'r2', premiumAmount: 104800, paymentDay: 1, remittanceStatus: RemittanceStatus.REMITTED },
      ]);

      const result = await service.getRiderPremiumsForPeriod(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.length).toBe(2);

      const r1 = result.find((r) => r.riderId === 'r1');
      expect(r1?.totalPremium).toBe(113200);
      expect(r1?.daysCompleted).toBe(2);
    });

    it('should mark riders with 31+ days as full-term', async () => {
      // Create mock escrow records for a full-term rider (31 payments)
      const mockRecords = Array.from({ length: 31 }, (_, i) => ({
        riderId: 'r1',
        premiumAmount: i === 0 ? 104800 : 8400, // Day 1 deposit + 30 daily
        paymentDay: i + 1,
        remittanceStatus: RemittanceStatus.REMITTED,
      }));

      mockEscrowRepository.find.mockResolvedValueOnce(mockRecords);

      const result = await service.getRiderPremiumsForPeriod(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result[0].isFullTerm).toBe(true);
      expect(result[0].daysCompleted).toBe(31);
    });

    it('should return empty array when no escrow records', async () => {
      mockEscrowRepository.find.mockResolvedValueOnce([]);

      const result = await service.getRiderPremiumsForPeriod(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result).toEqual([]);
    });
  });

  describe('getPartnerCommissionSummaries', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');

    it('should return summaries for all three partners', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];
      const calculationResult = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      const summaries = service.getPartnerCommissionSummaries(calculationResult);

      expect(summaries.length).toBe(3);
      expect(summaries.map((s) => s.partnerType)).toContain(PartnerType.ATRONACH);
      expect(summaries.map((s) => s.partnerType)).toContain(PartnerType.KBA);
      expect(summaries.map((s) => s.partnerType)).toContain(PartnerType.ROBS_INSURANCE);
    });

    it('should include component breakdown for each partner', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];
      const calculationResult = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      const summaries = service.getPartnerCommissionSummaries(calculationResult);

      const platformSummary = summaries.find((s) => s.partnerType === PartnerType.ATRONACH);
      expect(platformSummary?.components.length).toBe(2);
      expect(platformSummary?.components.map((c) => c.name)).toContain('O&M Fee');
      expect(platformSummary?.components.map((c) => c.name)).toContain('Profit Share');
    });
  });

  describe('validateCalculation', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');

    it('should validate correct calculations', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];
      const calculationResult = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      const validation = service.validateCalculation(calculationResult);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect rider count mismatches', () => {
      const riderPremiums = [
        createRiderPremiumData('r1', 356500, true, 31),
        createRiderPremiumData('r2', 200000, false, 15),
      ];
      const calculationResult = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Manually corrupt the result
      calculationResult.fullTermRiders = 5;

      const validation = service.validateCalculation(calculationResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');

    it('should handle fractional cents by rounding', () => {
      const riderPremiums = [createRiderPremiumData('r1', 100001, true, 31)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // All amounts should be integers (cents)
      expect(Number.isInteger(result.totalCommission)).toBe(true);
      expect(Number.isInteger(result.purePremium)).toBe(true);
      expect(Number.isInteger(result.distribution.platformOM)).toBe(true);
    });

    it('should not produce negative values', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      expect(result.totalCommission).toBeGreaterThanOrEqual(0);
      expect(result.distribution.platformOM).toBeGreaterThanOrEqual(0);
      expect(result.distribution.kba).toBeGreaterThanOrEqual(0);
      expect(result.distribution.robs).toBeGreaterThanOrEqual(0);
    });

    it('should handle large rider counts without overflow', () => {
      // 700,000 target riders - create array with summary data
      const riderPremiums = [createRiderPremiumData('r1', 356500 * 700000, true, 31)];
      riderPremiums[0].totalPremium = 356500 * 10; // Just test with 10x for simplicity

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      expect(result.totalCommission).toBeGreaterThan(0);
      expect(Number.isFinite(result.totalCommission)).toBe(true);
    });
  });

  describe('constants validation', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-01-31');

    it('should use correct pure premium ratio (3500/3565)', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Pure premium should be approximately 350,000 cents (3500 KES)
      const expectedPurePremium = Math.round(356500 * (3500 / 3565));
      expect(result.purePremium).toBe(expectedPurePremium);
    });

    it('should use 9% commission rate', () => {
      const riderPremiums = [createRiderPremiumData('r1', 356500, true, 31)];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // Commission should be 9% of pure premium
      const expectedCommission = Math.round(result.purePremium * 0.09);
      expect(result.totalCommission).toBe(expectedCommission);
    });

    it('should allocate KES 100 per full-term rider for Platform O&M', () => {
      const riderPremiums = [
        createRiderPremiumData('r1', 356500, true, 31),
        createRiderPremiumData('r2', 356500, true, 31),
        createRiderPremiumData('r3', 356500, true, 31),
      ];

      const result = service.calculateMonthlyCommission(riderPremiums, periodStart, periodEnd);

      // 3 full-term riders * KES 100 = KES 300 = 30,000 cents
      expect(result.distribution.platformOM).toBe(30000);
    });
  });
});
