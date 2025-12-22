import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Building2, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authApi } from '@/services/api/auth.api';
import { organizationsApi } from '@/services/api/organizations.api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/services/api/client';
import type { UserRole } from '@/types';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pre-selected organization ID (for SACCO_admin creating members)
   */
  preSelectedOrganizationId?: string;
  /**
   * Callback when user is successfully created
   */
  onSuccess?: (userId: string) => void;
}

// Role display names
const ROLE_LABELS: Record<UserRole, string> = {
  rider: 'Rider',
  sacco_admin: 'SACCO Admin',
  kba_admin: 'KBA Admin',
  insurance_admin: 'Insurance Admin',
  platform_admin: 'Platform Admin',
};

// Roles that each admin role can create
const ALLOWED_ROLES: Record<UserRole, UserRole[]> = {
  platform_admin: ['rider', 'sacco_admin', 'kba_admin', 'insurance_admin', 'platform_admin'],
  kba_admin: ['rider', 'sacco_admin'],
  sacco_admin: ['rider'],
  insurance_admin: [],
  rider: [],
};

/**
 * Create User Dialog
 * Creates a new user with role-based organization selection:
 * - SACCO_admin: Auto-populates with their organization, can only create riders
 * - KBA_admin: Shows only child SACCOs, can create riders and sacco_admins
 * - Platform_admin/SUPERUSER: Shows all organizations, can create any role
 */
export function CreateUserDialog({
  open,
  onOpenChange,
  preSelectedOrganizationId,
  onSuccess,
}: CreateUserDialogProps) {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();

  // Form state
  const [phone, setPhone] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('rider');
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [useDefaultPassword, setUseDefaultPassword] = useState(true); // Default to true since SMS often fails
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Determine which organizations to show based on current user's role
  const userRole = currentUser?.role;
  const userOrgId = currentUser?.organizationId;

  // Get allowed roles for current user
  const allowedRoles = userRole ? ALLOWED_ROLES[userRole] || [] : [];

  // Fetch organizations based on role
  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['organizations-for-user-creation', userRole, userOrgId],
    queryFn: async () => {
      if (!userRole) return [];

      // SACCO_admin: Only their own organization (auto-selected)
      if (userRole === 'sacco_admin') {
        if (!userOrgId) return [];
        const org = await organizationsApi.getOrganization(userOrgId);
        return [org];
      }

      // KBA_admin: Only child SACCOs of their umbrella body
      if (userRole === 'kba_admin') {
        if (!userOrgId) return [];
        return organizationsApi.getSaccosByParent(userOrgId);
      }

      // Platform_admin: All active SACCOs
      return organizationsApi.getSaccos();
    },
    enabled: open && !!userRole,
  });

  // Auto-select organization for SACCO_admin or when preSelectedOrganizationId is provided
  useEffect(() => {
    if (preSelectedOrganizationId) {
      setOrganizationId(preSelectedOrganizationId);
    } else if (userRole === 'sacco_admin' && organizations.length === 1 && organizations[0]) {
      setOrganizationId(organizations[0].id);
    }
  }, [preSelectedOrganizationId, userRole, organizations]);

  // Reset role when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRole('rider');
    }
  }, [open]);

  // Phone validation
  const validatePhone = (value: string): boolean => {
    if (!value) {
      setPhoneError('Phone number is required');
      return false;
    }
    if (value.length < 10) {
      setPhoneError('Phone number must be at least 10 digits');
      return false;
    }
    if (!/^(07|01|254)\d+$/.test(value)) {
      setPhoneError('Enter a valid Kenyan phone number');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  // Normalize phone to +254 format
  const normalizePhone = (value: string): string => {
    let normalized = value;
    if (normalized.startsWith('07') || normalized.startsWith('01')) {
      normalized = '254' + normalized.slice(1);
    }
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  };

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const normalizedPhone = normalizePhone(phone);
      return authApi.register({
        phone: normalizedPhone,
        organizationId,
        termsAccepted,
        role: selectedRole,
        useDefaultPassword,
      });
    },
    onSuccess: (response) => {
      if (response.status === 'SUCCESS') {
        const passwordNote = useDefaultPassword
          ? ' Default password: ChangeMe123!'
          : ' OTP sent to verify phone.';
        toast({
          title: 'User Created',
          description: `${ROLE_LABELS[selectedRole]} created with phone ${phone}.${passwordNote}`,
        });
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
        resetForm();
        onOpenChange(false);
        onSuccess?.(response.userId!);
      } else if (response.status === 'DUPLICATE') {
        toast({
          variant: 'destructive',
          title: 'User Already Exists',
          description: 'A user with this phone number already exists.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Registration Failed',
          description: response.message,
        });
      }
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(error),
      });
    },
  });

  const resetForm = () => {
    setPhone('');
    setOrganizationId(preSelectedOrganizationId || '');
    setSelectedRole('rider');
    setTermsAccepted(true);
    setUseDefaultPassword(true);
    setPhoneError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(phone)) return;
    if (!organizationId) {
      toast({
        variant: 'destructive',
        title: 'Organization Required',
        description: 'Please select an organization for the user.',
      });
      return;
    }
    createUserMutation.mutate();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  // Determine if organization selection should be shown
  const showOrgSelector = userRole !== 'sacco_admin' && !preSelectedOrganizationId;
  const isOrgAutoSelected = userRole === 'sacco_admin' || !!preSelectedOrganizationId;

  // Get organization name for display when auto-selected
  const autoSelectedOrgName = organizations.find((o) => o.id === organizationId)?.name;

  // Show role selector only if user can create multiple roles
  const showRoleSelector = allowedRoles.length > 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Create New User
          </DialogTitle>
          <DialogDescription>
            Create a new user account. {useDefaultPassword
              ? 'User will login with default password: ChangeMe123!'
              : 'An OTP will be sent to verify the phone number.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone Number</Label>
              <Input
                id="create-phone"
                type="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) validatePhone(e.target.value);
                }}
                disabled={createUserMutation.isPending}
              />
              {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
            </div>

            {/* Role Selection */}
            {showRoleSelector && (
              <div className="space-y-2">
                <Label htmlFor="create-role">
                  <Shield className="mr-1 inline h-4 w-4" />
                  User Role
                </Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as UserRole)}
                  disabled={createUserMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Organization Selection */}
            <div className="space-y-2">
              <Label htmlFor="create-org">
                <Building2 className="mr-1 inline h-4 w-4" />
                Organization {selectedRole === 'rider' ? '(SACCO)' : ''}
              </Label>

              {isLoadingOrgs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading organizations...
                </div>
              ) : isOrgAutoSelected ? (
                <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {autoSelectedOrgName || 'Organization selected'}
                </div>
              ) : showOrgSelector ? (
                <Select
                  value={organizationId}
                  onValueChange={setOrganizationId}
                  disabled={createUserMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {userRole === 'kba_admin' && (
                <p className="text-xs text-muted-foreground">
                  Showing SACCOs under your umbrella body only.
                </p>
              )}
            </div>

            {/* Use Default Password Checkbox */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="create-default-password"
                checked={useDefaultPassword}
                onCheckedChange={(checked) => setUseDefaultPassword(checked === true)}
                disabled={createUserMutation.isPending}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="create-default-password"
                  className="text-sm font-medium leading-none"
                >
                  Use default password (ChangeMe123!)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Skip OTP verification. User can login immediately with the default password.
                </p>
              </div>
            </div>

            {/* Terms Acceptance (informational for admin-created users) */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="create-terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                disabled={createUserMutation.isPending}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="create-terms"
                  className="text-sm font-medium leading-none"
                >
                  Terms accepted on behalf of user
                </Label>
                <p className="text-xs text-muted-foreground">
                  The user will be asked to confirm terms on first login.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createUserMutation.isPending || isLoadingOrgs || !organizationId}
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
