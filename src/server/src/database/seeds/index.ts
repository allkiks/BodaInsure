/**
 * Database Seeds
 *
 * Central export for all seed data used by service-based seeders.
 * Seed data is organized by entity type:
 * - users.seed.ts - User account configurations
 * - organizations.seed.ts - KBA and SACCO configurations
 * - policy-terms.seed.ts - TPO policy terms content
 * - test-policies.seed.ts - Test policy data for development
 */

// Users seed data
export {
  DEFAULT_PASSWORD,
  SALT_ROUNDS,
  SUPERUSER_CONFIG,
  BASE_PHONE_NUMBER,
  COUNTRY_CODE,
  ROLE_PHONE_OFFSETS,
  SEEDED_PHONES,
  ADDITIONAL_RIDERS,
  generateRoleUserConfigs,
  getPhoneForRole,
  type UserSeedConfig,
  type AdditionalRiderConfig,
} from './users.seed.js';

// Organizations seed data
export {
  KBA_CONFIG,
  SACCO_SEEDS,
  SACCO_DEFAULT_CONFIG,
  getTotalEstimatedMembers,
  type SaccoSeedData,
} from './organizations.seed.js';

// Policy terms seed data
export {
  TPO_CONTENT_EN,
  TPO_CONTENT_SW,
  TPO_SUMMARY_EN,
  TPO_SUMMARY_SW,
  KEY_TERMS_EN,
  KEY_TERMS_SW,
  INCLUSIONS,
  EXCLUSIONS,
  TPO_POLICY_TERMS_SEED,
} from './policy-terms.seed.js';

// Test policies seed data
export {
  DEFAULT_UNDERWRITER,
  TEST_POLICIES,
  generatePolicyDates,
  type TestPolicyMetadata,
  type TestPolicySeedData,
} from './test-policies.seed.js';

// Chart of Accounts seed data
export {
  CHART_OF_ACCOUNTS,
  CHART_OF_ACCOUNTS_SUMMARY,
  getNormalBalanceForType,
  type GlAccountSeedConfig,
} from './chart-of-accounts.seed.js';
