/**
 * Test Policies Seed Data
 *
 * Contains seed data for test policies used in development:
 * - Active 1-month policy
 * - Expired 11-month policy from previous year
 */

import {
  PolicyType,
  PolicyStatus,
} from '../../modules/policy/entities/policy.entity.js';

/**
 * Test policy metadata
 * Index signature allows compatibility with Record<string, unknown>
 */
export interface TestPolicyMetadata {
  [key: string]: unknown;
  seeded: boolean;
  batchId: string;
  underwriter: string;
  previousCycle?: boolean;
}

/**
 * Test policy seed data interface
 */
export interface TestPolicySeedData {
  policyType: PolicyType;
  status: PolicyStatus;
  policyNumber: string;
  certificateNumber: string;
  premiumAmount: number; // in cents
  currency: string;
  vehicleRegistration: string;
  defaultInsuredName: string;
  defaultNationalId: string;
  coverageMonths: number;
  offsetYears: number; // 0 for current year, -1 for previous year
  metadata: TestPolicyMetadata;
}

/**
 * Default underwriter name
 */
export const DEFAULT_UNDERWRITER = 'Definite Assurance Company Ltd';

/**
 * Test policy seeds
 */
export const TEST_POLICIES: TestPolicySeedData[] = [
  {
    policyType: PolicyType.ONE_MONTH,
    status: PolicyStatus.ACTIVE,
    policyNumber: 'TPO-2024-001234',
    certificateNumber: 'CERT-2024-001234',
    premiumAmount: 104800, // 1,048 KES in cents
    currency: 'KES',
    vehicleRegistration: 'KBZ 123A',
    defaultInsuredName: 'John Kamau',
    defaultNationalId: '12345678',
    coverageMonths: 1,
    offsetYears: 0, // Current year
    metadata: {
      seeded: true,
      batchId: 'SEED-BATCH-001',
      underwriter: DEFAULT_UNDERWRITER,
    },
  },
  {
    policyType: PolicyType.ELEVEN_MONTH,
    status: PolicyStatus.EXPIRED,
    policyNumber: 'TPO-2023-009876',
    certificateNumber: 'CERT-2023-009876',
    premiumAmount: 261000, // 2,610 KES in cents (30 daily payments)
    currency: 'KES',
    vehicleRegistration: 'KBZ 123A',
    defaultInsuredName: 'John Kamau',
    defaultNationalId: '12345678',
    coverageMonths: 11,
    offsetYears: -1, // Previous year
    metadata: {
      seeded: true,
      batchId: 'SEED-BATCH-000',
      underwriter: DEFAULT_UNDERWRITER,
      previousCycle: true,
    },
  },
];

/**
 * Generate policy dates based on offset and coverage
 */
export function generatePolicyDates(
  offsetYears: number,
  coverageMonths: number,
): {
  coverageStart: Date;
  coverageEnd: Date;
} {
  const now = new Date();
  const coverageStart = new Date(now);
  coverageStart.setFullYear(coverageStart.getFullYear() + offsetYears);

  const coverageEnd = new Date(coverageStart);
  coverageEnd.setMonth(coverageEnd.getMonth() + coverageMonths);

  return { coverageStart, coverageEnd };
}
