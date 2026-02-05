import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import {
  CreateSubscriptionCategoryInput,
  SubscriptionCategory,
  UpdateSubscriptionCategoryInput,
} from '@/types/subscriptionCategory';

export const subscriptionCategoriesApi = {
  getAll: async (): Promise<ApiResponse<SubscriptionCategory[]>> => {
    const response = await apiClient.get('/subscription-categories');
    return response.data;
  },

  create: async (
    input: CreateSubscriptionCategoryInput
  ): Promise<ApiResponse<SubscriptionCategory>> => {
    const response = await apiClient.post('/subscription-categories', {
      name: input.name.trim(),
    });
    return response.data;
  },

  update: async (
    id: string,
    input: UpdateSubscriptionCategoryInput
  ): Promise<ApiResponse<SubscriptionCategory>> => {
    const response = await apiClient.patch(`/subscription-categories/${id}`, {
      name: input.name.trim(),
    });
    return response.data;
  },

  delete: async (
    id: string
  ): Promise<ApiResponse<{ message: string; clearedSubscriptionCount: number; name: string }>> => {
    const response = await apiClient.delete(`/subscription-categories/${id}`);
    return response.data;
  },
};
