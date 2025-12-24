import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { policyTermsApi } from '@/services/api/policy-terms.api';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import type { PolicyTerms, PolicyTermsType } from '@/types';

const typeLabels: Record<PolicyTermsType, string> = {
  TPO: 'Third Party Only (TPO)',
  COMPREHENSIVE: 'Comprehensive',
};

export default function PolicyTermsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTerms, setPreviewTerms] = useState<PolicyTerms | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTermsId, setDeleteTermsId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['policy-terms', typeFilter, page],
    queryFn: () =>
      policyTermsApi.list({
        type: typeFilter !== 'all' ? typeFilter : undefined,
        page,
        limit: 20,
      }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => policyTermsApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-terms'] });
      toast({ title: 'Policy Terms Activated', description: 'The policy terms are now active.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to activate policy terms.' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => policyTermsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-terms'] });
      toast({ title: 'Policy Terms Deactivated', description: 'The policy terms have been deactivated.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to deactivate policy terms.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => policyTermsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-terms'] });
      toast({ title: 'Policy Terms Deleted', description: 'The policy terms have been deleted.' });
      setShowDeleteDialog(false);
      setDeleteTermsId(null);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete policy terms.' });
    },
  });

  const handlePreview = (terms: PolicyTerms) => {
    setPreviewTerms(terms);
    setShowPreview(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTermsId(id);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policy Terms</h1>
          <p className="text-muted-foreground">
            Manage insurance policy terms and conditions
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Create New Version
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Policy Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="TPO">Third Party Only (TPO)</SelectItem>
                <SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-4">
          {data.data.map((terms) => (
            <Card key={terms.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{terms.title}</CardTitle>
                        <Badge variant="outline">v{terms.version}</Badge>
                        {terms.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {typeLabels[terms.type]} • Underwriter: {terms.underwriterName}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreview(terms)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {terms.isActive ? (
                        <DropdownMenuItem onClick={() => deactivateMutation.mutate(terms.id)}>
                          <XCircle className="mr-2 h-4 w-4 text-yellow-600" />
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => activateMutation.mutate(terms.id)}>
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(terms.id)}
                        className="text-red-600"
                        disabled={terms.isActive}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{terms.summary}</p>
                <div className="grid gap-4 text-sm md:grid-cols-4">
                  <div>
                    <span className="font-medium">Free Look Period</span>
                    <p className="text-muted-foreground">{terms.freeLookDays} days</p>
                  </div>
                  <div>
                    <span className="font-medium">Effective From</span>
                    <p className="text-muted-foreground">{formatDate(terms.effectiveFrom)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Created</span>
                    <p className="text-muted-foreground">{formatDate(terms.createdAt)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Last Updated</span>
                    <p className="text-muted-foreground">{formatDate(terms.updatedAt)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {terms.keyTerms.slice(0, 5).map((term, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {term}
                    </Badge>
                  ))}
                  {terms.keyTerms.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{terms.keyTerms.length - 5} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No policy terms found</p>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Create First Policy Terms
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewTerms?.title}
            </DialogTitle>
            <DialogDescription>
              Version {previewTerms?.version} • {previewTerms?.type && typeLabels[previewTerms.type]}
            </DialogDescription>
          </DialogHeader>
          {previewTerms && (
            <div className="space-y-6">
              {/* Summary */}
              <div>
                <h4 className="mb-2 font-medium">Summary</h4>
                <p className="text-sm text-muted-foreground">{previewTerms.summary}</p>
              </div>

              {/* Key Terms */}
              <div>
                <h4 className="mb-2 font-medium">Key Terms</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {previewTerms.keyTerms.map((term, idx) => (
                    <li key={idx}>{term}</li>
                  ))}
                </ul>
              </div>

              {/* Inclusions */}
              <div>
                <h4 className="mb-2 font-medium">What's Covered</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {previewTerms.inclusions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Exclusions */}
              <div>
                <h4 className="mb-2 font-medium">What's Not Covered</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {previewTerms.exclusions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Claims Process */}
              <div>
                <h4 className="mb-2 font-medium">Claims Process</h4>
                <p className="text-sm text-muted-foreground">{previewTerms.claimsProcess}</p>
              </div>

              {/* Cancellation Policy */}
              <div>
                <h4 className="mb-2 font-medium">Cancellation Policy</h4>
                <p className="text-sm text-muted-foreground">{previewTerms.cancellationPolicy}</p>
              </div>

              {/* Full Content */}
              <div>
                <h4 className="mb-2 font-medium">Full Terms & Conditions</h4>
                <div
                  className="prose prose-sm max-w-none rounded-lg border bg-muted/50 p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: previewTerms.content }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Policy Terms
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete these policy terms? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTermsId && deleteMutation.mutate(deleteTermsId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
