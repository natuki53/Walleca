import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import { AuthResult, LoginInput, RegisterInput, User } from '@/types/auth';

export const authApi = {
  register: async (input: RegisterInput): Promise<ApiResponse<AuthResult>> => {
    const response = await apiClient.post('/auth/register', input);
    return response.data;
  },

  login: async (input: LoginInput): Promise<ApiResponse<AuthResult>> => {
    const response = await apiClient.post('/auth/login', input);
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> => {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  logout: async (refreshToken: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/auth/logout', { refreshToken });
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
