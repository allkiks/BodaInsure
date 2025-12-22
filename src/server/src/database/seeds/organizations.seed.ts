/**
 * Organizations Seed Data
 *
 * Contains seed data for organizations:
 * - Kenya Bodaboda Association (KBA) - Umbrella Body
 * - Sample SACCOs under KBA
 */

import {
  OrganizationType,
  OrganizationStatus,
} from '../../modules/organization/entities/organization.entity.js';

/**
 * SACCO seed data interface
 */
export interface SaccoSeedData {
  name: string;
  code: string;
  countyCode: string;
  subCounty: string;
  estimatedMembers: number;
  leaderName: string;
  contactPhone: string;
}

/**
 * KBA (Kenya Bodaboda Association) configuration
 * The national umbrella body for all bodaboda operators
 */
export const KBA_CONFIG = {
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
} as const;

/**
 * Sample SACCOs under KBA
 * These represent different regions in Kenya
 */
export const SACCO_SEEDS: SaccoSeedData[] = [
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

/**
 * Default SACCO configuration settings
 */
export const SACCO_DEFAULT_CONFIG = {
  type: OrganizationType.SACCO,
  status: OrganizationStatus.ACTIVE,
  verifiedMembers: 0,
  commissionRate: 2.5,
} as const;

/**
 * Get total estimated members across all seeded organizations
 */
export function getTotalEstimatedMembers(): number {
  return (
    KBA_CONFIG.estimatedMembers +
    SACCO_SEEDS.reduce((sum, sacco) => sum + sacco.estimatedMembers, 0)
  );
}
