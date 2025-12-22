/**
 * Role-based permissions hook
 * GAP-005, GAP-006: Consistent permission checks across UI
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

/**
 * Permission flags for UI visibility and actions
 */
export interface Permissions {
  // Organization management
  canCreateOrganization: boolean;
  canEditOrganization: boolean;
  canViewAllOrganizations: boolean;

  // User management
  canManageUsers: boolean;
  canViewUsers: boolean;

  // KYC management
  canReviewKyc: boolean;
  canViewKyc: boolean;

  // Policy management
  canManagePolicyTerms: boolean;
  canViewPolicies: boolean;

  // Dashboard and reporting
  canViewDashboard: boolean;
  canViewReports: boolean;

  // Admin features
  canAccessAdminPanel: boolean;
}

/**
 * Permission definitions per role
 * Based on role_audit_report.md Role Access Matrix
 */
const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  platform_admin: {
    canCreateOrganization: true,
    canEditOrganization: true,
    canViewAllOrganizations: true,
    canManageUsers: true,
    canViewUsers: true,
    canReviewKyc: true,
    canViewKyc: true,
    canManagePolicyTerms: true,
    canViewPolicies: true,
    canViewDashboard: true,
    canViewReports: true,
    canAccessAdminPanel: true,
  },
  kba_admin: {
    canCreateOrganization: true,  // Can create child SACCOs
    canEditOrganization: true,    // Can edit own org and children
    canViewAllOrganizations: false, // Only sees hierarchy
    canManageUsers: false,
    canViewUsers: false,
    canReviewKyc: false,
    canViewKyc: false,
    canManagePolicyTerms: false,
    canViewPolicies: true,
    canViewDashboard: true,
    canViewReports: true,
    canAccessAdminPanel: true,
  },
  sacco_admin: {
    canCreateOrganization: false, // Cannot create orgs
    canEditOrganization: true,    // Can edit own SACCO only
    canViewAllOrganizations: false,
    canManageUsers: false,
    canViewUsers: false,
    canReviewKyc: false,
    canViewKyc: false,
    canManagePolicyTerms: false,
    canViewPolicies: true,
    canViewDashboard: true,
    canViewReports: true,
    canAccessAdminPanel: true,
  },
  insurance_admin: {
    canCreateOrganization: false,
    canEditOrganization: false,
    canViewAllOrganizations: false,
    canManageUsers: false,
    canViewUsers: false,
    canReviewKyc: false,
    canViewKyc: true,
    canManagePolicyTerms: true,
    canViewPolicies: true,
    canViewDashboard: true,
    canViewReports: true,
    canAccessAdminPanel: true,
  },
  rider: {
    canCreateOrganization: false,
    canEditOrganization: false,
    canViewAllOrganizations: false,
    canManageUsers: false,
    canViewUsers: false,
    canReviewKyc: false,
    canViewKyc: false,  // Can only view own KYC status
    canManagePolicyTerms: false,
    canViewPolicies: false, // Can only view own policies
    canViewDashboard: false,
    canViewReports: false,
    canAccessAdminPanel: false,
  },
};

/**
 * Default permissions for unauthenticated users (most restrictive)
 */
const DEFAULT_PERMISSIONS: Permissions = ROLE_PERMISSIONS.rider;

/**
 * Hook to get current user's permissions
 * @returns Permissions object for the current user's role
 */
export function usePermissions(): Permissions {
  const { user } = useAuthStore();

  return useMemo(() => {
    if (!user?.role) {
      return DEFAULT_PERMISSIONS;
    }

    return ROLE_PERMISSIONS[user.role as UserRole] ?? DEFAULT_PERMISSIONS;
  }, [user?.role]);
}

/**
 * Check if a user has a specific role
 * @param requiredRoles - Array of roles that are allowed
 * @returns true if user has one of the required roles
 */
export function useHasRole(requiredRoles: UserRole[]): boolean {
  const { user } = useAuthStore();

  return useMemo(() => {
    if (!user?.role) {
      return false;
    }
    return requiredRoles.includes(user.role as UserRole);
  }, [user?.role, requiredRoles]);
}

/**
 * Check if user is any admin role
 */
export function useIsAdmin(): boolean {
  return useHasRole(['platform_admin', 'kba_admin', 'sacco_admin', 'insurance_admin']);
}

/**
 * Check if user is platform admin
 */
export function useIsPlatformAdmin(): boolean {
  return useHasRole(['platform_admin']);
}
