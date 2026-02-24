import { apiClient } from './http';
import type { LoginPayload, LoginResponse, RegisterPayload } from '../types/auth';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const response = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/login', payload);
    return response.data.data;
  },

  async googleLogin(idToken: string): Promise<LoginResponse> {
    const response = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/google-login', {
      idToken
    });
    return response.data.data;
  },

  async register(payload: RegisterPayload): Promise<{ message: string }> {
    const response = await apiClient.post<ApiEnvelope<{ user: unknown }>>('/auth/register', payload);
    return {
      message: response.data.message ?? 'Registration successful'
    };
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<ApiEnvelope<null>>('/auth/forgot-password', { email });
    return {
      message: response.data.message ?? 'If the email exists, a reset link has been sent.'
    };
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<ApiEnvelope<null>>('/auth/reset-password', {
      token,
      newPassword
    });
    return {
      message: response.data.message ?? 'Password has been reset successfully'
    };
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await apiClient.post<ApiEnvelope<null>>('/auth/verify-email', { token });
    return {
      message: response.data.message ?? 'Email verified successfully'
    };
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<ApiEnvelope<null>>('/auth/resend-verification', { email });
    return {
      message:
        response.data.message ??
        'If the account exists and is unverified, a verification email has been sent.'
    };
  },

  async me(): Promise<Pick<LoginResponse, 'user' | 'tenant'>> {
    const response = await apiClient.get<ApiEnvelope<Pick<LoginResponse, 'user' | 'tenant'>>>('/auth/me');
    return response.data.data;
  }
};
