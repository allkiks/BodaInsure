import { apiClient } from './client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  OtpVerifyRequest,
  OtpVerifyResponse,
  AdminLoginRequest,
  AdminLoginResponse,
} from '@/types';
import { API_ENDPOINTS } from '@/config/constants';

export const authApi = {
  /**
   * Initiate login with phone number (for existing users)
   * Sends OTP to the provided phone
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH_LOGIN, data);
    return response.data;
  },

  /**
   * Register a new rider with organization
   * GAP-004: All riders must belong to a SACCO
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<{ data: RegisterResponse }>(API_ENDPOINTS.AUTH_REGISTER, data);
    return response.data.data;
  },

  /**
   * Admin login with username and password
   * For admin accounts only (PLATFORM_ADMIN, INSURANCE_ADMIN, KBA_ADMIN, SACCO_ADMIN)
   */
  adminLogin: async (data: AdminLoginRequest): Promise<AdminLoginResponse> => {
    const response = await apiClient.post<{ data: AdminLoginResponse }>(API_ENDPOINTS.AUTH_ADMIN_LOGIN, data);
    return response.data.data;
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
