import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  CreditCard,
  Shield,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency } from '@/lib/utils';
import { dashboardApi } from '@/services/api/dashboard.api';
import { PAYMENT_AMOUNTS } from '@/config/constants';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getOverview,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
      </div>
    );
  }

  const metrics = data ?? {
    enrollment: { current: 0, target: 700000, progress: 0 },
    payments: { todayRevenue: 0, todayTransactions: 0, successRate: 0 },
    policies: { activePolicies: 0, expiringIn30Days: 0 },
    atRiskUsers: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of BodaInsure platform metrics
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Enrollment */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.enrollment.current.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              of {metrics.enrollment.target.toLocaleString()} target
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.min(metrics.enrollment.progress, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.payments.todayRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.payments.todayTransactions} transactions
            </p>
          </CardContent>
        </Card>

        {/* Active Policies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.policies.activePolicies.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.policies.expiringIn30Days} expiring in 30 days
            </p>
          </CardContent>
        </Card>

        {/* At Risk Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk Users</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {metrics.atRiskUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Missing payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Enrollment Dashboard
            </CardTitle>
            <CardDescription>
              Track registration progress and KYC completion rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/dashboard/enrollment">
                View Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Dashboard
            </CardTitle>
            <CardDescription>
              Monitor deposits, daily payments, and compliance rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/dashboard/payments">
                View Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Policy Dashboard
            </CardTitle>
            <CardDescription>
              View active policies, expirations, and coverage stats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/dashboard/policies">
                View Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payment Model Info */}
      <Card>
        <CardHeader>
          <CardTitle>BodaInsure Payment Model</CardTitle>
          <CardDescription>
            Affordable micropayment structure for TPO insurance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Initial Deposit</p>
              <p className="text-2xl font-bold">{formatCurrency(PAYMENT_AMOUNTS.INITIAL_DEPOSIT)}</p>
              <p className="text-xs text-muted-foreground">1-month policy</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Daily Payment</p>
              <p className="text-2xl font-bold">{formatCurrency(PAYMENT_AMOUNTS.DAILY_PAYMENT)}</p>
              <p className="text-xs text-muted-foreground">x {PAYMENT_AMOUNTS.DAYS_REQUIRED} days</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Annual</p>
              <p className="text-2xl font-bold">{formatCurrency(PAYMENT_AMOUNTS.TOTAL_ANNUAL)}</p>
              <p className="text-xs text-muted-foreground">12-month coverage</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
