import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Play,
  Pause,
  StopCircle,
  Clock,
  Calendar,
  RefreshCw,
  Settings,
  History,
  Zap,
  Power,
  PowerOff,
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
import { schedulerApi, SchedulerJob, JobStatus, JobType } from '@/services/api/scheduler.api';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const statusColors: Record<JobStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  RUNNING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  PAUSED: 'bg-orange-100 text-orange-800',
};

const typeLabels: Record<JobType, string> = {
  DAILY_SERVICE_FEE_SETTLEMENT: 'Daily Service Fee Settlement',
  MONTHLY_COMMISSION_SETTLEMENT: 'Monthly Commission Settlement',
  DAILY_MPESA_RECONCILIATION: 'Daily M-Pesa Reconciliation',
  REMITTANCE_BATCH_PROCESSING: 'Remittance Batch Processing',
  POLICY_EXPIRY_CHECK: 'Policy Expiry Check',
  PAYMENT_REMINDER: 'Payment Reminder',
  CUSTOM: 'Custom Job',
};

const StatusIcon = ({ status }: { status: JobStatus }) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'RUNNING':
      return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
    case 'PAUSED':
      return <Pause className="h-4 w-4 text-orange-500" />;
    case 'CANCELLED':
      return <StopCircle className="h-4 w-4 text-gray-500" />;
    default:
      return <Clock className="h-4 w-4 text-blue-500" />;
  }
};

export default function SchedulerPage() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<SchedulerJob | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'pause' | 'resume' | 'cancel' | 'trigger' | 'start' | 'stop' | 'seed';
    jobId?: string;
    jobName?: string;
  }>({ open: false, action: 'trigger' });

  // Queries
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['scheduler', 'status'],
    queryFn: () => schedulerApi.getStatus(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: stats } = useQuery({
    queryKey: ['scheduler', 'stats'],
    queryFn: () => schedulerApi.getStats(),
    refetchInterval: 10000,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['scheduler', 'jobs'],
    queryFn: () => schedulerApi.getJobs(),
    refetchInterval: 10000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['scheduler', 'history'],
    queryFn: () => schedulerApi.getRecentHistory({ limit: 10 }),
    refetchInterval: 30000,
  });

  // Mutations
  const triggerMutation = useMutation({
    mutationFn: (jobId: string) => schedulerApi.triggerJob(jobId),
    onSuccess: () => {
      toast({ title: 'Job triggered successfully' });
      queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
    onError: () => toast({ title: 'Failed to trigger job', variant: 'destructive' }),
  });

  const pauseMutation = useMutation({
    mutationFn: (jobId: string) => schedulerApi.pauseJob(jobId),
    onSuccess: () => {
      toast({ title: 'Job paused' });
      queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
    onError: () => toast({ title: 'Failed to pause job', variant: 'destructive' }),
  });

  const resumeMutation = useMutation({
    mutationFn: (jobId: string) => schedulerApi.resumeJob(jobId),
    onSuccess: () => {
      toast({ title: 'Job resumed' });
      queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
    onError: () => toast({ title: 'Failed to resume job', variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => schedulerApi.cancelJob(jobId),
    onSuccess: () => {
      toast({ title: 'Job cancelled' });
      queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
    onError: () => toast({ title: 'Failed to cancel job', variant: 'destructive' }),
  });

  const startSchedulerMutation = useMutation({
    mutationFn: () => schedulerApi.startScheduler(),
    onSuccess: () => {
      toast({ title: 'Scheduler started' });
      refetchStatus();
    },
    onError: () => toast({ title: 'Failed to start scheduler', variant: 'destructive' }),
  });

  const stopSchedulerMutation = useMutation({
    mutationFn: () => schedulerApi.stopScheduler(),
    onSuccess: () => {
      toast({ title: 'Scheduler stopped' });
      refetchStatus();
    },
    onError: () => toast({ title: 'Failed to stop scheduler', variant: 'destructive' }),
  });

  const seedJobsMutation = useMutation({
    mutationFn: () => schedulerApi.seedJobs(),
    onSuccess: (data) => {
      toast({ title: `Created ${data.jobsCreated} jobs` });
      queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    },
    onError: () => toast({ title: 'Failed to seed jobs', variant: 'destructive' }),
  });

  const handleConfirm = () => {
    const { action, jobId } = confirmDialog;
    switch (action) {
      case 'trigger':
        if (jobId) triggerMutation.mutate(jobId);
        break;
      case 'pause':
        if (jobId) pauseMutation.mutate(jobId);
        break;
      case 'resume':
        if (jobId) resumeMutation.mutate(jobId);
        break;
      case 'cancel':
        if (jobId) cancelMutation.mutate(jobId);
        break;
      case 'start':
        startSchedulerMutation.mutate();
        break;
      case 'stop':
        stopSchedulerMutation.mutate();
        break;
      case 'seed':
        seedJobsMutation.mutate();
        break;
    }
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduler Management</h1>
          <p className="text-muted-foreground">
            Manage scheduled jobs and batch processing
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmDialog({ open: true, action: 'seed' })}
          >
            <Settings className="h-4 w-4 mr-2" />
            Seed Jobs
          </Button>
          {status?.isRunning ? (
            <Button
              variant="destructive"
              onClick={() => setConfirmDialog({ open: true, action: 'stop' })}
            >
              <PowerOff className="h-4 w-4 mr-2" />
              Stop Scheduler
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmDialog({ open: true, action: 'start' })}
            >
              <Power className="h-4 w-4 mr-2" />
              Start Scheduler
            </Button>
          )}
        </div>
      </div>

      {/* Status and Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scheduler Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.isRunning ? (
                <>
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-lg font-semibold text-green-600">Running</span>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 bg-gray-400 rounded-full" />
                  <span className="text-lg font-semibold text-gray-600">Stopped</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalJobs || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-yellow-500" />
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats?.runningJobs || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats?.completedJobs || 0}</p>
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
            <p className="text-2xl font-bold text-red-600">{stats?.failedJobs || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            {jobsData?.total || 0} jobs configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobsData?.jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedJob(job)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={job.status} />
                        <span className="font-medium">{job.name}</span>
                        {job.isRecurring && (
                          <Badge variant="outline" className="text-xs">
                            Recurring
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {typeLabels[job.type] || job.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[job.status]}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {job.cronExpression ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {job.cronExpression}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">One-time</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.lastRunAt ? (
                        <div>
                          <div className="text-sm">{formatDateTime(job.lastRunAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            Duration: {formatDuration(job.lastRunDuration)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.nextRunAt ? (
                        <span className="text-sm">{formatDateTime(job.nextRunAt)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDialog({
                            open: true,
                            action: 'trigger',
                            jobId: job.id,
                            jobName: job.name,
                          })}
                          disabled={job.status === 'RUNNING'}
                        >
                          <Zap className="h-4 w-4" />
                        </Button>
                        {job.status === 'PAUSED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDialog({
                              open: true,
                              action: 'resume',
                              jobId: job.id,
                              jobName: job.name,
                            })}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDialog({
                              open: true,
                              action: 'pause',
                              jobId: job.id,
                              jobName: job.name,
                            })}
                            disabled={job.status !== 'SCHEDULED'}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDialog({
                            open: true,
                            action: 'cancel',
                            jobId: job.id,
                            jobName: job.name,
                          })}
                          disabled={job.status === 'COMPLETED' || job.status === 'CANCELLED'}
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!jobsData?.jobs || jobsData.jobs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No jobs configured. Click "Seed Jobs" to create default jobs.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Execution History
          </CardTitle>
          <CardDescription>
            Last 10 job executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData?.history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.jobName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {typeLabels[entry.jobType] || entry.jobType}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          entry.status === 'SUCCESS'
                            ? 'bg-green-100 text-green-800'
                            : entry.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {entry.status === 'SUCCESS' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {entry.status === 'FAILED' && <XCircle className="h-3 w-3 mr-1" />}
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(entry.startedAt)}</TableCell>
                    <TableCell>{formatDuration(entry.duration)}</TableCell>
                    <TableCell>
                      {entry.result ? (
                        <span className="text-sm">
                          {entry.result.succeeded || 0} succeeded, {entry.result.failed || 0} failed
                        </span>
                      ) : entry.error ? (
                        <span className="text-sm text-red-600 truncate max-w-[200px]" title={entry.error}>
                          {entry.error}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!historyData?.history || historyData.history.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No execution history yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Job Details
            </DialogTitle>
            <DialogDescription>
              {selectedJob?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Job ID</label>
                  <p className="font-mono text-sm">{selectedJob.id}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <p>{typeLabels[selectedJob.type] || selectedJob.type}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <Badge className={statusColors[selectedJob.status]}>
                    {selectedJob.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Recurring</label>
                  <p>{selectedJob.isRecurring ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Cron Expression</label>
                  <p className="font-mono text-sm">{selectedJob.cronExpression || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Enabled</label>
                  <p>{selectedJob.isEnabled ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Retry Count</label>
                  <p>{selectedJob.retryCount} / {selectedJob.maxRetries}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Last Run Duration</label>
                  <p>{formatDuration(selectedJob.lastRunDuration)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Scheduled At</label>
                  <p>{formatDateTime(selectedJob.scheduledAt)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Next Run At</label>
                  <p>{selectedJob.nextRunAt ? formatDateTime(selectedJob.nextRunAt) : '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Last Run At</label>
                  <p>{selectedJob.lastRunAt ? formatDateTime(selectedJob.lastRunAt) : 'Never'}</p>
                </div>
              </div>
              {selectedJob.result && Object.keys(selectedJob.result).length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground">Last Result</label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-auto max-h-48">
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </div>
              )}
              {selectedJob.config && Object.keys(selectedJob.config).length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground">Configuration</label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-auto max-h-48">
                    {JSON.stringify(selectedJob.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'start' && 'Start Scheduler'}
              {confirmDialog.action === 'stop' && 'Stop Scheduler'}
              {confirmDialog.action === 'seed' && 'Seed Default Jobs'}
              {confirmDialog.action === 'trigger' && `Trigger Job: ${confirmDialog.jobName}`}
              {confirmDialog.action === 'pause' && `Pause Job: ${confirmDialog.jobName}`}
              {confirmDialog.action === 'resume' && `Resume Job: ${confirmDialog.jobName}`}
              {confirmDialog.action === 'cancel' && `Cancel Job: ${confirmDialog.jobName}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'start' && 'This will start the scheduler and begin processing scheduled jobs.'}
              {confirmDialog.action === 'stop' && 'This will stop the scheduler. Running jobs will complete but no new jobs will be started.'}
              {confirmDialog.action === 'seed' && 'This will create the default scheduled jobs for settlements, reconciliation, and remittances.'}
              {confirmDialog.action === 'trigger' && 'This will immediately execute the job regardless of its schedule.'}
              {confirmDialog.action === 'pause' && 'This will pause the job. It will not run until resumed.'}
              {confirmDialog.action === 'resume' && 'This will resume the paused job.'}
              {confirmDialog.action === 'cancel' && 'This will cancel the job. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmDialog.action === 'cancel' ? 'Yes, Cancel Job' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
