import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  ChevronRight,
  Phone,
  Shield,
  Calendar,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { maskPhone, formatDate } from '@/lib/utils';
import { adminApi } from '@/services/api/admin.api';
import type { UserStatus, KycStatus, UserRole } from '@/types';

const statusVariants: Record<UserStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
  pending: 'outline',
};

const kycVariants: Record<KycStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
  expired: 'outline',
};

const roleLabels: Record<UserRole, string> = {
  rider: 'Rider',
  sacco_admin: 'SACCO Admin',
  kba_admin: 'KBA Admin',
  insurance_admin: 'Insurance Admin',
  platform_admin: 'Platform Admin',
};

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users', searchQuery, statusFilter, roleFilter, page],
    queryFn: () => adminApi.searchUsers({
      query: searchQuery || undefined,
      page,
      limit: 20,
    }),
    enabled: true,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  // Filter users client-side for status and role
  const filteredUsers = (data?.data ?? []).filter((user) => {
    if (statusFilter !== 'all' && user.status !== statusFilter) return false;
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Search and manage user accounts
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, name, ID, or policy number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="rider">Rider</SelectItem>
                  <SelectItem value="sacco_admin">SACCO Admin</SelectItem>
                  <SelectItem value="kba_admin">KBA Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">Search</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Failed to load users</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filteredUsers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Users Found</h3>
            <p className="mt-2 text-center text-muted-foreground">
              {searchQuery
                ? 'Try a different search term'
                : 'Enter a phone number, name, or ID to search'}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filteredUsers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredUsers.length} of {data?.meta.total ?? 0} users
            </p>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                        {user.firstName?.[0] ?? user.phone[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : maskPhone(user.phone)}
                          </p>
                          <Badge variant={statusVariants[user.status]}>
                            {user.status}
                          </Badge>
                          <Badge variant="outline">
                            {roleLabels[user.role]}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {maskPhone(user.phone)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            KYC: <Badge variant={kycVariants[user.kycStatus]} className="ml-1">{user.kycStatus}</Badge>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(user.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/admin/users/${user.id}`}>
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.meta.totalPages > 1 && (
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
                onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
