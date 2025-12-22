import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Users,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Download,
  Search,
  ChevronRight,
  Edit,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { organizationsApi } from '@/services/api/organizations.api';
import { useAuthStore } from '@/stores/authStore';
import { maskPhone } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { MEMBERSHIP_STATUS_LABELS, MEMBERSHIP_ROLE_LABELS } from '@/config/constants';
import {
  ApproveMemberDialog,
  SuspendMemberDialog,
  ReactivateMemberDialog,
  RevokeMemberDialog,
  EditMemberRoleDialog,
  AddMemberDialog,
  CreateUserDialog,
} from './components/MemberActionDialogs';
import type { OrganizationType, OrganizationStatus, OrganizationMember } from '@/types';

const typeLabels: Record<OrganizationType, string> = {
  UMBRELLA_BODY: 'Umbrella Body',
  SACCO: 'SACCO',
  ASSOCIATION: 'Association',
  STAGE: 'Stage',
};

const statusColors: Record<OrganizationStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};

const memberStatusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  REVOKED: 'bg-gray-100 text-gray-800',
};

type MemberDialogType = 'approve' | 'suspend' | 'reactivate' | 'revoke' | 'editRole' | null;

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);

  // Member action dialogs
  const [memberDialogType, setMemberDialogType] = useState<MemberDialogType>(null);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);

  const isAdmin = user?.role === 'platform_admin';
  const isKbaAdmin = user?.role === 'kba_admin';
  const isSaccoAdmin = user?.role === 'sacco_admin';
  const canManage = isAdmin || isKbaAdmin || isSaccoAdmin;

  const openMemberDialog = (dialogType: MemberDialogType, member: OrganizationMember) => {
    setSelectedMember(member);
    setMemberDialogType(dialogType);
  };

  const closeMemberDialog = () => {
    setMemberDialogType(null);
    setSelectedMember(null);
  };

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationsApi.getOrganization(id!),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['organization', id, 'stats'],
    queryFn: () => organizationsApi.getStats(id!),
    enabled: !!id,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['organization', id, 'members', searchQuery, page],
    queryFn: () =>
      organizationsApi.getMembers({
        organizationId: id!,
        query: searchQuery || undefined,
        page,
      }),
    enabled: !!id,
  });

  const { data: children } = useQuery({
    queryKey: ['organization', id, 'children'],
    queryFn: () => organizationsApi.getChildren(id!),
    enabled: !!id && org?.type === 'UMBRELLA_BODY',
  });

  const verifyMutation = useMutation({
    mutationFn: () => organizationsApi.verifyOrganization(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: 'Organization Verified', description: 'The organization has been verified and activated.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to verify organization.' });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (reason?: string) => organizationsApi.suspendOrganization(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: 'Organization Suspended', description: 'The organization has been suspended.' });
      setShowSuspendDialog(false);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to suspend organization.' });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => organizationsApi.reactivateOrganization(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: 'Organization Reactivated', description: 'The organization has been reactivated.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reactivate organization.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => organizationsApi.deleteOrganization(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: 'Organization Deleted', description: 'The organization has been deleted.' });
      navigate('/organizations');
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete organization.' });
    },
  });

  const handleExport = async () => {
    try {
      const blob = await organizationsApi.exportMembers(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${org?.name ?? 'members'}-export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Export Complete', description: 'Members exported to CSV.' });
    } catch {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Failed to export members.' });
    }
  };

  if (orgLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Organization not found</p>
        <Button variant="outline" onClick={() => navigate('/organizations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Organizations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/organizations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{org.name}</h1>
                <Badge variant="outline">{org.code}</Badge>
              </div>
              <p className="text-muted-foreground">{typeLabels[org.type]}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[org.status]}>{org.status}</Badge>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/organizations/${id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Organization
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {org.status === 'PENDING' && (
                  <DropdownMenuItem onClick={() => verifyMutation.mutate()}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Verify & Activate
                  </DropdownMenuItem>
                )}
                {org.status === 'ACTIVE' && (
                  <DropdownMenuItem onClick={() => setShowSuspendDialog(true)}>
                    <XCircle className="mr-2 h-4 w-4 text-yellow-600" />
                    Suspend
                  </DropdownMenuItem>
                )}
                {(org.status === 'SUSPENDED' || org.status === 'INACTIVE') && (
                  <DropdownMenuItem onClick={() => reactivateMutation.mutate()}>
                    <RefreshCw className="mr-2 h-4 w-4 text-blue-600" />
                    Reactivate
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Organization
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalMembers?.toLocaleString() ?? org.estimatedMembers?.toLocaleString() ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verified Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {org.verifiedMembers?.toLocaleString() ?? stats?.activeMembers?.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {stats?.enrolledMembers?.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.complianceRate?.toFixed(1) ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{org.contactPhone ? maskPhone(org.contactPhone) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{org.contactEmail ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {org.subCounty
                  ? `${org.subCounty}${org.ward ? `, ${org.ward}` : ''}`
                  : org.address ?? 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{(org.estimatedMembers ?? org.memberCount)?.toLocaleString() ?? 0} estimated members</span>
            </div>
          </div>
          {org.description && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm text-muted-foreground">{org.description}</p>
            </div>
          )}
          {(org.leaderName || org.secretaryName || org.treasurerName) && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 font-medium">Leadership</h4>
              <div className="grid gap-2 text-sm md:grid-cols-3">
                {org.leaderName && (
                  <div>
                    <span className="text-muted-foreground">Chairman: </span>
                    {org.leaderName}
                  </div>
                )}
                {org.secretaryName && (
                  <div>
                    <span className="text-muted-foreground">Secretary: </span>
                    {org.secretaryName}
                  </div>
                )}
                {org.treasurerName && (
                  <div>
                    <span className="text-muted-foreground">Treasurer: </span>
                    {org.treasurerName}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Child Organizations (for Umbrella Bodies) */}
      {org.type === 'UMBRELLA_BODY' && children && children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Child Organizations
            </CardTitle>
            <CardDescription>
              {children.length} organization(s) under this umbrella body
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => navigate(`/organizations/${child.id}`)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{child.name}</p>
                        <Badge variant="outline" className="text-xs">{child.code}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {typeLabels[child.type]} • {(child.verifiedMembers ?? 0).toLocaleString()} verified members
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[child.status]}>{child.status}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
              <CardDescription>
                {members?.meta.total ?? 0} member(s)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {canManage && (
                <>
                  <Button onClick={() => setShowCreateUserDialog(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddMemberDialog(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    Add Existing
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Members Table */}
          {membersLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : members?.data && members.data.length > 0 ? (
            <div className="space-y-2">
              {members.data.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <button
                    onClick={() => navigate(`/users/${member.id}`)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.firstName || member.lastName || 'No name'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {maskPhone(member.phone)}
                          {member.membership.memberNumber && (
                            <span className="ml-2 text-xs">
                              #{member.membership.memberNumber}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge className={memberStatusColors[member.membership.status]}>
                      {MEMBERSHIP_STATUS_LABELS[member.membership.status] || member.membership.status}
                    </Badge>
                    <Badge variant="outline">
                      {MEMBERSHIP_ROLE_LABELS[member.membership.role] || member.membership.role}
                    </Badge>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.membership.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => openMemberDialog('approve', member)}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openMemberDialog('editRole', member)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Role
                          </DropdownMenuItem>
                          {member.membership.status === 'ACTIVE' && (
                            <DropdownMenuItem onClick={() => openMemberDialog('suspend', member)}>
                              <XCircle className="mr-2 h-4 w-4 text-yellow-600" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                          {member.membership.status === 'SUSPENDED' && (
                            <DropdownMenuItem onClick={() => openMemberDialog('reactivate', member)}>
                              <RefreshCw className="mr-2 h-4 w-4 text-blue-600" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openMemberDialog('revoke', member)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revoke Membership
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate(`/users/${member.id}`)}
                    >
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {members.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {members.meta.page} of {members.meta.totalPages}
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
                      disabled={page >= members.meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No members found</p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{org.name}</strong>? This action cannot be undone.
              All associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Confirmation Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-yellow-600" />
              Suspend Organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend <strong>{org.name}</strong>?
              Members will not be able to access services while suspended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendMutation.mutate('Administrative suspension')}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Member Action Dialogs */}
      <ApproveMemberDialog
        open={memberDialogType === 'approve'}
        onOpenChange={(open) => !open && closeMemberDialog()}
        member={selectedMember}
        organizationId={id!}
      />
      <SuspendMemberDialog
        open={memberDialogType === 'suspend'}
        onOpenChange={(open) => !open && closeMemberDialog()}
        member={selectedMember}
        organizationId={id!}
      />
      <ReactivateMemberDialog
        open={memberDialogType === 'reactivate'}
        onOpenChange={(open) => !open && closeMemberDialog()}
        member={selectedMember}
        organizationId={id!}
      />
      <RevokeMemberDialog
        open={memberDialogType === 'revoke'}
        onOpenChange={(open) => !open && closeMemberDialog()}
        member={selectedMember}
        organizationId={id!}
      />
      <EditMemberRoleDialog
        open={memberDialogType === 'editRole'}
        onOpenChange={(open) => !open && closeMemberDialog()}
        member={selectedMember}
        organizationId={id!}
      />
      <AddMemberDialog
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        organizationId={id!}
      />
      <CreateUserDialog
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        preSelectedOrganizationId={id}
        onSuccess={() => {
          // Refresh member list after user creation
          queryClient.invalidateQueries({ queryKey: ['organization', id, 'members'] });
        }}
      />
    </div>
  );
}
