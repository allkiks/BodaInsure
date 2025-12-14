import { apiClient } from './client';
import type { LoginRequest, LoginResponse, OtpVerifyRequest, OtpVerifyResponse } from '@/types';
import { API_ENDPOINTS } from '@/config/constants';

export const authApi = {
  /**
   * Initiate login with phone number
   * Sends OTP to the provided phone
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH_LOGIN, data);
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
