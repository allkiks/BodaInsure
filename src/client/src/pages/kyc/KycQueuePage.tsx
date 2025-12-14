import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, Clock, CheckCircle, XCircle, ChevronRight, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { kycApi } from '@/services/api/kyc.api';
import { maskPhone, formatDateTime } from '@/lib/utils';
import { useState } from 'react';

const documentTypeLabels: Record<string, string> = {
  national_id_front: 'National ID (Front)',
  national_id_back: 'National ID (Back)',
  driving_license: 'Driving License',
  selfie: 'Selfie',
};

export default function KycQueuePage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery({
    queryKey: ['kyc', 'stats'],
    queryFn: kycApi.getQueueStats,
  });

  const { data: queue, isLoading } = useQuery({
    queryKey: ['kyc', 'pending', page],
    queryFn: () => kycApi.getPendingQueue({ page }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KYC Review</h1>
        <p className="text-muted-foreground">
          Review and approve pending KYC documents
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {stats?.pending.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {stats?.approvedToday.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected Today</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {stats?.rejectedToday.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Processing</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats?.averageProcessingTime ?? 0}min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Pending Documents
          </CardTitle>
          <CardDescription>
            {queue?.meta.total ?? 0} document(s) awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : queue?.data && queue.data.length > 0 ? (
            <div className="space-y-2">
              {queue.data.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/kyc/${doc.id}`)}
                  className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                        <FileCheck className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {documentTypeLabels[doc.type] ?? doc.type}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          {doc.user.firstName && doc.user.lastName
                            ? `${doc.user.firstName} ${doc.user.lastName}`
                            : maskPhone(doc.user.phone)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Uploaded</p>
                        <p>{formatDateTime(doc.createdAt)}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}

              {/* Pagination */}
              {queue.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {queue.meta.page} of {queue.meta.totalPages}
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
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= queue.meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-muted-foreground">No pending documents</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
