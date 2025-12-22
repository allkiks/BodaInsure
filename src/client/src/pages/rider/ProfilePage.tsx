import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Phone,
  Mail,
  Globe,
  Shield,
  Trash2,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { userApi } from '@/services/api/user.api';
import { getErrorMessage } from '@/services/api/client';
import { maskPhone, maskNationalId, formatDate } from '@/lib/utils';
import type { Language } from '@/types';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [language, setLanguage] = useState<Language>(user?.language ?? 'en');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateProfile = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setUpdateSuccess(true);
      setUpdateError(null);
      setTimeout(() => setUpdateSuccess(false), 3000);
    },
    onError: (error) => {
      setUpdateError(getErrorMessage(error));
    },
  });

  const updateLanguage = useMutation({
    mutationFn: userApi.updateLanguage,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries();
    },
  });

  const requestDeletion = useMutation({
    mutationFn: userApi.requestAccountDeletion,
    onSuccess: () => {
      setShowDeleteDialog(false);
    },
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({ firstName, lastName, email });
  };

  const handleLanguageChange = (isSwahili: boolean) => {
    const newLang: Language = isSwahili ? 'sw' : 'en';
    setLanguage(newLang);
    updateLanguage.mutate(newLang);
  };

  const handleDeleteRequest = () => {
    if (!deleteReason.trim()) return;
    requestDeletion.mutate({ reason: deleteReason });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings
        </p>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {user.firstName?.[0] ?? user.phone[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : maskPhone(user.phone)}
            </h2>
            <p className="text-muted-foreground">{maskPhone(user.phone)}</p>
            <Badge variant="secondary" className="mt-1">
              {user.role === 'rider' ? 'Rider' : user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={maskPhone(user.phone)}
                disabled
                className="pl-10 bg-muted"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Phone number cannot be changed
            </p>
          </div>

          {user.nationalId && (
            <div className="space-y-2">
              <Label>National ID</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={maskNationalId(user.nationalId)}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
            </div>
          )}

          {updateSuccess && (
            <p className="text-sm text-green-600">Profile updated successfully!</p>
          )}
          {updateError && (
            <p className="text-sm text-destructive">{updateError}</p>
          )}

          <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Language Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Language Preference
          </CardTitle>
          <CardDescription>
            Choose your preferred language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Swahili</p>
              <p className="text-sm text-muted-foreground">
                Switch between English and Swahili
              </p>
            </div>
            <Switch
              checked={language === 'sw'}
              onCheckedChange={handleLanguageChange}
              disabled={updateLanguage.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* GAP-015: Use UPPERCASE status constants */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Account Status</span>
            <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {user.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">KYC Status</span>
            <Badge
              variant={
                user.kycStatus === 'APPROVED'
                  ? 'default'
                  : user.kycStatus === 'REJECTED'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {user.kycStatus}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Member Since</span>
            <span className="font-medium">{formatDate(user.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Request permanent deletion of your account and all data
              </p>
            </div>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Are you sure you want to delete your account? This action cannot be undone.
                Your data will be permanently deleted after a 30-day grace period.
              </p>
              <div className="space-y-2">
                <Label htmlFor="deleteReason">Please tell us why you're leaving</Label>
                <Input
                  id="deleteReason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Reason for deletion..."
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteReason.trim() || requestDeletion.isPending}
            >
              {requestDeletion.isPending ? 'Processing...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
