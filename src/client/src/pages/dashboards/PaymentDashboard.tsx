import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Calendar,
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
import { formatCurrency } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatDate } from '@/lib/utils';
import { PAYMENT_AMOUNTS } from '@/config/constants';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))'];

export default function PaymentDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard', 'payments'],
    queryFn: dashboardApi.getPaymentMetrics,
  });

  const { data: trendData } = useQuery({
    queryKey: ['dashboard', 'payment-trend'],
    queryFn: () => dashboardApi.getPaymentTrend(30),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const paymentMetrics = metrics ?? {
    todayRevenue: 0,
    todayTransactions: 0,
    successRate: 0,
    deposits: 0,
    dailyPayments: 0,
    complianceRate: 0,
    atRiskUsers: 0,
  };

  const paymentTypeData = [
    { name: 'Deposits', value: paymentMetrics.deposits },
    { name: 'Daily Payments', value: paymentMetrics.dailyPayments },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor revenue, transactions, and compliance
        </p>
      </div>

      {/* Today's Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(paymentMetrics.todayRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total collected today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentMetrics.todayTransactions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Processed today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {paymentMetrics.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Payment success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk Users</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {paymentMetrics.atRiskUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Missing payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Daily Payment Compliance
          </CardTitle>
          <CardDescription>
            Users completing their {PAYMENT_AMOUNTS.DAYS_REQUIRED}-day payment requirement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">
                  {paymentMetrics.complianceRate.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  compliance rate
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {formatCurrency(PAYMENT_AMOUNTS.DAILY_PAYMENT)} x {PAYMENT_AMOUNTS.DAYS_REQUIRED} days
                </p>
                <p className="text-sm text-muted-foreground">
                  = {formatCurrency(PAYMENT_AMOUNTS.DAILY_PAYMENT * PAYMENT_AMOUNTS.DAYS_REQUIRED)}
                </p>
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-secondary">
              <div
                className="h-4 rounded-full bg-primary transition-all"
                style={{ width: `${paymentMetrics.complianceRate}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (30 Days)</CardTitle>
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
                  <YAxis
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    className="text-xs"
                  />
                  <Tooltip
                    labelFormatter={(value) => formatDate(value as string)}
                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
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

        {/* Payment Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) =>
                      `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value.toLocaleString(), 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
