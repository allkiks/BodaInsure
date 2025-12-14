import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  FileCheck,
  CreditCard,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { dashboardApi } from '@/services/api/dashboard.api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { formatDate } from '@/lib/utils';

export default function EnrollmentDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard', 'enrollment'],
    queryFn: dashboardApi.getEnrollmentMetrics,
  });

  const { data: trendData } = useQuery({
    queryKey: ['dashboard', 'enrollment-trend'],
    queryFn: () => dashboardApi.getEnrollmentTrend(30),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const enrollmentMetrics = metrics ?? {
    target: 700000,
    current: 0,
    progress: 0,
    registered: 0,
    kycComplete: 0,
    depositPaid: 0,
    trend: [],
  };

  // Calculate funnel percentages
  const registeredPct = 100;
  const kycPct = enrollmentMetrics.registered > 0
    ? Math.round((enrollmentMetrics.kycComplete / enrollmentMetrics.registered) * 100)
    : 0;
  const depositPct = enrollmentMetrics.registered > 0
    ? Math.round((enrollmentMetrics.depositPaid / enrollmentMetrics.registered) * 100)
    : 0;

  const funnelData = [
    { stage: 'Registered', count: enrollmentMetrics.registered, percentage: registeredPct },
    { stage: 'KYC Complete', count: enrollmentMetrics.kycComplete, percentage: kycPct },
    { stage: 'Deposit Paid', count: enrollmentMetrics.depositPaid, percentage: depositPct },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enrollment Dashboard</h1>
        <p className="text-muted-foreground">
          Track registration and onboarding progress
        </p>
      </div>

      {/* Progress towards target */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progress to Target
          </CardTitle>
          <CardDescription>
            Year 1 target: 700,000 enrolled users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">
                  {enrollmentMetrics.current.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  enrolled users
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-primary">
                  {enrollmentMetrics.progress.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  of {enrollmentMetrics.target.toLocaleString()} target
                </p>
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-secondary">
              <div
                className="h-4 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(enrollmentMetrics.progress, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enrollmentMetrics.registered.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total registered users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KYC Complete</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enrollmentMetrics.kycComplete.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {kycPct}% of registered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deposit Paid</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enrollmentMetrics.depositPaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {depositPct}% of registered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Registration Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Registration Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value).split(' ').slice(0, 2).join(' ')}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(value) => formatDate(value as string)}
                    formatter={(value) => [value.toLocaleString(), 'Registrations']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={100} />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value.toLocaleString()} (${funnelData.find(d => d.count === value)?.percentage}%)`,
                      'Users'
                    ]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
