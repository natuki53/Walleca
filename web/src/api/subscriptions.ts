import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import {
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionFilters,
  SubscriptionSummary,
} from '@/types/subscription';

export const subscriptionsApi = {
  getAll: async (filters?: SubscriptionFilters): Promise<ApiResponse<Subscription[]>> => {
    const response = await apiClient.get('/subscriptions', { params: filters });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Subscription>> => {
    const response = await apiClient.get(`/subscriptions/${id}`);
    return response.data;
  },

  create: async (input: CreateSubscriptionInput): Promise<ApiResponse<Subscription>> => {
    const response = await apiClient.post('/subscriptions', input);
    return response.data;
  },

  update: async (id: string, input: UpdateSubscriptionInput): Promise<ApiResponse<Subscription>> => {
    const response = await apiClient.patch(`/subscriptions/${id}`, input);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/subscriptions/${id}`);
    return response.data;
  },

  getSummary: async (params?: { status?: string }): Promise<ApiResponse<SubscriptionSummary>> => {
    const response = await apiClient.get('/subscriptions/summary', { params });
    return response.data;
  },
};
