import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const OtpVerifyPage = lazy(() => import('@/pages/auth/OtpVerifyPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EnrollmentDashboard = lazy(() => import('@/pages/dashboards/EnrollmentDashboard'));
const PaymentDashboard = lazy(() => import('@/pages/dashboards/PaymentDashboard'));
const PolicyDashboard = lazy(() => import('@/pages/dashboards/PolicyDashboard'));
const UserSearchPage = lazy(() => import('@/pages/users/UserSearchPage'));
const UserDetailPage = lazy(() => import('@/pages/users/UserDetailPage'));
const OrganizationListPage = lazy(() => import('@/pages/organizations/OrganizationListPage'));
const OrganizationDetailPage = lazy(() => import('@/pages/organizations/OrganizationDetailPage'));
const KycQueuePage = lazy(() => import('@/pages/kyc/KycQueuePage'));
const KycReviewPage = lazy(() => import('@/pages/kyc/KycReviewPage'));
const ReportListPage = lazy(() => import('@/pages/reports/ReportListPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();

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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard/enrollment" element={<EnrollmentDashboard />} />
          <Route path="dashboard/payments" element={<PaymentDashboard />} />
          <Route path="dashboard/policies" element={<PolicyDashboard />} />
          <Route path="users" element={<UserSearchPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="organizations" element={<OrganizationListPage />} />
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="kyc" element={<KycQueuePage />} />
          <Route path="kyc/:id" element={<KycReviewPage />} />
          <Route path="reports" element={<ReportListPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
