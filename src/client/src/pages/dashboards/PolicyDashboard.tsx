import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { POLICY_DURATIONS } from '@/config/constants';

const COLORS = {
  initial: 'hsl(var(--primary))',
  extended: 'hsl(142 76% 36%)', // Green
  expiring: 'hsl(48 96% 53%)', // Yellow
  lapsed: 'hsl(0 84% 60%)', // Red
};

export default function PolicyDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard', 'policies'],
    queryFn: dashboardApi.getPolicyMetrics,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const policyMetrics = metrics ?? {
    activePolicies: 0,
    expiringIn30Days: 0,
    lapsedPolicies: 0,
    initialPolicies: 0,
    extendedPolicies: 0,
  };

  const policyTypeData = [
    { name: `${POLICY_DURATIONS.INITIAL_POLICY}-Month`, value: policyMetrics.initialPolicies, fill: COLORS.initial },
    { name: `${POLICY_DURATIONS.EXTENDED_POLICY}-Month`, value: policyMetrics.extendedPolicies, fill: COLORS.extended },
  ];

  const statusData = [
    { status: 'Active', count: policyMetrics.activePolicies, fill: COLORS.extended },
    { status: 'Expiring Soon', count: policyMetrics.expiringIn30Days, fill: COLORS.expiring },
    { status: 'Lapsed', count: policyMetrics.lapsedPolicies, fill: COLORS.lapsed },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Policy Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor active policies, expirations, and coverage
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {policyMetrics.activePolicies.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1-Month Policies</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {policyMetrics.initialPolicies.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Initial deposit policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {policyMetrics.expiringIn30Days.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Within 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lapsed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {policyMetrics.lapsedPolicies.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Expired without renewal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Policy Model Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>BodaInsure Two-Policy Model</CardTitle>
          <CardDescription>
            Understanding the policy structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <span className="text-sm font-bold text-primary-foreground">1</span>
                </div>
                <h3 className="font-semibold">Policy 1: Initial Coverage</h3>
              </div>
              <ul className="ml-10 space-y-1 text-sm text-muted-foreground">
                <li>Issued on initial deposit (KES 1,048)</li>
                <li>Duration: 1 month</li>
                <li>Immediate coverage starts</li>
              </ul>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                  <span className="text-sm font-bold text-white">2</span>
                </div>
                <h3 className="font-semibold">Policy 2: Extended Coverage</h3>
              </div>
              <ul className="ml-10 space-y-1 text-sm text-muted-foreground">
                <li>Issued after 30 daily payments</li>
                <li>Duration: 11 months</li>
                <li>Completes 12-month annual coverage</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Policy Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={policyTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    dataKey="value"
                  >
                    {policyTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value.toLocaleString(), 'Policies']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Policy Status */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="status" type="category" width={100} />
                  <Tooltip
                    formatter={(value) => [value.toLocaleString(), 'Policies']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
