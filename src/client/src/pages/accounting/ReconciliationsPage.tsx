import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  FileSearch,
  LinkIcon,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { accountingApi } from '@/services/api/accounting.api';
import { formatCurrency } from '@/lib/utils';
import type { ReconciliationItem, ReconciliationStatus, MatchType } from '@/types';

const statusColors: Record<ReconciliationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  MATCHED: 'bg-green-100 text-green-800',
  UNMATCHED: 'bg-red-100 text-red-800',
  RESOLVED: 'bg-gray-100 text-gray-800',
};

const matchTypeColors: Record<MatchType, string> = {
  EXACT: 'bg-green-100 text-green-800',
  AMOUNT_ONLY: 'bg-blue-100 text-blue-800',
  REFERENCE_ONLY: 'bg-purple-100 text-purple-800',
  FUZZY: 'bg-amber-100 text-amber-800',
  MANUAL: 'bg-cyan-100 text-cyan-800',
  UNMATCHED: 'bg-red-100 text-red-800',
};

export default function ReconciliationsPage() {
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null);
  const [resolution, setResolution] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting', 'reconciliations'],
    queryFn: () => accountingApi.getReconciliations(),
  });

  const { data: selectedReconciliationData, isLoading: detailLoading } = useQuery({
    queryKey: ['accounting', 'reconciliation', selectedReconciliation],
    queryFn: () => accountingApi.getReconciliation(selectedReconciliation!),
    enabled: !!selectedReconciliation,
  });

  const resolveMutation = useMutation({
    mutationFn: (params: { reconciliationId: string; itemId: string; resolution: string }) =>
      accountingApi.resolveReconciliationItem(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'reconciliation'] });
      toast({ title: 'Item resolved successfully' });
      setResolveDialogOpen(false);
      setSelectedItem(null);
      setResolution('');
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to resolve item' });
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
        <p className="text-muted-foreground">Failed to load reconciliations</p>
      </div>
    );
  }

  const reconciliations = data?.data ?? [];

  const handleResolve = (item: ReconciliationItem) => {
    setSelectedItem(item);
    setResolveDialogOpen(true);
  };

  const submitResolve = () => {
    if (!selectedReconciliation || !selectedItem || !resolution.trim()) return;
    resolveMutation.mutate({
      reconciliationId: selectedReconciliation,
      itemId: selectedItem.id,
      resolution: resolution.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reconciliations</h1>
        <p className="text-muted-foreground">
          M-Pesa and bank statement reconciliation
        </p>
      </div>

      {/* Reconciliation List */}
      {!selectedReconciliation && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Records</CardTitle>
            <CardDescription>
              Click on a reconciliation to view details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reconciliations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileSearch className="h-12 w-12 mb-2" />
                <p>No reconciliations found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reconciliations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedReconciliation(rec.id)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileSearch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{rec.reconciliationNumber}</span>
                        <Badge className={statusColors[rec.status]}>
                          {rec.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rec.reconciliationType.replace('_', ' ')} - {new Date(rec.reconciliationDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rec.sourceSystem} → {rec.targetSystem}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {rec.matchedItems}/{rec.totalSourceItems} matched
                      </p>
                      {rec.variance !== 0 && (
                        <p className={`text-sm ${rec.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          Variance: {formatCurrency(rec.variance / 100)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Detail */}
      {selectedReconciliation && (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setSelectedReconciliation(null)}>
            ← Back to List
          </Button>

          {detailLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : selectedReconciliationData ? (
            <>
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5" />
                    {selectedReconciliationData.reconciliationNumber}
                  </CardTitle>
                  <CardDescription>
                    {selectedReconciliationData.reconciliationType.replace('_', ' ')} - {new Date(selectedReconciliationData.reconciliationDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Source Amount</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(selectedReconciliationData.totalSourceAmount / 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Target Amount</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(selectedReconciliationData.totalTargetAmount / 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Variance</p>
                      <p className={`text-lg font-semibold ${selectedReconciliationData.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(selectedReconciliationData.variance / 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={statusColors[selectedReconciliationData.status]}>
                        {selectedReconciliationData.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm text-muted-foreground">Matched</p>
                      <p className="text-xl font-bold text-green-600">{selectedReconciliationData.matchedItems}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <p className="text-sm text-muted-foreground">Unmatched</p>
                      <p className="text-xl font-bold text-red-600">{selectedReconciliationData.unmatchedItems}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm text-muted-foreground">Auto-matched</p>
                      <p className="text-xl font-bold text-blue-600">{selectedReconciliationData.autoMatchedItems}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <p className="text-sm text-muted-foreground">Manual</p>
                      <p className="text-xl font-bold text-purple-600">{selectedReconciliationData.manualMatchedItems}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Reconciliation Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source Reference</TableHead>
                        <TableHead>Source Amount</TableHead>
                        <TableHead>Target Reference</TableHead>
                        <TableHead>Target Amount</TableHead>
                        <TableHead>Match Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReconciliationData.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.sourceReference}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(item.sourceAmount / 100)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.targetReference || '-'}
                          </TableCell>
                          <TableCell>
                            {item.targetAmount ? formatCurrency(item.targetAmount / 100) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={matchTypeColors[item.matchType]}>
                              {item.matchType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[item.status]}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.status === 'UNMATCHED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolve(item)}
                              >
                                <LinkIcon className="h-3 w-3 mr-1" />
                                Resolve
                              </Button>
                            )}
                            {item.status === 'RESOLVED' && item.resolution && (
                              <span className="text-xs text-muted-foreground">
                                {item.resolution}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Unmatched Item</DialogTitle>
            <DialogDescription>
              Provide a resolution for this unmatched transaction
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Reference</Label>
                  <p className="font-mono">{selectedItem.sourceReference}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-semibold">{formatCurrency(selectedItem.sourceAmount / 100)}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="resolution">Resolution</Label>
                <Textarea
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Explain the resolution (e.g., 'Duplicate entry', 'Bank fee', 'Manual adjustment')"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitResolve}
              disabled={!resolution.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
