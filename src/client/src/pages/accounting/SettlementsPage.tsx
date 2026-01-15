import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Check,
  Clock,
  AlertCircle,
  FileText,
  Filter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { accountingApi } from '@/services/api/accounting.api';
import { formatCurrency } from '@/lib/utils';
import type { PartnerSettlement, PartnerType, SettlementStatus } from '@/types';

const statusColors: Record<SettlementStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const statusIcons: Record<SettlementStatus, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3 mr-1" />,
  APPROVED: <Check className="h-3 w-3 mr-1" />,
  COMPLETED: <Check className="h-3 w-3 mr-1" />,
  CANCELLED: <AlertCircle className="h-3 w-3 mr-1" />,
  REJECTED: <AlertCircle className="h-3 w-3 mr-1" />,
};

const partnerLabels: Record<PartnerType, string> = {
  KBA: 'Kenya Bodaboda Association',
  ROBS_INSURANCE: 'Robs Insurance Agency',
  DEFINITE_ASSURANCE: 'Definite Assurance',
  ATRONACH: 'Atronach K Ltd',
};

export default function SettlementsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [selectedSettlement, setSelectedSettlement] = useState<PartnerSettlement | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [bankReference, setBankReference] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting', 'settlements', statusFilter, partnerFilter],
    queryFn: () =>
      accountingApi.getSettlements({
        status: statusFilter === 'all' ? undefined : statusFilter,
        partnerType: partnerFilter === 'all' ? undefined : (partnerFilter as PartnerType),
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (settlementId: string) =>
      accountingApi.approveSettlement({ settlementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'settlements'] });
      toast({ title: 'Settlement approved successfully' });
      setSelectedSettlement(null);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to approve settlement' });
    },
  });

  const processMutation = useMutation({
    mutationFn: (params: { settlementId: string; bankReference: string }) =>
      accountingApi.processSettlement(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'settlements'] });
      toast({ title: 'Settlement processed successfully' });
      setProcessDialogOpen(false);
      setSelectedSettlement(null);
      setBankReference('');
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to process settlement' });
    },
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
        <p className="text-muted-foreground">Failed to load settlements</p>
      </div>
    );
  }

  const settlements = data?.data ?? [];

  const handleApprove = (settlement: PartnerSettlement) => {
    if (window.confirm(`Are you sure you want to approve settlement ${settlement.settlementNumber}?`)) {
      approveMutation.mutate(settlement.id);
    }
  };

  const handleProcess = (settlement: PartnerSettlement) => {
    setSelectedSettlement(settlement);
    setProcessDialogOpen(true);
  };

  const submitProcess = () => {
    if (!selectedSettlement || !bankReference.trim()) return;
    processMutation.mutate({
      settlementId: selectedSettlement.id,
      bankReference: bankReference.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Partner Settlements</h1>
        <p className="text-muted-foreground">
          Manage service fee and commission settlements
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Partner</Label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Partners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  <SelectItem value="KBA">KBA</SelectItem>
                  <SelectItem value="ROBS_INSURANCE">Robs Insurance</SelectItem>
                  <SelectItem value="DEFINITE_ASSURANCE">Definite Assurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlements List */}
      <Card>
        <CardHeader>
          <CardTitle>Settlements ({settlements.length})</CardTitle>
          <CardDescription>
            Click on a settlement to view details and actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2" />
              <p>No settlements found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedSettlement(settlement)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{settlement.settlementNumber}</span>
                      <Badge className={statusColors[settlement.status]}>
                        {statusIcons[settlement.status]}
                        {settlement.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {partnerLabels[settlement.partnerType]} - {settlement.settlementType.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Period: {new Date(settlement.periodStart).toLocaleDateString()} - {new Date(settlement.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {formatCurrency(settlement.totalAmount / 100)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {settlement.transactionCount} transactions
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Detail Dialog */}
      <Dialog
        open={!!selectedSettlement && !processDialogOpen}
        onOpenChange={() => setSelectedSettlement(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
            <DialogDescription>
              {selectedSettlement?.settlementNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Partner</Label>
                  <p className="font-medium">{partnerLabels[selectedSettlement.partnerType]}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedSettlement.settlementType.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Period</Label>
                  <p className="font-medium">
                    {new Date(selectedSettlement.periodStart).toLocaleDateString()} - {new Date(selectedSettlement.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedSettlement.status]}>
                    {selectedSettlement.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="text-xl font-bold">{formatCurrency(selectedSettlement.totalAmount / 100)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Transactions</Label>
                  <p className="font-medium">{selectedSettlement.transactionCount}</p>
                </div>
                {selectedSettlement.approvedAt && (
                  <div>
                    <Label className="text-muted-foreground">Approved</Label>
                    <p className="font-medium">{new Date(selectedSettlement.approvedAt).toLocaleString()}</p>
                  </div>
                )}
                {selectedSettlement.bankReference && (
                  <div>
                    <Label className="text-muted-foreground">Bank Reference</Label>
                    <p className="font-medium">{selectedSettlement.bankReference}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedSettlement?.status === 'PENDING' && (
              <Button
                onClick={() => handleApprove(selectedSettlement)}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            )}
            {selectedSettlement?.status === 'APPROVED' && (
              <Button onClick={() => handleProcess(selectedSettlement)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedSettlement(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Payment Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Settlement Payment</DialogTitle>
            <DialogDescription>
              Enter the bank reference for the payment to {selectedSettlement?.settlementNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <p className="text-2xl font-bold">
                {selectedSettlement && formatCurrency(selectedSettlement.totalAmount / 100)}
              </p>
            </div>
            <div>
              <Label htmlFor="bankReference">Bank Reference</Label>
              <Input
                id="bankReference"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="Enter bank transfer reference"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitProcess}
              disabled={!bankReference.trim() || processMutation.isPending}
            >
              {processMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
