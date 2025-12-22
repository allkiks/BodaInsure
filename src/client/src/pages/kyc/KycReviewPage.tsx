import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileCheck,
  CheckCircle,
  XCircle,
  User,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { kycApi } from '@/services/api/kyc.api';
import { toast } from '@/hooks/use-toast';
import { maskPhone, formatDateTime } from '@/lib/utils';

const documentTypeLabels: Record<string, string> = {
  // Server document types (uppercase)
  ID_FRONT: 'National ID (Front)',
  ID_BACK: 'National ID (Back)',
  LICENSE: 'Driving License',
  LOGBOOK: 'Vehicle Logbook',
  KRA_PIN: 'KRA PIN Certificate',
  PHOTO: 'Passport Photo',
  // Legacy types (for backwards compatibility)
  national_id_front: 'National ID (Front)',
  national_id_back: 'National ID (Back)',
  driving_license: 'Driving License',
  selfie: 'Selfie',
};

export default function KycReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const { data: doc, isLoading } = useQuery({
    queryKey: ['kyc', 'document', id],
    queryFn: () => kycApi.getDocument(id!),
    enabled: !!id,
  });

  // Get presigned URL for document viewing (URL is directly accessible without auth)
  const { data: docUrl, isLoading: isLoadingUrl } = useQuery({
    queryKey: ['kyc', 'document', id, 'url'],
    queryFn: () => kycApi.getDocumentUrl(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const approveMutation = useMutation({
    mutationFn: () => kycApi.approveDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      toast({ title: 'Approved', description: 'Document has been approved.' });
      navigate('/kyc');
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed', description: 'Failed to approve document.' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => kycApi.rejectDocument(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      toast({ title: 'Rejected', description: 'Document has been rejected.' });
      navigate('/kyc');
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed', description: 'Failed to reject document.' });
    },
  });

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please provide a rejection reason.' });
      return;
    }
    rejectMutation.mutate(rejectReason);
    setRejectDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Document not found</p>
        <Button variant="outline" onClick={() => navigate('/kyc')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/kyc')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {documentTypeLabels[doc.type] ?? doc.type}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              {doc.user?.firstName && doc.user?.lastName
                ? `${doc.user.firstName} ${doc.user.lastName}`
                : maskPhone(doc.user?.phone || '')}
            </div>
          </div>
        </div>
        <Badge className="bg-yellow-100 text-yellow-800">
          {doc.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Document Viewer */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Document Preview</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center overflow-auto rounded-lg border bg-muted/50 p-4" style={{ minHeight: '400px' }}>
                {isLoadingUrl ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <LoadingSpinner size="lg" />
                    <p>Loading document...</p>
                  </div>
                ) : docUrl?.url ? (
                  <img
                    src={docUrl.url}
                    alt={documentTypeLabels[doc.type]}
                    className="max-w-full transition-transform"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileCheck className="h-12 w-12" />
                    <p>Failed to load document</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Document Type</p>
                <p className="font-medium">{documentTypeLabels[doc.type]}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uploaded</p>
                <p className="font-medium">{formatDateTime(doc.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">User</p>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => doc.user?.id && navigate(`/users/${doc.user.id}`)}
                >
                  {doc.user?.firstName && doc.user?.lastName
                    ? `${doc.user.firstName} ${doc.user.lastName}`
                    : maskPhone(doc.user?.phone || '')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Document
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setRejectDialogOpen(true)}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Document
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be shared with the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Document is blurry, ID is expired..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
