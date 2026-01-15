import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  AlertCircle,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { accountingApi } from '@/services/api/accounting.api';
import { formatCurrency } from '@/lib/utils';
import type { PartnerType } from '@/types';

const partnerLabels: Record<PartnerType, string> = {
  KBA: 'Kenya Bodaboda Association',
  ROBS_INSURANCE: 'Robs Insurance Agency',
  DEFINITE_ASSURANCE: 'Definite Assurance',
  ATRONACH: 'Atronach K Ltd',
};

export default function FinancialReportsPage() {
  const [activeTab, setActiveTab] = useState('balance-sheet');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPartner, setSelectedPartner] = useState<PartnerType>('KBA');

  const { data: balanceSheet, isLoading: bsLoading, error: bsError } = useQuery({
    queryKey: ['accounting', 'balance-sheet', reportDate],
    queryFn: () => accountingApi.getBalanceSheet(reportDate),
    enabled: activeTab === 'balance-sheet',
  });

  const { data: incomeStatement, isLoading: isLoading, error: isError } = useQuery({
    queryKey: ['accounting', 'income-statement', startDate, endDate],
    queryFn: () => accountingApi.getIncomeStatement(startDate!, endDate!),
    enabled: activeTab === 'income-statement' && !!startDate && !!endDate,
  });

  const { data: partnerStatement, isLoading: psLoading, error: psError } = useQuery({
    queryKey: ['accounting', 'partner-statement', selectedPartner, startDate, endDate],
    queryFn: () => accountingApi.getPartnerStatement(selectedPartner, startDate!, endDate!),
    enabled: activeTab === 'partner-statement' && !!startDate && !!endDate,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">
            Generate and view financial statements
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="partner-statement">Partner Statement</TabsTrigger>
        </TabsList>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Balance Sheet</CardTitle>
                  <CardDescription>Statement of financial position</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : bsError ? (
                <div className="flex h-32 items-center justify-center text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Failed to load balance sheet
                </div>
              ) : balanceSheet ? (
                <div className="space-y-6">
                  {/* Assets */}
                  <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">ASSETS</h3>
                    <div className="space-y-2 pl-4">
                      {balanceSheet.assets?.accounts?.map((item, idx) => (
                        <div key={idx} className="flex justify-between pl-4">
                          <span>{item.accountName}</span>
                          <span className="font-mono">{formatCurrency((item.balanceKes ?? item.balance / 100))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold text-lg mt-4 border-t-2 pt-2">
                      <span>TOTAL ASSETS</span>
                      <span className="font-mono">{formatCurrency(balanceSheet.assets?.totalKes ?? (balanceSheet.assets?.total ?? 0) / 100)}</span>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">LIABILITIES</h3>
                    <div className="space-y-2 pl-4">
                      {balanceSheet.liabilities?.accounts?.map((item, idx) => (
                        <div key={idx} className="flex justify-between pl-4">
                          <span>{item.accountName}</span>
                          <span className="font-mono">{formatCurrency((item.balanceKes ?? item.balance / 100))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold text-lg mt-4 border-t pt-2">
                      <span>TOTAL LIABILITIES</span>
                      <span className="font-mono">{formatCurrency(balanceSheet.liabilities?.totalKes ?? (balanceSheet.liabilities?.total ?? 0) / 100)}</span>
                    </div>
                  </div>

                  {/* Equity */}
                  <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">EQUITY</h3>
                    <div className="space-y-2 pl-4">
                      {balanceSheet.equity?.accounts?.map((item, idx) => (
                        <div key={idx} className="flex justify-between pl-4">
                          <span>{item.accountName}</span>
                          <span className="font-mono">{formatCurrency((item.balanceKes ?? item.balance / 100))}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-2">
                        <span>Retained Earnings</span>
                        <span className="font-mono">{formatCurrency(balanceSheet.equity?.retainedEarningsKes ?? (balanceSheet.equity?.retainedEarnings ?? 0) / 100)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-lg mt-4 border-t pt-2">
                      <span>TOTAL EQUITY</span>
                      <span className="font-mono">{formatCurrency(balanceSheet.equity?.totalKes ?? (balanceSheet.equity?.total ?? 0) / 100)}</span>
                    </div>
                  </div>

                  {/* Verification */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between font-bold text-lg">
                      <span>TOTAL LIABILITIES + EQUITY</span>
                      <span className="font-mono">
                        {formatCurrency(balanceSheet.totalLiabilitiesAndEquityKes ?? (balanceSheet.totalLiabilitiesAndEquity ?? 0) / 100)}
                      </span>
                    </div>
                    <Badge
                      variant={balanceSheet.isBalanced ? 'default' : 'destructive'}
                      className="mt-2"
                    >
                      {balanceSheet.isBalanced
                        ? 'Balance Sheet is Balanced'
                        : 'Balance Sheet is NOT Balanced'}
                    </Badge>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Income Statement */}
        <TabsContent value="income-statement" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Income Statement</CardTitle>
                  <CardDescription>Profit and Loss Report</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                  <span>to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : isError ? (
                <div className="flex h-32 items-center justify-center text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Failed to load income statement
                </div>
              ) : incomeStatement ? (
                <div className="space-y-6">
                  {/* Income */}
                  <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      INCOME
                    </h3>
                    <div className="space-y-2 pl-4">
                      {incomeStatement.income?.accounts?.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.accountName}</span>
                          <span className="font-mono text-green-600">{formatCurrency((item.balanceKes ?? item.balance / 100))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold mt-4 border-t pt-2">
                      <span>TOTAL INCOME</span>
                      <span className="font-mono text-green-600">{formatCurrency(incomeStatement.income?.totalKes ?? (incomeStatement.income?.total ?? 0) / 100)}</span>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3 flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      EXPENSES
                    </h3>
                    <div className="space-y-2 pl-4">
                      {incomeStatement.expenses?.accounts?.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.accountName}</span>
                          <span className="font-mono text-red-600">({formatCurrency((item.balanceKes ?? item.balance / 100))})</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold mt-4 border-t pt-2">
                      <span>TOTAL EXPENSES</span>
                      <span className="font-mono text-red-600">({formatCurrency(incomeStatement.expenses?.totalKes ?? (incomeStatement.expenses?.total ?? 0) / 100)})</span>
                    </div>
                  </div>

                  {/* Net Income */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between font-bold text-xl">
                      <span>NET INCOME</span>
                      <span className={`font-mono ${(incomeStatement.netIncomeKes ?? incomeStatement.netIncome ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(incomeStatement.netIncomeKes ?? incomeStatement.netIncome ?? 0) >= 0
                          ? formatCurrency(incomeStatement.netIncomeKes ?? (incomeStatement.netIncome ?? 0) / 100)
                          : `(${formatCurrency(Math.abs(incomeStatement.netIncomeKes ?? (incomeStatement.netIncome ?? 0) / 100))})`}
                      </span>
                    </div>
                    <Badge variant={(incomeStatement.netIncomeKes ?? incomeStatement.netIncome ?? 0) >= 0 ? 'default' : 'destructive'} className="mt-2">
                      {(incomeStatement.netIncomeKes ?? incomeStatement.netIncome ?? 0) >= 0 ? 'Profit' : 'Loss'}
                    </Badge>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partner Statement */}
        <TabsContent value="partner-statement" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Partner Statement</CardTitle>
                  <CardDescription>Settlement history for partners</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Partner</Label>
                    <Select value={selectedPartner} onValueChange={(v) => setSelectedPartner(v as PartnerType)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KBA">KBA</SelectItem>
                        <SelectItem value="ROBS_INSURANCE">Robs Insurance</SelectItem>
                        <SelectItem value="DEFINITE_ASSURANCE">Definite Assurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-40"
                    />
                    <span>to</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-40"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {psLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : psError ? (
                <div className="flex h-32 items-center justify-center text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Failed to load partner statement
                </div>
              ) : partnerStatement ? (
                <div className="space-y-6">
                  {/* Partner Header */}
                  <div className="border-b pb-4">
                    <h3 className="text-xl font-bold">{partnerLabels[partnerStatement.partnerType]}</h3>
                    <p className="text-muted-foreground">
                      Period: {new Date(partnerStatement.periodStart).toLocaleDateString()} - {new Date(partnerStatement.periodEnd).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Settled</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(partnerStatement.summary?.settledAmountKes ?? (partnerStatement.summary?.settledAmount ?? 0) / 100)}
                      </p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {formatCurrency(partnerStatement.summary?.pendingAmountKes ?? (partnerStatement.summary?.pendingAmount ?? 0) / 100)}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Debits</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(partnerStatement.summary?.totalDebitsKes ?? (partnerStatement.summary?.totalDebits ?? 0) / 100)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Credits</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(partnerStatement.summary?.totalCreditsKes ?? (partnerStatement.summary?.totalCredits ?? 0) / 100)}
                      </p>
                    </div>
                  </div>

                  {/* Balance Summary */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Opening Balance</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(partnerStatement.openingBalanceKes ?? (partnerStatement.openingBalance ?? 0) / 100)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Closing Balance</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(partnerStatement.closingBalanceKes ?? (partnerStatement.closingBalance ?? 0) / 100)}
                      </p>
                    </div>
                  </div>

                  {/* Transaction List */}
                  <div>
                    <h4 className="font-semibold mb-3">Transaction History</h4>
                    {(partnerStatement.transactions?.length ?? 0) === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2" />
                        <p>No transactions found for this period</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {partnerStatement.transactions?.map((transaction, index) => (
                          <div
                            key={`${transaction.reference}-${index}`}
                            className="flex items-center justify-between border rounded-lg p-3"
                          >
                            <div>
                              <p className="font-medium">{transaction.reference || 'N/A'}</p>
                              <p className="text-sm text-muted-foreground">
                                {transaction.description || 'No description'} - {new Date(transaction.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              {(transaction.debitKes ?? transaction.debit) > 0 && (
                                <p className="font-semibold text-red-600">
                                  Dr: {formatCurrency(transaction.debitKes ?? transaction.debit / 100)}
                                </p>
                              )}
                              {(transaction.creditKes ?? transaction.credit) > 0 && (
                                <p className="font-semibold text-green-600">
                                  Cr: {formatCurrency(transaction.creditKes ?? transaction.credit / 100)}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Bal: {formatCurrency(transaction.balanceKes ?? transaction.balance / 100)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
