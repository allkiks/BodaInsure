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
  Replace,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
  isReplacement: boolean;
}

export default function KycPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<UploadingDoc | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [pendingReplaceType, setPendingReplaceType] = useState<DocumentType | null>(null);
  // GAP-009: Track which rejection reasons are expanded
  const [expandedRejections, setExpandedRejections] = useState<Set<DocumentType>>(new Set());

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

  const handleFileSelect = (type: DocumentType, forceReplace = false) => {
    // Check if document already exists and is not rejected
    const existingDoc = kycStatus?.documents.find(d => d.type === type);
    const normalizedStatus = existingDoc?.status?.toUpperCase() as DocumentStatus | undefined;
    const hasExistingUpload = existingDoc?.uploaded && normalizedStatus !== 'REJECTED';

    if (hasExistingUpload && !forceReplace) {
      // Show confirmation dialog for replacement
      setPendingReplaceType(type);
      setShowReplaceDialog(true);
      return;
    }

    setSelectedDocType(type);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleConfirmReplace = () => {
    if (pendingReplaceType) {
      setShowReplaceDialog(false);
      handleFileSelect(pendingReplaceType, true);
      setPendingReplaceType(null);
    }
  };

  const handleCancelReplace = () => {
    setShowReplaceDialog(false);
    setPendingReplaceType(null);
  };

  // GAP-009: Toggle rejection reason expansion
  const toggleRejectionExpand = (docType: DocumentType) => {
    setExpandedRejections(prev => {
      const next = new Set(prev);
      if (next.has(docType)) {
        next.delete(docType);
      } else {
        next.add(docType);
      }
      return next;
    });
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

    // Check if this is replacing an existing document
    const existingDoc = kycStatus?.documents.find(d => d.type === selectedDocType);
    const isReplacement = !!existingDoc?.uploaded;

    const preview = URL.createObjectURL(file);
    setUploadingDoc({ type: selectedDocType, file, preview, isReplacement });
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

  // Calculate upload progress (documents uploaded, regardless of approval status)
  const uploadedDocs = kycStatus?.documents.filter(d => d.uploaded) ?? [];
  const uploadedCount = uploadedDocs.length;
  const uploadProgressPercent = (uploadedCount / totalRequired) * 100;

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

      {/* Upload Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Progress
          </CardTitle>
          <CardDescription>
            Track your document upload progress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Documents Uploaded</span>
            <span className="font-medium">
              {uploadedCount} / {totalRequired}
            </span>
          </div>
          <Progress value={uploadProgressPercent} className="h-2" />

          {/* Visual document checklist */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {kycStatus?.documents.map((doc) => {
              const isUploaded = doc.uploaded;
              const normalizedStatus = (doc.status?.toUpperCase() ?? 'PENDING') as DocumentStatus;
              const docLabel = documentLabels[doc.type] ?? doc.type;

              return (
                <div
                  key={doc.type}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
                    isUploaded
                      ? normalizedStatus === 'APPROVED'
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                        : normalizedStatus === 'REJECTED'
                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                        : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                  }`}
                >
                  {isUploaded ? (
                    normalizedStatus === 'APPROVED' ? (
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                    ) : normalizedStatus === 'REJECTED' ? (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 flex-shrink-0 text-yellow-600" />
                    )
                  ) : (
                    <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                  <span className={`truncate ${isUploaded ? 'font-medium' : 'text-muted-foreground'}`}>
                    {docLabel.replace('National ID ', 'ID ').replace('Certificate', '')}
                  </span>
                </div>
              );
            })}
          </div>

          {uploadedCount === totalRequired && (
            <div className="rounded-lg bg-blue-50 p-3 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              <CheckCircle className="mb-1 h-5 w-5" />
              <p className="font-medium">All Documents Uploaded!</p>
              <p className="text-sm">Your documents are being reviewed. This usually takes 24-48 hours.</p>
            </div>
          )}
        </CardContent>
      </Card>

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
            <CardTitle className="text-base">
              {uploadingDoc.isReplacement ? 'Replace Document' : 'Upload Preview'}
            </CardTitle>
            <CardDescription>
              {documentLabels[uploadingDoc.type]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadingDoc.isReplacement && (
              <div className="rounded-lg bg-yellow-50 p-3 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                <p className="text-sm">
                  <strong>Note:</strong> This will replace your previously uploaded document.
                </p>
              </div>
            )}
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
                    {uploadingDoc.isReplacement ? 'Replacing...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    {uploadingDoc.isReplacement ? (
                      <Replace className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {uploadingDoc.isReplacement ? 'Replace Document' : 'Upload Document'}
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

                {/* GAP-009: Expandable rejection reason display */}
                {doc.rejectionReason && (
                  <div className="mt-3 rounded-lg bg-red-50 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
                    <button
                      type="button"
                      onClick={() => toggleRejectionExpand(doc.type)}
                      className="flex w-full items-center justify-between p-2 text-left hover:bg-red-100 dark:hover:bg-red-900/50"
                    >
                      <span className="font-medium">
                        {expandedRejections.has(doc.type) ? 'Rejection reason:' : 'Show rejection reason'}
                      </span>
                      {expandedRejections.has(doc.type) ? (
                        <ChevronUp className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      )}
                    </button>
                    {expandedRejections.has(doc.type) && (
                      <div className="border-t border-red-200 p-2 dark:border-red-800">
                        <p>{doc.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Show upload button based on document state */}
                {!doc.uploaded ? (
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => handleFileSelect(doc.type)}
                    disabled={!!uploadingDoc}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                ) : normalizedStatus === 'REJECTED' ? (
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => handleFileSelect(doc.type)}
                    disabled={!!uploadingDoc}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Re-upload
                  </Button>
                ) : normalizedStatus !== 'APPROVED' ? (
                  <Button
                    variant="ghost"
                    className="mt-3 w-full text-muted-foreground"
                    onClick={() => handleFileSelect(doc.type)}
                    disabled={!!uploadingDoc}
                  >
                    <Replace className="mr-2 h-4 w-4" />
                    Replace Document
                  </Button>
                ) : null}
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

      {/* Replace Document Confirmation Dialog */}
      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Document?</AlertDialogTitle>
            <AlertDialogDescription>
              You have already uploaded this document ({pendingReplaceType ? documentLabels[pendingReplaceType] : ''}).
              Do you want to replace it with a new one? The previous version will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Yes, Replace Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
