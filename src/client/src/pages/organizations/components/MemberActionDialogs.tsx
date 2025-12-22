import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  UserPlus,
  Edit,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { membershipsApi } from '@/services/api/memberships.api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/use-toast';
import { MEMBERSHIP_ROLES, MEMBERSHIP_ROLE_LABELS } from '@/config/constants';
import type { OrganizationMember, MembershipRole } from '@/types';

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: OrganizationMember | null;
  organizationId: string;
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

/**
 * Helper to get member display name
 */
function getMemberDisplayName(member: OrganizationMember | null): string {
  if (!member) return '';
  if (member.firstName && member.lastName) {
    return `${member.firstName} ${member.lastName}`;
  }
  return member.firstName || member.lastName || member.phone;
}

/**
 * Approve Member Dialog
 * Confirms approval of a pending membership
 */
export function ApproveMemberDialog({
  open,
  onOpenChange,
  member,
  organizationId,
}: MemberDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const approveMutation = useMutation({
    mutationFn: () =>
      membershipsApi.approveMembership(member!.membership.id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      toast({
        title: 'Member Approved',
        description: `${getMemberDisplayName(member)} has been approved.`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to approve member.',
      });
    },
  });

  if (!member) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approve Member
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to approve{' '}
            <strong>{getMemberDisplayName(member)}</strong>?
            They will become an active member of this organization.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Suspend Member Dialog
 * Suspends an active membership with an optional reason
 */
export function SuspendMemberDialog({
  open,
  onOpenChange,
  member,
  organizationId,
}: MemberDialogProps) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const suspendMutation = useMutation({
    mutationFn: () =>
      membershipsApi.suspendMembership(
        member!.membership.id,
        user!.id,
        reason ? { reason } : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      toast({
        title: 'Member Suspended',
        description: `${getMemberDisplayName(member)} has been suspended.`,
      });
      setReason('');
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to suspend member.',
      });
    },
  });

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-yellow-600" />
            Suspend Member
          </DialogTitle>
          <DialogDescription>
            Suspend <strong>{getMemberDisplayName(member)}</strong> from this organization.
            They will not have access to organization services while suspended.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for suspension..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => suspendMutation.mutate()}
            disabled={suspendMutation.isPending}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {suspendMutation.isPending ? 'Suspending...' : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reactivate Member Dialog
 * Reactivates a suspended membership
 */
export function ReactivateMemberDialog({
  open,
  onOpenChange,
  member,
  organizationId,
}: MemberDialogProps) {
  const queryClient = useQueryClient();

  const reactivateMutation = useMutation({
    mutationFn: () => membershipsApi.reactivateMembership(member!.membership.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      toast({
        title: 'Member Reactivated',
        description: `${getMemberDisplayName(member)} has been reactivated.`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to reactivate member.',
      });
    },
  });

  if (!member) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Reactivate Member
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reactivate{' '}
            <strong>{getMemberDisplayName(member)}</strong>?
            Their membership will be restored to active status.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => reactivateMutation.mutate()}
            disabled={reactivateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Revoke Member Dialog
 * Revokes a membership (soft delete)
 */
export function RevokeMemberDialog({
  open,
  onOpenChange,
  member,
  organizationId,
}: MemberDialogProps) {
  const queryClient = useQueryClient();

  const revokeMutation = useMutation({
    mutationFn: () => membershipsApi.revokeMembership(member!.membership.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      toast({
        title: 'Membership Revoked',
        description: `${getMemberDisplayName(member)}'s membership has been revoked.`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to revoke membership.',
      });
    },
  });

  if (!member) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Revoke Membership
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to revoke{' '}
            <strong>{getMemberDisplayName(member)}</strong>'s membership?
            This will remove them from the organization. This action cannot be easily undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {revokeMutation.isPending ? 'Revoking...' : 'Revoke Membership'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Edit Member Role Dialog
 * Changes a member's role in the organization
 */
export function EditMemberRoleDialog({
  open,
  onOpenChange,
  member,
  organizationId,
}: MemberDialogProps) {
  const [selectedRole, setSelectedRole] = useState<MembershipRole | ''>('');
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation({
    mutationFn: () =>
      membershipsApi.updateMembership(member!.membership.id, {
        role: selectedRole as MembershipRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      toast({
        title: 'Role Updated',
        description: `${getMemberDisplayName(member)}'s role has been updated to ${MEMBERSHIP_ROLE_LABELS[selectedRole]}.`,
      });
      setSelectedRole('');
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update member role.',
      });
    },
  });

  // Set initial role when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && member) {
      setSelectedRole(member.membership.role);
    } else {
      setSelectedRole('');
    }
    onOpenChange(isOpen);
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Edit Member Role
          </DialogTitle>
          <DialogDescription>
            Change the role for <strong>{getMemberDisplayName(member)}</strong> in this
            organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as MembershipRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MEMBERSHIP_ROLES).map(([key, value]) => (
                  <SelectItem key={key} value={value}>
                    {MEMBERSHIP_ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateRoleMutation.mutate()}
            disabled={
              updateRoleMutation.isPending ||
              !selectedRole ||
              selectedRole === member.membership.role
            }
          >
            {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export CreateUserDialog for convenience
export { CreateUserDialog } from '@/components/dialogs/CreateUserDialog';

/**
 * Add Member Dialog
 * Adds an existing user to the organization by phone number
 */
export function AddMemberDialog({ open, onOpenChange, organizationId }: AddMemberDialogProps) {
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<MembershipRole>(MEMBERSHIP_ROLES.MEMBER);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Search for user by phone (using admin endpoint)
  const searchUserMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      // Use admin API to search for user
      const response = await fetch(`/api/v1/admin/users/phone/${encodeURIComponent(phoneNumber)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found with this phone number');
        }
        throw new Error('Failed to search for user');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setUserId(data.data.id);
      setSearchError(null);
    },
    onError: (error: Error) => {
      setUserId(null);
      setSearchError(error.message);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      membershipsApi.createMembership({
        userId: userId!,
        organizationId,
        role: selectedRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'members'] });
      toast({
        title: 'Member Added',
        description: 'The member has been added to the organization.',
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add member.',
      });
    },
  });

  const resetForm = () => {
    setPhone('');
    setSelectedRole(MEMBERSHIP_ROLES.MEMBER);
    setUserId(null);
    setSearchError(null);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setUserId(null);
    setSearchError(null);
  };

  const handleSearch = () => {
    if (phone.trim()) {
      searchUserMutation.mutate(phone.trim());
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Member
          </DialogTitle>
          <DialogDescription>
            Add an existing user to this organization by their phone number.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSearch}
                disabled={!phone.trim() || searchUserMutation.isPending}
              >
                {searchUserMutation.isPending ? 'Searching...' : 'Search'}
              </Button>
            </div>
            {searchError && <p className="text-sm text-red-600">{searchError}</p>}
            {userId && (
              <p className="text-sm text-green-600">User found! Ready to add.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="addRole">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as MembershipRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MEMBERSHIP_ROLES).map(([key, value]) => (
                  <SelectItem key={key} value={value}>
                    {MEMBERSHIP_ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => addMemberMutation.mutate()}
            disabled={!userId || addMemberMutation.isPending}
          >
            {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
