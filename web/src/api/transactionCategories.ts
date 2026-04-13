import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import {
  CreateTransactionCategoryInput,
  TransactionCategory,
  UpdateTransactionCategoryInput,
} from '@/types/transactionCategory';

export const transactionCategoriesApi = {
  getAll: async (): Promise<ApiResponse<TransactionCategory[]>> => {
    const response = await apiClient.get('/transaction-categories');
    return response.data;
  },

  create: async (
    input: CreateTransactionCategoryInput
  ): Promise<ApiResponse<TransactionCategory>> => {
    const response = await apiClient.post('/transaction-categories', {
      name: input.name.trim(),
    });
    return response.data;
  },

  update: async (
    id: string,
    input: UpdateTransactionCategoryInput
  ): Promise<ApiResponse<TransactionCategory>> => {
    const response = await apiClient.patch(`/transaction-categories/${id}`, {
      name: input.name.trim(),
    });
    return response.data;
  },

  delete: async (
    id: string
  ): Promise<ApiResponse<{ message: string; clearedTransactionCount: number; name: string }>> => {
    const response = await apiClient.delete(`/transaction-categories/${id}`);
    return response.data;
  },
};
