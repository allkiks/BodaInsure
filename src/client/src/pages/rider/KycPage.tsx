import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  Image,
  X,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { kycApi } from '@/services/api/kyc.api';
import { getErrorMessage } from '@/services/api/client';
import type { DocumentType, DocumentStatus } from '@/types';

// Status config matching server DocumentStatus enum values
const statusConfig: Record<DocumentStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  APPROVED: { label: 'Approved', icon: <CheckCircle className="h-4 w-4" />, variant: 'default', color: 'text-green-600' },
  PENDING: { label: 'Pending', icon: <Clock className="h-4 w-4" />, variant: 'secondary', color: 'text-yellow-600' },
  PROCESSING: { label: 'Processing', icon: <Clock className="h-4 w-4" />, variant: 'secondary', color: 'text-blue-600' },
  IN_REVIEW: { label: 'Under Review', icon: <Clock className="h-4 w-4" />, variant: 'secondary', color: 'text-yellow-600' },
  REJECTED: { label: 'Rejected', icon: <AlertCircle className="h-4 w-4" />, variant: 'destructive', color: 'text-red-600' },
};

// Default status config for unknown values
const defaultStatusConfig = { label: 'Unknown', icon: <Clock className="h-4 w-4" />, variant: 'outline' as const, color: 'text-gray-600' };

// Document labels matching server DocumentType enum values
const documentLabels: Record<DocumentType, string> = {
  ID_FRONT: 'National ID (Front)',
  ID_BACK: 'National ID (Back)',
  LICENSE: 'Driving License',
  LOGBOOK: 'Vehicle Logbook',
  KRA_PIN: 'KRA PIN Certificate',
  PHOTO: 'Passport Photo',
};

interface UploadingDoc {
  type: DocumentType;
  file: File;
  preview: string;
}

export default function KycPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<UploadingDoc | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: kycApi.getMyStatus,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ type, file }: { type: DocumentType; file: File }) =>
      kycApi.uploadDocument(type, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
      setUploadingDoc(null);
      setSelectedDocType(null);
      setUploadError(null);
    },
    onError: (error) => {
      setUploadError(getErrorMessage(error));
    },
  });

  const handleFileSelect = (type: DocumentType) => {
    setSelectedDocType(type);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocType) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    const preview = URL.createObjectURL(file);
    setUploadingDoc({ type: selectedDocType, file, preview });
    e.target.value = '';
  };

  const handleUpload = () => {
    if (!uploadingDoc) return;
    uploadMutation.mutate({ type: uploadingDoc.type, file: uploadingDoc.file });
  };

  const cancelUpload = () => {
    if (uploadingDoc?.preview) {
      URL.revokeObjectURL(uploadingDoc.preview);
    }
    setUploadingDoc(null);
    setSelectedDocType(null);
    setUploadError(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Normalize overall status (could be lowercase from some endpoints)
  const rawOverallStatus = kycStatus?.overallStatus ?? 'PENDING';
  const overallStatus = rawOverallStatus.toUpperCase() as DocumentStatus;
  const completedDocs = kycStatus?.completedDocuments ?? 0;
  const totalRequired = kycStatus?.totalRequired ?? 6;
  const progressPercent = (completedDocs / totalRequired) * 100;
  const overallStatusConfig = statusConfig[overallStatus] ?? defaultStatusConfig;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KYC Documents</h1>
        <p className="text-muted-foreground">
          Upload your identification documents for verification
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Verification Status
            </CardTitle>
            <Badge variant={overallStatusConfig.variant} className="gap-1">
              {overallStatusConfig.icon}
              {overallStatusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Documents Verified</span>
            <span className="font-medium">
              {completedDocs} / {totalRequired}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {overallStatus === 'APPROVED' && (
            <div className="rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-950 dark:text-green-400">
              <CheckCircle className="mb-1 h-5 w-5" />
              <p className="font-medium">KYC Verification Complete!</p>
              <p className="text-sm">Your identity has been verified successfully.</p>
            </div>
          )}
          {overallStatus === 'REJECTED' && (
            <div className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="mb-1 h-5 w-5" />
              <p className="font-medium">Verification Rejected</p>
              <p className="text-sm">Please re-upload the rejected documents below.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Preview Modal */}
      {uploadingDoc && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Preview</CardTitle>
            <CardDescription>
              {documentLabels[uploadingDoc.type]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative mx-auto max-w-sm overflow-hidden rounded-lg border">
              <img
                src={uploadingDoc.preview}
                alt="Document preview"
                className="w-full object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={cancelUpload}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {uploadError && (
              <p className="text-center text-sm text-destructive">{uploadError}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={cancelUpload}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {kycStatus?.documents.map((doc) => {
          // Normalize status to uppercase for comparison
          const normalizedStatus = (doc.status?.toUpperCase() ?? 'PENDING') as DocumentStatus;
          const config = statusConfig[normalizedStatus] ?? defaultStatusConfig;
          const docLabel = documentLabels[doc.type] ?? doc.type;
          return (
            <Card key={doc.type}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      normalizedStatus === 'APPROVED' ? 'bg-green-100 dark:bg-green-900' :
                      normalizedStatus === 'REJECTED' ? 'bg-red-100 dark:bg-red-900' :
                      normalizedStatus === 'PENDING' || normalizedStatus === 'IN_REVIEW' || normalizedStatus === 'PROCESSING' ? 'bg-yellow-100 dark:bg-yellow-900' :
                      'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      {normalizedStatus === 'APPROVED' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : normalizedStatus === 'REJECTED' ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      ) : normalizedStatus === 'PENDING' || normalizedStatus === 'IN_REVIEW' || normalizedStatus === 'PROCESSING' ? (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <Image className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{docLabel}</p>
                      <Badge variant={config.variant} className="mt-1 gap-1">
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </div>

                {doc.rejectionReason && (
                  <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
                    <p className="font-medium">Rejection reason:</p>
                    <p>{doc.rejectionReason}</p>
                  </div>
                )}

                {(normalizedStatus === 'REJECTED' || !doc.uploadedAt) && (
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => handleFileSelect(doc.type)}
                    disabled={!!uploadingDoc}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {normalizedStatus === 'REJECTED' ? 'Re-upload' : 'Upload'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Requirements Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
            <p>Photos must be clear and all text must be readable</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
            <p>Maximum file size: 5MB per image</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
            <p>Accepted formats: JPG, PNG, HEIC</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
            <p>Documents must not be expired</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
