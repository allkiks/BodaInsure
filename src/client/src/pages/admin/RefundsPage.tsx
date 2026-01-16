import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Banknote,
  FileText,
  Send,
  Ban,
  ArrowUpDown,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { refundsApi, RiderRefund, RefundStatus } from '@/services/api/refunds.api';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColors: Record<RefundStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const StatusIcon = ({ status }: { status: RefundStatus }) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'PROCESSING':
      return <RefreshCw className="h-4 w-4 text-purple-500 animate-spin" />;
    case 'APPROVED':
      return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case 'CANCELLED':
      return <Ban className="h-4 w-4 text-gray-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
};

export default function RefundsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RefundStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selectedRefund, setSelectedRefund] = useState<RiderRefund | null>(null);
  const [processDialog, setProcessDialog] = useState<{ open: boolean; refund: RiderRefund | null; payoutPhone: string }>({
    open: false,
    refund: null,
    payoutPhone: '',
  });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; refund: RiderRefund | null; reason: string }>({
    open: false,
    refund: null,
    reason: '',
  });
  const [failDialog, setFailDialog] = useState<{ open: boolean; refund: RiderRefund | null; reason: string }>({
    open: false,
    refund: null,
    reason: '',
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'complete';
    refund: RiderRefund | null;
  }>({ open: false, action: 'approve', refund: null });
  const limit = 20;

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['refunds', 'stats'],
    queryFn: () => refundsApi.getStats(),
    refetchInterval: 30000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['refunds', 'list', statusFilter, page],
    queryFn: () => refundsApi.getRefunds({
      status: statusFilter || undefined,
      page,
      limit,
    }),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (refundId: string) => refundsApi.approveRefund(refundId),
    onSuccess: () => {
      toast({ title: 'Refund approved' });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    onError: () => toast({ title: 'Failed to approve refund', variant: 'destructive' }),
  });

  const processMutation = useMutation({
    mutationFn: ({ refundId, payoutPhone }: { refundId: string; payoutPhone?: string }) =>
      refundsApi.processRefund(refundId, payoutPhone),
    onSuccess: () => {
      toast({ title: 'Refund payout initiated' });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setProcessDialog({ open: false, refund: null, payoutPhone: '' });
    },
    onError: () => toast({ title: 'Failed to process refund', variant: 'destructive' }),
  });

  const completeMutation = useMutation({
    mutationFn: (refundId: string) => refundsApi.completeRefund(refundId),
    onSuccess: () => {
      toast({ title: 'Refund marked as completed' });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    onError: () => toast({ title: 'Failed to complete refund', variant: 'destructive' }),
  });

  const failMutation = useMutation({
    mutationFn: ({ refundId, reason }: { refundId: string; reason: string }) =>
      refundsApi.failRefund(refundId, reason),
    onSuccess: () => {
      toast({ title: 'Refund marked as failed' });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setFailDialog({ open: false, refund: null, reason: '' });
    },
    onError: () => toast({ title: 'Failed to update refund', variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ refundId, reason }: { refundId: string; reason: string }) =>
      refundsApi.cancelRefund(refundId, reason),
    onSuccess: () => {
      toast({ title: 'Refund cancelled' });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setCancelDialog({ open: false, refund: null, reason: '' });
    },
    onError: () => toast({ title: 'Failed to cancel refund', variant: 'destructive' }),
  });

  const handleConfirm = () => {
    const { action, refund } = confirmDialog;
    if (!refund) return;

    if (action === 'approve') {
      approveMutation.mutate(refund.id);
    } else if (action === 'complete') {
      completeMutation.mutate(refund.id);
    }
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Refunds Management</h1>
          <p className="text-muted-foreground">
            Manage rider refund requests and payouts
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.approved}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-purple-500" />
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{stats.processing}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Refunded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalRefundedAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reversal Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalReversalFees)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48">
              <Label>Status</Label>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(v) => {
                  setStatusFilter(v === 'all' ? '' : v as RefundStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refunds Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Refund Requests
          </CardTitle>
          <CardDescription>
            {data?.total || 0} refunds found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Failed to load refunds
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Refund Number</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Original Amount</TableHead>
                    <TableHead>Refund (90%)</TableHead>
                    <TableHead>Reversal Fee (10%)</TableHead>
                    <TableHead>Days Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.refunds.map((refund) => (
                    <TableRow
                      key={refund.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRefund(refund)}
                    >
                      <TableCell className="font-medium">
                        {refund.refundNumber}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {refund.userId.substring(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>{formatCurrency(refund.originalAmountKes)}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {formatCurrency(refund.refundAmountKes)}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {formatCurrency(refund.reversalFeeKes)}
                      </TableCell>
                      <TableCell>{refund.daysPaid}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[refund.status]}>
                          <StatusIcon status={refund.status} />
                          <span className="ml-1">{refund.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(refund.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {refund.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  action: 'approve',
                                  refund,
                                })}
                              >
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCancelDialog({
                                  open: true,
                                  refund,
                                  reason: '',
                                })}
                              >
                                <Ban className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {refund.status === 'APPROVED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setProcessDialog({
                                open: true,
                                refund,
                                payoutPhone: refund.payoutPhone || '',
                              })}
                            >
                              <Send className="h-4 w-4 text-purple-500" />
                            </Button>
                          )}
                          {refund.status === 'PROCESSING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  action: 'complete',
                                  refund,
                                })}
                              >
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFailDialog({
                                  open: true,
                                  refund,
                                  reason: '',
                                })}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.refunds || data.refunds.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No refunds found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Refund Detail Dialog */}
      <Dialog open={!!selectedRefund} onOpenChange={() => setSelectedRefund(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Refund Details
            </DialogTitle>
            <DialogDescription>
              {selectedRefund?.refundNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Refund ID</Label>
                  <p className="font-mono text-sm">{selectedRefund.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="font-mono text-sm">{selectedRefund.userId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Policy ID</Label>
                  <p className="font-mono text-sm">{selectedRefund.policyId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedRefund.status]}>
                    {selectedRefund.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Original Amount</Label>
                  <p className="text-lg font-medium">{formatCurrency(selectedRefund.originalAmountKes)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Refund Amount (90%)</Label>
                  <p className="text-lg font-medium text-green-600">{formatCurrency(selectedRefund.refundAmountKes)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reversal Fee (10%)</Label>
                  <p className="text-lg font-medium text-orange-600">{formatCurrency(selectedRefund.reversalFeeKes)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Days Paid</Label>
                  <p>{selectedRefund.daysPaid}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payout Method</Label>
                  <p>{selectedRefund.payoutMethod}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payout Phone</Label>
                  <p>{selectedRefund.payoutPhone || '-'}</p>
                </div>
                {selectedRefund.mpesaTransactionId && (
                  <div>
                    <Label className="text-muted-foreground">M-Pesa Transaction ID</Label>
                    <p className="font-mono text-sm">{selectedRefund.mpesaTransactionId}</p>
                  </div>
                )}
                {selectedRefund.journalEntryId && (
                  <div>
                    <Label className="text-muted-foreground">Journal Entry ID</Label>
                    <p className="font-mono text-sm">{selectedRefund.journalEntryId}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Created At</Label>
                  <p>{formatDateTime(selectedRefund.createdAt)}</p>
                </div>
                {selectedRefund.approvedAt && (
                  <div>
                    <Label className="text-muted-foreground">Approved At</Label>
                    <p>{formatDateTime(selectedRefund.approvedAt)}</p>
                  </div>
                )}
                {selectedRefund.processedAt && (
                  <div>
                    <Label className="text-muted-foreground">Processed At</Label>
                    <p>{formatDateTime(selectedRefund.processedAt)}</p>
                  </div>
                )}
                {selectedRefund.completedAt && (
                  <div>
                    <Label className="text-muted-foreground">Completed At</Label>
                    <p>{formatDateTime(selectedRefund.completedAt)}</p>
                  </div>
                )}
              </div>

              {selectedRefund.cancellationReason && (
                <div>
                  <Label className="text-muted-foreground">Cancellation Reason</Label>
                  <p className="mt-1">{selectedRefund.cancellationReason}</p>
                </div>
              )}

              {selectedRefund.failureReason && (
                <div>
                  <Label className="text-muted-foreground">Failure Reason</Label>
                  <p className="mt-1 text-red-600">{selectedRefund.failureReason}</p>
                </div>
              )}

              {selectedRefund.metadata && Object.keys(selectedRefund.metadata).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Metadata</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-auto max-h-48">
                    {JSON.stringify(selectedRefund.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Process Refund Dialog */}
      <Dialog open={processDialog.open} onOpenChange={(open) => setProcessDialog({ ...processDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund Payout</DialogTitle>
            <DialogDescription>
              Initiate M-Pesa B2C payment for refund {processDialog.refund?.refundNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Refund Amount</Label>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(processDialog.refund?.refundAmountKes || 0)}
              </p>
            </div>
            <div>
              <Label>Payout Phone Number</Label>
              <Input
                placeholder="254712345678"
                value={processDialog.payoutPhone}
                onChange={(e) => setProcessDialog({ ...processDialog, payoutPhone: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter phone number in format 254XXXXXXXXX
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialog({ open: false, refund: null, payoutPhone: '' })}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (processDialog.refund) {
                  processMutation.mutate({
                    refundId: processDialog.refund.id,
                    payoutPhone: processDialog.payoutPhone || undefined,
                  });
                }
              }}
              disabled={processMutation.isPending}
            >
              {processMutation.isPending ? <LoadingSpinner size="sm" /> : 'Process Payout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Refund Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Refund</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel refund {cancelDialog.refund?.refundNumber}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Cancellation Reason</Label>
              <Input
                placeholder="Enter reason for cancellation..."
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog({ ...cancelDialog, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, refund: null, reason: '' })}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancelDialog.refund && cancelDialog.reason) {
                  cancelMutation.mutate({
                    refundId: cancelDialog.refund.id,
                    reason: cancelDialog.reason,
                  });
                }
              }}
              disabled={!cancelDialog.reason || cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <LoadingSpinner size="sm" /> : 'Cancel Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fail Refund Dialog */}
      <Dialog open={failDialog.open} onOpenChange={(open) => setFailDialog({ ...failDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Refund as Failed</DialogTitle>
            <DialogDescription>
              Mark refund {failDialog.refund?.refundNumber} as failed?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Failure Reason</Label>
              <Input
                placeholder="Enter reason for failure..."
                value={failDialog.reason}
                onChange={(e) => setFailDialog({ ...failDialog, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailDialog({ open: false, refund: null, reason: '' })}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (failDialog.refund && failDialog.reason) {
                  failMutation.mutate({
                    refundId: failDialog.refund.id,
                    reason: failDialog.reason,
                  });
                }
              }}
              disabled={!failDialog.reason || failMutation.isPending}
            >
              {failMutation.isPending ? <LoadingSpinner size="sm" /> : 'Mark as Failed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' && 'Approve Refund'}
              {confirmDialog.action === 'complete' && 'Complete Refund'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve' && (
                <>
                  Approve refund {confirmDialog.refund?.refundNumber} for{' '}
                  <span className="font-medium">{formatCurrency(confirmDialog.refund?.refundAmountKes || 0)}</span>?
                  This will allow the refund to be processed for payout.
                </>
              )}
              {confirmDialog.action === 'complete' && (
                <>
                  Mark refund {confirmDialog.refund?.refundNumber} as completed?
                  This confirms that the payout of{' '}
                  <span className="font-medium">{formatCurrency(confirmDialog.refund?.refundAmountKes || 0)}</span>{' '}
                  has been successfully sent to the rider.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmDialog.action === 'approve' ? 'Approve' : 'Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
