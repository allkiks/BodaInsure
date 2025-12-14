import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/constants';
import type { RegisterRequest, RegisterResponse, OtpVerifyRequest, OtpVerifyResponse } from '@/types';

export const authApi = {
  /**
   * Register a new user or login existing user
   * Sends OTP to the provided phone
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>(API_ENDPOINTS.AUTH_REGISTER, data);
    return response.data;
  },

  /**
   * Login with existing phone number
   * Sends OTP to the provided phone
   */
  login: async (phone: string): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>(API_ENDPOINTS.AUTH_LOGIN, { phone });
    return response.data;
  },

  /**
   * Verify OTP and get JWT token
   */
  verifyOtp: async (data: OtpVerifyRequest): Promise<OtpVerifyResponse> => {
    const response = await apiClient.post<OtpVerifyResponse>(API_ENDPOINTS.AUTH_VERIFY_OTP, data);
    return response.data;
  },

  /**
   * Refresh JWT token
   */
  refreshToken: async (): Promise<{ token: string; expiresAt: string }> => {
    const response = await apiClient.post<{ token: string; expiresAt: string }>(
      API_ENDPOINTS.AUTH_REFRESH
    );
    return response.data;
  },

  /**
   * Logout and invalidate session
   */
  logout: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT);
  },
};
