import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import { Transaction } from '@/types/transaction';
import { Subscription } from '@/types/subscription';

export interface SearchResult {
  transactions: Transaction[];
  subscriptions: Subscription[];
}

export const searchApi = {
  search: async (keyword: string): Promise<ApiResponse<SearchResult>> => {
    const response = await apiClient.get('/search', { params: { keyword } });
    return response.data;
  },
};

export const exportApi = {
  exportTransactions: async (params?: { from?: string; to?: string }): Promise<Blob> => {
    const response = await apiClient.post('/exports/transactions', null, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  exportSubscriptions: async (): Promise<Blob> => {
    const response = await apiClient.post('/exports/subscriptions', null, {
      responseType: 'blob',
    });
    return response.data;
  },
};
