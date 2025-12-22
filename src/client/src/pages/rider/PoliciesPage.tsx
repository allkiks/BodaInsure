import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Calendar,
  FileText,
  Download,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDate } from '@/lib/utils';
import { policyApi } from '@/services/api/policy.api';
import type { PolicyStatus } from '@/types';

// GAP-015: Status config uses UPPERCASE to match server/types
const statusConfig: Record<PolicyStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Active', icon: <CheckCircle className="h-3 w-3" />, variant: 'default' },
  PENDING: { label: 'Pending', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  EXPIRED: { label: 'Expired', icon: <AlertCircle className="h-3 w-3" />, variant: 'outline' },
  CANCELLED: { label: 'Cancelled', icon: <AlertCircle className="h-3 w-3" />, variant: 'destructive' },
  LAPSED: { label: 'Lapsed', icon: <AlertCircle className="h-3 w-3" />, variant: 'destructive' },
};

export default function PoliciesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-policies'],
    queryFn: () => policyApi.getMyPolicies(),
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
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Failed to load policies</p>
      </div>
    );
  }

  const policies = data?.data ?? [];
  // GAP-015: Use UPPERCASE status constants
  const activePolicies = policies.filter((p) => p.status === 'ACTIVE');
  const hasActivePolicy = activePolicies.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Policies</h1>
        <p className="text-muted-foreground">
          View and manage your insurance policies
        </p>
      </div>

      {/* Active Policy Summary */}
      {hasActivePolicy && (
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              You're Covered!
            </CardTitle>
            <CardDescription className="text-green-100">
              Your TPO insurance is active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-100">Policy Number</p>
                <p className="text-xl font-bold">{activePolicies[0].policyNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-100">Valid Until</p>
                <p className="text-xl font-bold">{formatDate(activePolicies[0].endDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Policies Message */}
      {policies.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Policies Yet</h3>
            <p className="mt-2 text-center text-muted-foreground">
              Complete your initial deposit to receive your first policy
            </p>
            <Button asChild className="mt-4">
              <Link to="/my/payment">Make Deposit</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Policies List */}
      {policies.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">All Policies</h2>
          {policies.map((policy) => {
            const config = statusConfig[policy.status];
            // GAP-015: Use UPPERCASE status constant
            const daysRemaining = policy.status === 'ACTIVE'
              ? Math.ceil((new Date(policy.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 0;

            return (
              <Card key={policy.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Shield className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{policy.policyNumber}</p>
                          <Badge variant={config.variant} className="gap-1">
                            {config.icon}
                            {config.label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(policy.startDate)} - {formatDate(policy.endDate)}
                          </span>
                          <span className="capitalize">{policy.type} Policy</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {policy.status === 'ACTIVE' && daysRemaining > 0 && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{daysRemaining}</p>
                          <p className="text-xs text-muted-foreground">days left</p>
                        </div>
                      )}
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/my/policies/${policy.id}`}>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar for extended policy */}
                  {policy.type === 'extended' && policy.progress !== undefined && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Payment Progress</span>
                        <span>{policy.daysCompleted ?? 0}/30 days</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${policy.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Policy Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            About Your Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium">Initial Policy (1 Month)</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Issued after paying the initial deposit of KES 1,048. Provides TPO coverage for one month.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium">Extended Policy (11 Months)</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Issued after completing 30 daily payments of KES 87. Extends your coverage for 11 more months.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
