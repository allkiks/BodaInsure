import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  FileText,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { auditApi, AuditEvent } from '@/services/api/audit.api';
import { formatDateTime } from '@/lib/utils';

const outcomeColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failure: 'bg-red-100 text-red-800',
};

const eventTypeCategories: Record<string, string[]> = {
  Authentication: ['USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'OTP_REQUESTED', 'OTP_VERIFIED', 'OTP_FAILED'],
  KYC: ['KYC_DOCUMENT_UPLOADED', 'KYC_APPROVED', 'KYC_REJECTED'],
  Payment: ['PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'REFUND_INITIATED', 'REFUND_COMPLETED'],
  Policy: ['POLICY_CREATED', 'POLICY_ACTIVATED', 'POLICY_RENEWED', 'POLICY_CANCELLED', 'POLICY_LAPSED', 'POLICY_DOCUMENT_GENERATED'],
  Organization: ['ORGANIZATION_CREATED', 'ORGANIZATION_VERIFIED', 'ORGANIZATION_SUSPENDED', 'MEMBER_ADDED', 'MEMBER_REMOVED'],
  Admin: ['ADMIN_USER_SEARCH', 'ADMIN_USER_UPDATE', 'ADMIN_KYC_OVERRIDE', 'ADMIN_POLICY_OVERRIDE'],
  Accounting: [
    'JOURNAL_ENTRY_CREATED', 'JOURNAL_ENTRY_POSTED', 'JOURNAL_ENTRY_REVERSED',
    'SETTLEMENT_CREATED', 'SETTLEMENT_APPROVED', 'SETTLEMENT_PROCESSED', 'SETTLEMENT_CANCELLED',
    'RECONCILIATION_CREATED', 'RECONCILIATION_ITEM_MATCHED', 'RECONCILIATION_ITEM_RESOLVED',
    'REMITTANCE_BATCH_CREATED', 'REMITTANCE_BATCH_APPROVED', 'REMITTANCE_BATCH_PROCESSED',
    'FINANCIAL_REPORT_GENERATED',
  ],
  System: ['SYSTEM_ERROR', 'BATCH_STARTED', 'BATCH_COMPLETED', 'DATA_EXPORT'],
};

const getEventCategory = (eventType: string): string => {
  for (const [category, types] of Object.entries(eventTypeCategories)) {
    if (types.includes(eventType)) return category;
  }
  return 'Other';
};

const categoryColors: Record<string, string> = {
  Authentication: 'bg-blue-100 text-blue-800',
  KYC: 'bg-purple-100 text-purple-800',
  Payment: 'bg-green-100 text-green-800',
  Policy: 'bg-indigo-100 text-indigo-800',
  Organization: 'bg-yellow-100 text-yellow-800',
  Admin: 'bg-red-100 text-red-800',
  Accounting: 'bg-cyan-100 text-cyan-800',
  System: 'bg-gray-100 text-gray-800',
  Other: 'bg-gray-100 text-gray-800',
};

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    eventType: '',
    userId: '',
    entityType: '',
    outcome: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const limit = 25;

  const { data: eventTypes } = useQuery({
    queryKey: ['audit', 'event-types'],
    queryFn: () => auditApi.getEventTypes(),
  });

  const { data: stats } = useQuery({
    queryKey: ['audit', 'stats'],
    queryFn: () => auditApi.getStats(7),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit', 'events', filters, page],
    queryFn: () => auditApi.queryEvents({
      ...filters,
      eventType: filters.eventType || undefined,
      userId: filters.userId || undefined,
      entityType: filters.entityType || undefined,
      outcome: (filters.outcome as 'success' | 'failure') || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page,
      limit,
    }),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      eventType: '',
      userId: '',
      entityType: '',
      outcome: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            System activity and compliance monitoring
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Events (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {(stats.eventsByOutcome?.success || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {(stats.eventsByOutcome?.failure || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unique Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.topUsers?.length || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label>Event Type</Label>
              <Select
                value={filters.eventType}
                onValueChange={(v) => handleFilterChange('eventType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {eventTypes?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>User ID</Label>
              <Input
                placeholder="Enter user ID..."
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              />
            </div>
            <div>
              <Label>Entity Type</Label>
              <Select
                value={filters.entityType}
                onValueChange={(v) => handleFilterChange('entityType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All entities</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="settlement">Settlement</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome</Label>
              <Select
                value={filters.outcome}
                onValueChange={(v) => handleFilterChange('outcome', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All outcomes</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Audit Events
          </CardTitle>
          <CardDescription>
            {data?.total.toLocaleString() || 0} events found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Failed to load audit events
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Channel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.events.map((event) => {
                    const category = getEventCategory(event.eventType);
                    return (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <TableCell className="font-mono text-sm">
                          {formatDateTime(event.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm">
                            {event.eventType.replace(/_/g, ' ')}
                          </span>
                          {event.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {event.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={categoryColors[category]}>
                            {category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {event.userId ? (
                            <span className="font-mono text-xs">
                              {event.userId.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.entityType ? (
                            <span className="text-sm">
                              {event.entityType}
                              {event.entityId && (
                                <span className="font-mono text-xs text-muted-foreground ml-1">
                                  ({event.entityId.substring(0, 8)}...)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={outcomeColors[event.outcome] || 'bg-gray-100'}>
                            {event.outcome === 'success' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {event.outcome}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.channel || 'api'}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Event Details
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.eventType.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Event ID</Label>
                  <p className="font-mono text-sm">{selectedEvent.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Timestamp</Label>
                  <p>{formatDateTime(selectedEvent.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Event Type</Label>
                  <Badge className={categoryColors[getEventCategory(selectedEvent.eventType)]}>
                    {selectedEvent.eventType.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Outcome</Label>
                  <Badge className={outcomeColors[selectedEvent.outcome]}>
                    {selectedEvent.outcome}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="font-mono text-sm">{selectedEvent.userId || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Actor ID</Label>
                  <p className="font-mono text-sm">{selectedEvent.actorId || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <p>{selectedEvent.entityType || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity ID</Label>
                  <p className="font-mono text-sm">{selectedEvent.entityId || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Channel</Label>
                  <p>{selectedEvent.channel || '-'}</p>
                </div>
              </div>
              {selectedEvent.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedEvent.description}</p>
                </div>
              )}
              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Details</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-auto max-h-48">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
