import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FileText, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { accountingApi } from '@/services/api/accounting.api';
import { formatCurrency } from '@/lib/utils';
import type { GlAccountType } from '@/types';

const accountTypeColors: Record<GlAccountType, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-amber-100 text-amber-800',
  EQUITY: 'bg-green-100 text-green-800',
  INCOME: 'bg-purple-100 text-purple-800',
  EXPENSE: 'bg-red-100 text-red-800',
};

const accountTypeOrder: GlAccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export default function GLAccountsPage() {
  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ['accounting', 'gl-accounts'],
    queryFn: accountingApi.getGlAccounts,
  });

  const { data: trialBalance } = useQuery({
    queryKey: ['accounting', 'trial-balance'],
    queryFn: () => accountingApi.getTrialBalance(),
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
        <p className="text-muted-foreground">Failed to load GL accounts</p>
      </div>
    );
  }

  const glAccounts = accounts ?? [];

  // Group accounts by type
  const groupedAccounts = accountTypeOrder.reduce((acc, type) => {
    acc[type] = glAccounts.filter((a) => a.accountType === type);
    return acc;
  }, {} as Record<GlAccountType, typeof glAccounts>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <p className="text-muted-foreground">
          General Ledger account structure for BodaInsure
        </p>
      </div>

      {/* Trial Balance Summary */}
      {trialBalance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trial Balance Summary
            </CardTitle>
            <CardDescription>
              As of {new Date(trialBalance.asOf ?? trialBalance.asOfDate ?? new Date()).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Debits</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(trialBalance.totalDebitsKes ?? trialBalance.totalDebits / 100)}
                </p>
              </div>
              <div className="text-center">
                <Badge
                  variant={trialBalance.isBalanced ? 'default' : 'destructive'}
                  className="text-lg px-4 py-1"
                >
                  {trialBalance.isBalanced ? 'BALANCED' : 'UNBALANCED'}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(trialBalance.totalCreditsKes ?? trialBalance.totalCredits / 100)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts by Type */}
      {accountTypeOrder.map((type) => {
        const typeAccounts = groupedAccounts[type];
        if (!typeAccounts?.length) return null;

        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {type} Accounts
                <Badge className={accountTypeColors[type]}>
                  {typeAccounts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Normal Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">
                        {account.accountCode}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.accountName}</p>
                          {account.description && (
                            <p className="text-xs text-muted-foreground">
                              {account.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.normalBalance}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.status === 'ACTIVE' ? 'default' : 'secondary'}
                        >
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(account.balanceInKes ?? account.balance / 100)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
