import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';
import { PermissionError, ValidationError, isPermissionError, isValidationError } from '@/lib/errors';
import type { ApiError } from '@/types';

// Create axios instance
export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log requests in development
    if (env.isDevelopment) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - logout user
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Handle 403 Forbidden - permission denied (don't logout)
    // GAP-001: Provide clear permission-denied messaging
    if (error.response?.status === 403) {
      const apiError = error.response?.data as ApiError | undefined;
      const errorMessage = apiError?.error?.message
        || 'You do not have permission to perform this action';
      return Promise.reject(new PermissionError(errorMessage));
    }

    // Handle 400 Validation errors - extract field details
    // GAP-002: Extract validation field details for display
    if (error.response?.status === 400) {
      const apiError = error.response?.data as ApiError | undefined;
      if (apiError?.error?.details && apiError.error.details.length > 0) {
        return Promise.reject(new ValidationError(
          apiError.error.message || 'Validation failed',
          apiError.error.details
        ));
      }
    }

    // Log errors in development
    if (env.isDevelopment) {
      console.error('[API Error]', {
        status: error.response?.status,
        url: originalRequest?.url,
        error: error.response?.data?.error,
      });
    }

    return Promise.reject(error);
  }
);

// Helper to extract error message
export function getErrorMessage(error: unknown): string {
  // Handle PermissionError (403)
  if (isPermissionError(error)) {
    return error.message;
  }

  // Handle ValidationError (400 with details)
  if (isValidationError(error)) {
    return error.formatForDisplay();
  }

  // Handle Axios errors
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError | undefined;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    if (error.message) {
      return error.message;
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

// Export error types for use in components
export { PermissionError, ValidationError, isPermissionError, isValidationError };
