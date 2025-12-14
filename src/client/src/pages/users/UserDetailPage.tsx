import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Shield,
  FileCheck,
  Wallet,
  RefreshCw,
  UserX,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { adminApi } from '@/services/api/admin.api';
import { toast } from '@/hooks/use-toast';
import { maskPhone, maskNationalId, formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { PAYMENT_AMOUNTS } from '@/config/constants';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

const kycStatusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

const paymentStatusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const policyStatusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  lapsed: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-blue-100 text-blue-800',
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: () => adminApi.getUserById(id!),
    enabled: !!id,
  });

  const resendOtpMutation = useMutation({
    mutationFn: () => adminApi.resendOtp(id!),
    onSuccess: () => {
      toast({ title: 'OTP Sent', description: 'OTP has been resent to the user.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed', description: 'Failed to resend OTP.' });
    },
  });

  const resetKycMutation = useMutation({
    mutationFn: () => adminApi.resetKyc(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      toast({ title: 'KYC Reset', description: 'User KYC has been reset.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed', description: 'Failed to reset KYC.' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => adminApi.activateUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      toast({ title: 'Activated', description: 'User has been activated.' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => adminApi.deactivateUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      toast({ title: 'Deactivated', description: 'User has been deactivated.' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">User not found</p>
        <Button variant="outline" onClick={() => navigate('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/users')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : 'User Details'}
            </h1>
            <p className="text-muted-foreground">{maskPhone(user.phone)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={statusColors[user.status]}>{user.status}</Badge>
          <Badge className={kycStatusColors[user.kycStatus]}>KYC: {user.kycStatus}</Badge>
        </div>
      </div>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resendOtpMutation.mutate()}
              disabled={resendOtpMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend OTP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetKycMutation.mutate()}
              disabled={resetKycMutation.isPending}
            >
              <FileCheck className="mr-2 h-4 w-4" />
              Reset KYC
            </Button>
            {user.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isPending}
              >
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="kyc">KYC Documents</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">First Name</p>
                    <p className="font-medium">{user.firstName ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Name</p>
                    <p className="font-medium">{user.lastName ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{maskPhone(user.phone)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user.email ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">National ID</p>
                    <p className="font-medium">{user.nationalId ? maskNationalId(user.nationalId) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{user.dateOfBirth ? formatDate(user.dateOfBirth) : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Wallet Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(user.wallet?.balance ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Days Completed</p>
                    <p className="text-2xl font-bold">
                      {user.wallet?.daysCompleted ?? 0} / {PAYMENT_AMOUNTS.DAYS_REQUIRED}
                    </p>
                  </div>
                </div>
                <div className="h-4 w-full rounded-full bg-secondary">
                  <div
                    className="h-4 rounded-full bg-primary transition-all"
                    style={{
                      width: `${((user.wallet?.daysCompleted ?? 0) / PAYMENT_AMOUNTS.DAYS_REQUIRED) * 100}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.payments && user.payments.length > 0 ? (
                <div className="space-y-2">
                  {user.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.type} - {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                      <Badge className={paymentStatusColors[payment.status]}>
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No payment history</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.policies && user.policies.length > 0 ? (
                <div className="space-y-2">
                  {user.policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{policy.policyNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {policy.type} - {formatDate(policy.startDate)} to {formatDate(policy.endDate)}
                        </p>
                      </div>
                      <Badge className={policyStatusColors[policy.status]}>
                        {policy.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No policies</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC Tab */}
        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                KYC Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.kycDocuments && user.kycDocuments.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {user.kycDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium capitalize">
                          {doc.type.replace(/_/g, ' ')}
                        </p>
                        <Badge className={kycStatusColors[doc.status]}>
                          {doc.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Uploaded: {formatDateTime(doc.createdAt)}
                      </p>
                      {doc.rejectionReason && (
                        <p className="mt-2 text-sm text-destructive">
                          Reason: {doc.rejectionReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No KYC documents</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
