import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { walletApi } from '@/services/api/wallet.api';
import { PAYMENT_AMOUNTS } from '@/config/constants';
import type { PaymentStatus } from '@/types';

const statusConfig: Record<PaymentStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Completed', icon: <CheckCircle className="h-3 w-3" />, variant: 'default' },
  pending: { label: 'Pending', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  failed: { label: 'Failed', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
  cancelled: { label: 'Cancelled', icon: <XCircle className="h-3 w-3" />, variant: 'outline' },
};

export default function WalletPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.getWallet,
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
        <p className="text-muted-foreground">Failed to load wallet data</p>
      </div>
    );
  }

  const wallet = data?.wallet ?? {
    balance: 0,
    totalDeposited: 0,
    totalDailyPayments: 0,
    daysCompleted: 0,
  };

  const recentTransactions = data?.recentTransactions ?? [];
  const daysRemaining = Math.max(0, PAYMENT_AMOUNTS.DAYS_REQUIRED - wallet.daysCompleted);
  const progressPercent = (wallet.daysCompleted / PAYMENT_AMOUNTS.DAYS_REQUIRED) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Wallet</h1>
        <p className="text-muted-foreground">
          View your balance and payment progress
        </p>
      </div>

      {/* Wallet Balance Card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{formatCurrency(wallet.balance)}</div>
          <p className="mt-2 text-primary-foreground/80">
            Available for insurance coverage
          </p>
        </CardContent>
      </Card>

      {/* Payment Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Payment Progress
          </CardTitle>
          <CardDescription>
            Track your daily payments towards the 11-month policy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Days Completed</span>
            <span className="font-medium">
              {wallet.daysCompleted} / {PAYMENT_AMOUNTS.DAYS_REQUIRED}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-secondary">
            <div
              className="h-3 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-primary">{wallet.daysCompleted}</p>
              <p className="text-xs text-muted-foreground">Days Paid</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{daysRemaining}</p>
              <p className="text-xs text-muted-foreground">Days Remaining</p>
            </div>
          </div>
          {daysRemaining > 0 && (
            <Button asChild className="w-full">
              <Link to="/my/payment">
                <CreditCard className="mr-2 h-4 w-4" />
                Make Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          {daysRemaining === 0 && (
            <div className="rounded-lg bg-green-50 p-3 text-center text-green-700 dark:bg-green-950 dark:text-green-400">
              <CheckCircle className="mx-auto mb-2 h-6 w-6" />
              <p className="font-medium">All daily payments completed!</p>
              <p className="text-sm">Your 11-month policy will be issued soon.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Initial Deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(wallet.totalDeposited)}</div>
            <p className="text-xs text-muted-foreground">
              Required: {formatCurrency(PAYMENT_AMOUNTS.INITIAL_DEPOSIT)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(wallet.totalDailyPayments)}</div>
            <p className="text-xs text-muted-foreground">
              {wallet.daysCompleted} x {formatCurrency(PAYMENT_AMOUNTS.DAILY_PAYMENT)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.slice(0, 5).map((tx) => {
                const config = statusConfig[tx.status];
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{tx.type} Payment</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(tx.amount)}</p>
                      <Badge variant={config.variant} className="gap-1">
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
