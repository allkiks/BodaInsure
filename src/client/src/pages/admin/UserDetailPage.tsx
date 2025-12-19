import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Phone,
  Mail,
  Shield,
  Wallet,
  CreditCard,
  FileText,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Ban,
  UserCheck,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { maskPhone, maskNationalId, formatDate, formatCurrency } from '@/lib/utils';
import { adminApi } from '@/services/api/admin.api';
import { paymentApi } from '@/services/api/payment.api';
import { PAYMENT_AMOUNTS } from '@/config/constants';
import type { UserStatus, KycStatus, PaymentStatus, PolicyStatus } from '@/types';

const statusConfig: Record<UserStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { variant: 'default' },
  inactive: { variant: 'secondary' },
  suspended: { variant: 'destructive' },
  pending: { variant: 'outline' },
};

const kycConfig: Record<KycStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  approved: { variant: 'default', icon: <CheckCircle className="h-4 w-4" /> },
  pending: { variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
  rejected: { variant: 'destructive', icon: <XCircle className="h-4 w-4" /> },
  expired: { variant: 'outline', icon: <AlertCircle className="h-4 w-4" /> },
};

const paymentStatusConfig: Record<PaymentStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { variant: 'default' },
  pending: { variant: 'secondary' },
  failed: { variant: 'destructive' },
  cancelled: { variant: 'outline' },
};

const policyStatusConfig: Record<PolicyStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { variant: 'default' },
  pending: { variant: 'secondary' },
  expired: { variant: 'outline' },
  cancelled: { variant: 'destructive' },
  lapsed: { variant: 'destructive' },
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [actionDialog, setActionDialog] = useState<{
    type: 'activate' | 'deactivate' | 'resetKyc' | 'resendOtp' | null;
    open: boolean;
  }>({ type: null, open: false });

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminApi.getUserById(id!),
    enabled: !!id,
  });

  const activateUser = useMutation({
    mutationFn: () => adminApi.activateUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      setActionDialog({ type: null, open: false });
    },
  });

  const deactivateUser = useMutation({
    mutationFn: () => adminApi.deactivateUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      setActionDialog({ type: null, open: false });
    },
  });

  const resetKyc = useMutation({
    mutationFn: () => adminApi.resetKyc(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      setActionDialog({ type: null, open: false });
    },
  });

  const resendOtp = useMutation({
    mutationFn: () => adminApi.resendOtp(id!),
    onSuccess: () => {
      setActionDialog({ type: null, open: false });
    },
  });

  const handleAction = () => {
    switch (actionDialog.type) {
      case 'activate':
        activateUser.mutate();
        break;
      case 'deactivate':
        deactivateUser.mutate();
        break;
      case 'resetKyc':
        resetKyc.mutate();
        break;
      case 'resendOtp':
        resendOtp.mutate();
        break;
    }
  };

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
        <Button variant="outline" onClick={() => navigate('/admin/users')}>
          Back to Users
        </Button>
      </div>
    );
  }

  const wallet = user.wallet ?? { balance: 0, daysCompleted: 0 };
  const policies = user.policies ?? [];
  const payments = user.payments ?? [];
  const kycDocuments = user.kycDocuments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : maskPhone(user.phone)}
          </h1>
          <p className="text-muted-foreground">User ID: {user.id}</p>
        </div>
        <div className="flex gap-2">
          {user.status === 'active' ? (
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: 'deactivate', open: true })}
            >
              <Ban className="mr-2 h-4 w-4" />
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: 'activate', open: true })}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Activate
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setActionDialog({ type: 'resendOtp', open: true })}
          >
            <Send className="mr-2 h-4 w-4" />
            Resend OTP
          </Button>
        </div>
      </div>

      {/* User Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={statusConfig[user.status].variant} className="text-base">
              {user.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">KYC Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={kycConfig[user.kycStatus].variant} className="gap-1 text-base">
              {kycConfig[user.kycStatus].icon}
              {user.kycStatus}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(wallet.balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Days Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {wallet.daysCompleted} / {PAYMENT_AMOUNTS.DAYS_REQUIRED}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed information */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="policies">Policies ({policies.length})</TabsTrigger>
          <TabsTrigger value="kyc">KYC Documents ({kycDocuments.length})</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="flex items-center gap-2 font-medium">
                  <Phone className="h-4 w-4" />
                  {user.phone}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" />
                  {user.email ?? 'Not provided'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">National ID</p>
                <p className="flex items-center gap-2 font-medium">
                  <Shield className="h-4 w-4" />
                  {user.nationalId ? maskNationalId(user.nationalId) : 'Not provided'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {user.dateOfBirth ? formatDate(user.dateOfBirth) : 'Not provided'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Language</p>
                <p className="font-medium">{user.language === 'sw' ? 'Swahili' : 'English'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>Perform administrative actions on this user</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setActionDialog({ type: 'resetKyc', open: true })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset KYC
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No payments found</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium capitalize">{payment.type} Payment</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payment.createdAt)}
                          {payment.mpesaRef && ` • Ref: ${payment.mpesaRef}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <Badge variant={paymentStatusConfig[payment.status].variant}>
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No policies found</p>
              ) : (
                <div className="space-y-3">
                  {policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{policy.policyNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(policy.startDate)} - {formatDate(policy.endDate)}
                          {' • '}
                          <span className="capitalize">{policy.type}</span>
                        </p>
                      </div>
                      <Badge variant={policyStatusConfig[policy.status].variant}>
                        {policy.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC Tab */}
        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                KYC Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kycDocuments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No documents uploaded</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {kycDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium capitalize">
                          {doc.type.replace(/_/g, ' ')}
                        </p>
                        <Badge variant={kycConfig[doc.status].variant} className="gap-1">
                          {kycConfig[doc.status].icon}
                          {doc.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Uploaded: {formatDate(doc.createdAt)}
                      </p>
                      {doc.rejectionReason && (
                        <p className="mt-2 text-sm text-destructive">
                          Rejection reason: {doc.rejectionReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Confirmation Dialog */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === 'activate' && 'Activate User'}
              {actionDialog.type === 'deactivate' && 'Deactivate User'}
              {actionDialog.type === 'resetKyc' && 'Reset KYC'}
              {actionDialog.type === 'resendOtp' && 'Resend OTP'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === 'activate' &&
                'Are you sure you want to activate this user account?'}
              {actionDialog.type === 'deactivate' &&
                'Are you sure you want to deactivate this user account? They will not be able to log in.'}
              {actionDialog.type === 'resetKyc' &&
                'Are you sure you want to reset this user\'s KYC status? They will need to re-upload their documents.'}
              {actionDialog.type === 'resendOtp' &&
                'Are you sure you want to send a new OTP to this user?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
