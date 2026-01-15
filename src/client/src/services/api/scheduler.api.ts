import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';

/**
 * Job status enum
 */
export type JobStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';

/**
 * Job type enum
 */
export type JobType =
  | 'DAILY_SERVICE_FEE_SETTLEMENT'
  | 'MONTHLY_COMMISSION_SETTLEMENT'
  | 'DAILY_MPESA_RECONCILIATION'
  | 'REMITTANCE_BATCH_PROCESSING'
  | 'POLICY_EXPIRY_CHECK'
  | 'PAYMENT_REMINDER'
  | 'CUSTOM';

/**
 * Scheduler job interface
 */
export interface SchedulerJob {
  id: string;
  name: string;
  type: JobType;
  status: JobStatus;
  cronExpression?: string;
  isRecurring: boolean;
  isEnabled: boolean;
  scheduledAt: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunDuration?: number;
  maxRetries: number;
  retryCount: number;
  config?: Record<string, unknown>;
  result?: {
    processed?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    details?: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Job execution history entry
 */
export interface JobHistoryEntry {
  id: string;
  jobId: string;
  jobName: string;
  jobType: JobType;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  result?: {
    processed?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    details?: unknown;
  };
  error?: string;
}

/**
 * Scheduler status
 */
export interface SchedulerStatus {
  isRunning: boolean;
  lastCheckAt?: string;
  nextCheckAt?: string;
  intervalMs: number;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  totalJobs: number;
  scheduledJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  pausedJobs: number;
  recurringJobs: number;
  oneTimeJobs: number;
}

export const schedulerApi = {
  /**
   * Get scheduler status
   */
  getStatus: async (): Promise<SchedulerStatus> => {
    const response = await apiClient.get<{ data: SchedulerStatus }>(
      API_ENDPOINTS.SCHEDULER_STATUS
    );
    return response.data.data;
  },

  /**
   * Get scheduler statistics
   */
  getStats: async (): Promise<SchedulerStats> => {
    const response = await apiClient.get<{ data: SchedulerStats }>(
      API_ENDPOINTS.SCHEDULER_STATS
    );
    return response.data.data;
  },

  /**
   * Get all jobs
   */
  getJobs: async (params?: {
    status?: JobStatus;
    type?: JobType;
    isRecurring?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ jobs: SchedulerJob[]; total: number; page: number; limit: number }> => {
    const response = await apiClient.get<{
      data: { jobs: SchedulerJob[]; total: number; page: number; limit: number };
    }>(API_ENDPOINTS.SCHEDULER_JOBS, { params });
    return response.data.data;
  },

  /**
   * Get job by ID
   */
  getJob: async (jobId: string): Promise<SchedulerJob> => {
    const response = await apiClient.get<{ data: SchedulerJob }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS}/${jobId}`
    );
    return response.data.data;
  },

  /**
   * Trigger a job manually
   */
  triggerJob: async (jobId: string): Promise<SchedulerJob> => {
    const response = await apiClient.post<{ data: SchedulerJob }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS}/${jobId}/trigger`
    );
    return response.data.data;
  },

  /**
   * Pause a job
   */
  pauseJob: async (jobId: string): Promise<SchedulerJob> => {
    const response = await apiClient.put<{ data: SchedulerJob }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS}/${jobId}/pause`
    );
    return response.data.data;
  },

  /**
   * Resume a job
   */
  resumeJob: async (jobId: string): Promise<SchedulerJob> => {
    const response = await apiClient.put<{ data: SchedulerJob }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS}/${jobId}/resume`
    );
    return response.data.data;
  },

  /**
   * Cancel a job
   */
  cancelJob: async (jobId: string): Promise<SchedulerJob> => {
    const response = await apiClient.put<{ data: SchedulerJob }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS}/${jobId}/cancel`
    );
    return response.data.data;
  },

  /**
   * Get job execution history
   */
  getJobHistory: async (
    jobId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ history: JobHistoryEntry[]; total: number }> => {
    const response = await apiClient.get<{
      data: { history: JobHistoryEntry[]; total: number };
    }>(`${API_ENDPOINTS.SCHEDULER_JOBS}/${jobId}/history`, { params });
    return response.data.data;
  },

  /**
   * Get recent execution history (all jobs)
   */
  getRecentHistory: async (params?: {
    page?: number;
    limit?: number;
    hours?: number;
  }): Promise<{ history: JobHistoryEntry[]; total: number }> => {
    const response = await apiClient.get<{
      data: { history: JobHistoryEntry[]; total: number };
    }>(API_ENDPOINTS.SCHEDULER_HISTORY, { params });
    return response.data.data;
  },

  /**
   * Seed default jobs
   */
  seedJobs: async (): Promise<{ message: string; jobsCreated: number }> => {
    const response = await apiClient.post<{
      data: { message: string; jobsCreated: number };
    }>(`${API_ENDPOINTS.SCHEDULER_JOBS.replace('/jobs', '')}/seed`);
    return response.data.data;
  },

  /**
   * Start the scheduler
   */
  startScheduler: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<{ data: { message: string } }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS.replace('/jobs', '')}/start`
    );
    return response.data.data;
  },

  /**
   * Stop the scheduler
   */
  stopScheduler: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<{ data: { message: string } }>(
      `${API_ENDPOINTS.SCHEDULER_JOBS.replace('/jobs', '')}/stop`
    );
    return response.data.data;
  },
};
