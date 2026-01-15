/**
 * Users Seed Data
 *
 * Contains all seed data for user accounts:
 * - SUPERUSER (system admin account)
 * - One default user per role with deterministic phone numbers
 *
 * All seeded users use the default password defined here.
 */

import { UserRole } from '../../modules/identity/entities/user.entity.js';

/**
 * Default password for all seeded users
 * IMPORTANT: Change immediately after first login in production!
 */
export const DEFAULT_PASSWORD = 'ChangeMe123!';

/**
 * Bcrypt salt rounds for password hashing
 */
export const SALT_ROUNDS = 10;

/**
 * SUPERUSER account configuration
 */
export const SUPERUSER_CONFIG = {
  username: 'SUPERUSER',
  phone: '+254000000000',
  role: UserRole.SUPERUSER,
  isSystemAccount: true,
  reminderOptOut: true,
} as const;

/**
 * Base phone number for role-based seeding (0722000000)
 */
export const BASE_PHONE_NUMBER = 722000000;

/**
 * Country code for Kenya
 */
export const COUNTRY_CODE = '+254';

/**
 * Role to phone number offset mapping
 * Provides deterministic phone number assignment per role
 *
 * Resulting phone numbers:
 * - RIDER: +254722000000
 * - SACCO_ADMIN: +254722000001
 * - KBA_ADMIN: +254722000002
 * - INSURANCE_ADMIN: +254722000003
 * - PLATFORM_ADMIN: +254722000004
 * - SUPERUSER: uses special phone +254000000000
 */
export const ROLE_PHONE_OFFSETS: Record<UserRole, number> = {
  [UserRole.RIDER]: 0,
  [UserRole.SACCO_ADMIN]: 1,
  [UserRole.KBA_ADMIN]: 2,
  [UserRole.INSURANCE_ADMIN]: 3,
  [UserRole.PLATFORM_ADMIN]: 4,
  [UserRole.SUPERUSER]: 5,
};

/**
 * User seed data configuration for each role
 */
export interface UserSeedConfig {
  role: UserRole;
  phone: string;
  username: string;
  isSystemAccount: boolean;
  reminderOptOut: boolean;
}

/**
 * Generate user seed configurations for all roles
 */
export function generateRoleUserConfigs(): UserSeedConfig[] {
  return Object.values(UserRole).map((role) => {
    const offset = ROLE_PHONE_OFFSETS[role];
    const phoneNumber = BASE_PHONE_NUMBER + offset;
    const phone = `${COUNTRY_CODE}${phoneNumber}`;
    const username = `0${phoneNumber}`; // Local format (e.g., 0722000000)

    return {
      role,
      phone,
      username,
      isSystemAccount: false,
      reminderOptOut: false,
    };
  });
}

/**
 * Get phone number for a specific role
 */
export function getPhoneForRole(role: UserRole): string {
  const offset = ROLE_PHONE_OFFSETS[role];
  const phoneNumber = BASE_PHONE_NUMBER + offset;
  return `${COUNTRY_CODE}${phoneNumber}`;
}

/**
 * Predefined phone numbers for quick access
 */
export const SEEDED_PHONES = {
  SUPERUSER: SUPERUSER_CONFIG.phone,
  RIDER: getPhoneForRole(UserRole.RIDER),
  SACCO_ADMIN: getPhoneForRole(UserRole.SACCO_ADMIN),
  KBA_ADMIN: getPhoneForRole(UserRole.KBA_ADMIN),
  INSURANCE_ADMIN: getPhoneForRole(UserRole.INSURANCE_ADMIN),
  PLATFORM_ADMIN: getPhoneForRole(UserRole.PLATFORM_ADMIN),
} as const;

/**
 * Additional rider members for testing organization memberships
 * These riders will be mapped to Nairobi Metro SACCO
 */
export interface AdditionalRiderConfig {
  phone: string;
  fullName: string;
  nationalId: string;
}

export const ADDITIONAL_RIDERS: AdditionalRiderConfig[] = [
  {
    phone: '+254722000010',
    fullName: 'John Kamau',
    nationalId: '12345678',
  },
  {
    phone: '+254722000011',
    fullName: 'Peter Ochieng',
    nationalId: '23456789',
  },
  {
    phone: '+254722000012',
    fullName: 'David Mwangi',
    nationalId: '34567890',
  },
  {
    phone: '+254722000013',
    fullName: 'James Kiprop',
    nationalId: '45678901',
  },
];
