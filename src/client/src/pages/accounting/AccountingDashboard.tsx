import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  FileText,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { accountingApi } from '@/services/api/accounting.api';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function AccountingDashboard() {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['accounting', 'dashboard'],
    queryFn: accountingApi.getDashboardSummary,
  });

  const { data: pendingSettlements } = useQuery({
    queryKey: ['accounting', 'settlements', 'pending'],
    queryFn: accountingApi.getPendingSettlements,
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
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load accounting dashboard</p>
      </div>
    );
  }

  const dashboardData = summary ?? {
    totalAssets: 0,
    totalLiabilities: 0,
    netIncome: 0,
    cashBalance: 0,
    premiumPayable: 0,
    serviceFeesPayable: 0,
    totalAssetsKes: 0,
    totalLiabilitiesKes: 0,
    netIncomeKes: 0,
    cashBalanceKes: 0,
    premiumPayableKes: 0,
    serviceFeesPayableKes: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounting Dashboard</h1>
          <p className="text-muted-foreground">
            Financial overview as of {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/accounting/reports">
              <FileText className="mr-2 h-4 w-4" />
              View Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData.totalAssetsKes)}
            </div>
            <p className="text-xs text-muted-foreground">
              All asset accounts combined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData.totalLiabilitiesKes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amounts owed to partners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData.cashBalanceKes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cash in bank accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <ArrowUpRight className={`h-4 w-4 ${dashboardData.netIncomeKes >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dashboardData.netIncomeKes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(dashboardData.netIncomeKes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payables Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Premium Payable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Premium Payable
            </CardTitle>
            <CardDescription>Amounts due to underwriter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Premium Due to Definite</span>
              <span className="text-lg font-semibold text-amber-600">
                {formatCurrency(dashboardData.premiumPayableKes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Service Fees Due to Partners</span>
              <span className="text-lg font-semibold text-amber-600">
                {formatCurrency(dashboardData.serviceFeesPayableKes)}
              </span>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/accounting/settlements">
                View Settlements
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common accounting tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/accounting/gl-accounts">
                <FileText className="mr-2 h-4 w-4" />
                View Chart of Accounts
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/accounting/reports">
                <TrendingUp className="mr-2 h-4 w-4" />
                Generate Financial Reports
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/accounting/reconciliations">
                <DollarSign className="mr-2 h-4 w-4" />
                Bank Reconciliation
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending Settlements */}
      {pendingSettlements && pendingSettlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pending Approvals
            </CardTitle>
            <CardDescription>
              Settlements awaiting approval or processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingSettlements.slice(0, 5).map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{settlement.settlementNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {settlement.partnerType.replace('_', ' ')} - {settlement.settlementType.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(settlement.totalAmount / 100)}
                    </p>
                    <Badge
                      variant={settlement.status === 'PENDING' ? 'secondary' : 'outline'}
                    >
                      {settlement.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {pendingSettlements.length > 5 && (
                <p className="text-center text-sm text-muted-foreground">
                  + {pendingSettlements.length - 5} more pending settlements
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Button variant="outline" className="h-20" asChild>
          <Link to="/accounting/gl-accounts">
            <div className="flex flex-col items-center gap-1">
              <FileText className="h-6 w-6" />
              <span>Chart of Accounts</span>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-20" asChild>
          <Link to="/accounting/settlements">
            <div className="flex flex-col items-center gap-1">
              <DollarSign className="h-6 w-6" />
              <span>Settlements</span>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-20" asChild>
          <Link to="/accounting/reconciliations">
            <div className="flex flex-col items-center gap-1">
              <TrendingUp className="h-6 w-6" />
              <span>Reconciliations</span>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-20" asChild>
          <Link to="/accounting/reports">
            <div className="flex flex-col items-center gap-1">
              <FileText className="h-6 w-6" />
              <span>Financial Reports</span>
            </div>
          </Link>
        </Button>
      </div>
    </div>
  );
}
