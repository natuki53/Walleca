import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilters,
  TransactionSummary,
} from '@/types/transaction';

export const transactionsApi = {
  getAll: async (filters?: TransactionFilters): Promise<ApiResponse<Transaction[]>> => {
    const response = await apiClient.get('/transactions', { params: filters });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.get(`/transactions/${id}`);
    return response.data;
  },

  create: async (input: CreateTransactionInput): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post('/transactions', input);
    return response.data;
  },

  update: async (id: string, input: UpdateTransactionInput): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.patch(`/transactions/${id}`, input);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/transactions/${id}`);
    return response.data;
  },

  getSummary: async (params?: { from?: string; to?: string; groupBy?: string }): Promise<ApiResponse<TransactionSummary>> => {
    const response = await apiClient.get('/transactions/summary', { params });
    return response.data;
  },
};
