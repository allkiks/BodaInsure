import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { UserRole } from '@/types';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const AdminLoginPage = lazy(() => import('@/pages/auth/AdminLoginPage'));
const OtpVerifyPage = lazy(() => import('@/pages/auth/OtpVerifyPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EnrollmentDashboard = lazy(() => import('@/pages/dashboards/EnrollmentDashboard'));
const PaymentDashboard = lazy(() => import('@/pages/dashboards/PaymentDashboard'));
const PolicyDashboard = lazy(() => import('@/pages/dashboards/PolicyDashboard'));
const UserSearchPage = lazy(() => import('@/pages/users/UserSearchPage'));
const UserDetailPage = lazy(() => import('@/pages/users/UserDetailPage'));
const OrganizationListPage = lazy(() => import('@/pages/organizations/OrganizationListPage'));
const OrganizationDetailPage = lazy(() => import('@/pages/organizations/OrganizationDetailPage'));
const OrganizationFormPage = lazy(() => import('@/pages/organizations/OrganizationFormPage'));
const PolicyTermsListPage = lazy(() => import('@/pages/settings/PolicyTermsPage'));
const KycQueuePage = lazy(() => import('@/pages/kyc/KycQueuePage'));
const KycReviewPage = lazy(() => import('@/pages/kyc/KycReviewPage'));
const ReportListPage = lazy(() => import('@/pages/reports/ReportListPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

// Rider self-service pages
const RiderWalletPage = lazy(() => import('@/pages/rider/WalletPage'));
const RiderPaymentPage = lazy(() => import('@/pages/rider/PaymentPage'));
const RiderPoliciesPage = lazy(() => import('@/pages/rider/PoliciesPage'));
const RiderPolicyDetailPage = lazy(() => import('@/pages/rider/PolicyDetailPage'));
const RiderKycPage = lazy(() => import('@/pages/rider/KycPage'));
const RiderProfilePage = lazy(() => import('@/pages/rider/ProfilePage'));

// Admin management pages
const AdminUsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const AdminUserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage'));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'));

// Accounting pages
const AccountingDashboard = lazy(() => import('@/pages/accounting/AccountingDashboard'));
const SettlementsPage = lazy(() => import('@/pages/accounting/SettlementsPage'));
const GLAccountsPage = lazy(() => import('@/pages/accounting/GLAccountsPage'));
const ReconciliationsPage = lazy(() => import('@/pages/accounting/ReconciliationsPage'));
const FinancialReportsPage = lazy(() => import('@/pages/accounting/FinancialReportsPage'));

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access if allowedRoles is specified
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate home based on role
    if (user.role === 'rider') {
      return <Navigate to="/my/wallet" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function RoleBasedRedirect() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role
  if (user.role === 'rider') {
    return <Navigate to="/my/wallet" replace />;
  }

  // All admin roles go to dashboard
  return <Navigate to="/dashboard" replace />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/admin/login"
          element={
            <PublicRoute>
              <AdminLoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/verify-otp"
          element={
            <PublicRoute>
              <OtpVerifyPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleBasedRedirect />} />

          {/* Admin-only routes */}
          <Route path="dashboard" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin']}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="dashboard/enrollment" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin']}>
              <EnrollmentDashboard />
            </ProtectedRoute>
          } />
          <Route path="dashboard/payments" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin']}>
              <PaymentDashboard />
            </ProtectedRoute>
          } />
          <Route path="dashboard/policies" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin']}>
              <PolicyDashboard />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <UserSearchPage />
            </ProtectedRoute>
          } />
          <Route path="users/:id" element={
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <UserDetailPage />
            </ProtectedRoute>
          } />
          <Route path="organizations" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin']}>
              <OrganizationListPage />
            </ProtectedRoute>
          } />
          <Route path="organizations/new" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'kba_admin']}>
              <OrganizationFormPage />
            </ProtectedRoute>
          } />
          <Route path="organizations/:id" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin']}>
              <OrganizationDetailPage />
            </ProtectedRoute>
          } />
          <Route path="organizations/:id/edit" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'kba_admin', 'sacco_admin']}>
              <OrganizationFormPage />
            </ProtectedRoute>
          } />
          <Route path="settings/policy-terms" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <PolicyTermsListPage />
            </ProtectedRoute>
          } />
          <Route path="kyc" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'kba_admin', 'sacco_admin']}>
              <KycQueuePage />
            </ProtectedRoute>
          } />
          <Route path="kyc/:id" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'kba_admin', 'sacco_admin']}>
              <KycReviewPage />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin']}>
              <ReportListPage />
            </ProtectedRoute>
          } />

          {/* Accounting routes */}
          <Route path="accounting" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <AccountingDashboard />
            </ProtectedRoute>
          } />
          <Route path="accounting/dashboard" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <AccountingDashboard />
            </ProtectedRoute>
          } />
          <Route path="accounting/settlements" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <SettlementsPage />
            </ProtectedRoute>
          } />
          <Route path="accounting/gl-accounts" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <GLAccountsPage />
            </ProtectedRoute>
          } />
          <Route path="accounting/reconciliations" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <ReconciliationsPage />
            </ProtectedRoute>
          } />
          <Route path="accounting/reports" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <FinancialReportsPage />
            </ProtectedRoute>
          } />

          <Route path="settings" element={<SettingsPage />} />

          {/* Admin user management routes */}
          <Route path="admin/users" element={
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          } />
          <Route path="admin/users/:id" element={
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminUserDetailPage />
            </ProtectedRoute>
          } />
          <Route path="admin/audit" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'insurance_admin']}>
              <AuditLogPage />
            </ProtectedRoute>
          } />

          {/* Rider self-service routes */}
          <Route path="my/wallet" element={
            <ProtectedRoute allowedRoles={['rider', 'platform_admin']}>
              <RiderWalletPage />
            </ProtectedRoute>
          } />
          <Route path="my/payment" element={
            <ProtectedRoute allowedRoles={['rider', 'platform_admin']}>
              <RiderPaymentPage />
            </ProtectedRoute>
          } />
          <Route path="my/policies" element={
            <ProtectedRoute allowedRoles={['rider', 'platform_admin']}>
              <RiderPoliciesPage />
            </ProtectedRoute>
          } />
          <Route path="my/policies/:id" element={
            <ProtectedRoute allowedRoles={['rider', 'platform_admin']}>
              <RiderPolicyDetailPage />
            </ProtectedRoute>
          } />
          <Route path="my/kyc" element={
            <ProtectedRoute allowedRoles={['rider', 'platform_admin']}>
              <RiderKycPage />
            </ProtectedRoute>
          } />
          <Route path="my/profile" element={
            <ProtectedRoute allowedRoles={['rider', 'platform_admin']}>
              <RiderProfilePage />
            </ProtectedRoute>
          } />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<RoleBasedRedirect />} />
      </Routes>
    </Suspense>
  );
}
