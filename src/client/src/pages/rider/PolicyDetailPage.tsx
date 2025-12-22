import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Shield,
  Calendar,
  Download,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  Car,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDate } from '@/lib/utils';
import { policyApi } from '@/services/api/policy.api';
import type { PolicyStatus } from '@/types';

// GAP-015: Status config uses UPPERCASE to match server/types
const statusConfig: Record<PolicyStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  ACTIVE: { label: 'Active', icon: <CheckCircle className="h-4 w-4" />, variant: 'default', color: 'text-green-600' },
  PENDING: { label: 'Pending', icon: <Clock className="h-4 w-4" />, variant: 'secondary', color: 'text-yellow-600' },
  EXPIRED: { label: 'Expired', icon: <AlertCircle className="h-4 w-4" />, variant: 'outline', color: 'text-gray-600' },
  CANCELLED: { label: 'Cancelled', icon: <AlertCircle className="h-4 w-4" />, variant: 'destructive', color: 'text-red-600' },
  LAPSED: { label: 'Lapsed', icon: <AlertCircle className="h-4 w-4" />, variant: 'destructive', color: 'text-red-600' },
};

// GAP-010: Document download state management
type DownloadState = 'idle' | 'loading' | 'generating' | 'ready' | 'error';

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [downloadMessage, setDownloadMessage] = useState<string>('');

  const { data: policy, isLoading, error } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policyApi.getById(id!),
    enabled: !!id,
  });

  // GAP-010: Handle document download with generation state
  const downloadDocument = useMutation({
    mutationFn: () => policyApi.downloadDocument(id!),
    onMutate: () => {
      setDownloadState('loading');
      setDownloadMessage('');
    },
    onSuccess: (data) => {
      if (data.url) {
        setDownloadState('ready');
        window.open(data.url, '_blank');
        // Reset to idle after a short delay
        setTimeout(() => setDownloadState('idle'), 2000);
      } else {
        // Document is being generated
        setDownloadState('generating');
        setDownloadMessage(data.message || 'Your policy document is being generated. This usually takes a few minutes.');
      }
    },
    onError: () => {
      setDownloadState('error');
      setDownloadMessage('Failed to download document. Please try again.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Policy not found</p>
        <Button variant="outline" onClick={() => navigate('/my/policies')}>
          Back to Policies
        </Button>
      </div>
    );
  }

  const config = statusConfig[policy.status];
  // GAP-015: Use UPPERCASE status constant
  const daysRemaining = policy.status === 'ACTIVE'
    ? Math.ceil((new Date(policy.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/my/policies')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Policy Details</h1>
          <p className="text-muted-foreground">{policy.policyNumber}</p>
        </div>
      </div>

      {/* Status Card */}
      <Card className={policy.status === 'ACTIVE' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' : ''}>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${policy.status === 'ACTIVE' ? 'bg-white/20' : 'bg-primary/10'}`}>
              <Shield className={`h-8 w-8 ${policy.status === 'ACTIVE' ? 'text-white' : 'text-primary'}`} />
            </div>
            <div>
              <Badge variant={policy.status === 'ACTIVE' ? 'secondary' : config.variant} className="gap-1 mb-2">
                {config.icon}
                {config.label}
              </Badge>
              <p className={`text-2xl font-bold ${policy.status === 'ACTIVE' ? 'text-white' : ''}`}>
                {policy.policyNumber}
              </p>
              <p className={`text-sm ${policy.status === 'ACTIVE' ? 'text-white/80' : 'text-muted-foreground'}`}>
                {policy.type === 'initial' ? 'Initial Policy (1 Month)' : 'Extended Policy (11 Months)'}
              </p>
            </div>
          </div>
          {policy.status === 'ACTIVE' && daysRemaining > 0 && (
            <div className="text-right">
              <p className="text-4xl font-bold">{daysRemaining}</p>
              <p className="text-sm text-white/80">days remaining</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policy Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              Coverage Period
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">{formatDate(policy.startDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span className="font-medium">{formatDate(policy.endDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">
                {policy.type === 'initial' ? '1 Month' : '11 Months'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4 text-primary" />
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Registration</span>
              <span className="font-medium">
                {policy.vehicleRegistration ?? 'Not specified'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Coverage Type</span>
              <span className="font-medium">Third Party Only (TPO)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Progress (for extended policy) */}
      {policy.type === 'extended' && policy.progress !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Progress</CardTitle>
            <CardDescription>
              Daily payments towards your 11-month policy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span>Days Completed</span>
              <span className="font-medium">{policy.daysCompleted ?? 0} / 30</span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-secondary">
              <div
                className="h-3 rounded-full bg-primary transition-all"
                style={{ width: `${policy.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Policy Document */}
      {policy.documentUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Policy Document
            </CardTitle>
            <CardDescription>
              Download your official policy certificate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* GAP-010: Show different states for document download */}
            {downloadState === 'generating' && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                <Clock className="h-4 w-4 animate-pulse" />
                <span className="text-sm">{downloadMessage}</span>
              </div>
            )}

            {downloadState === 'error' && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{downloadMessage}</span>
              </div>
            )}

            {downloadState === 'ready' && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Document opened in new tab</span>
              </div>
            )}

            <Button
              onClick={() => downloadDocument.mutate()}
              disabled={downloadState === 'loading'}
              variant={downloadState === 'generating' ? 'outline' : 'default'}
              className="w-full"
            >
              {downloadState === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : downloadState === 'generating' ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check Again
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Policy PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Policy Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This Third Party Only (TPO) insurance policy provides coverage for third-party
            bodily injury and property damage claims arising from the use of the insured vehicle.
          </p>
          <p>
            Coverage is subject to the terms and conditions set forth by Definite Assurance Company Limited.
          </p>
          <p>
            For claims and support, contact Definite Assurance at the numbers provided in your policy document.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
