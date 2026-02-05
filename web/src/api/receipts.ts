import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import {
  Receipt,
  UpdateReceiptInput,
  ConfirmReceiptInput,
  ReceiptFilters,
} from '@/types/receipt';
import { Transaction } from '@/types/transaction';

export const receiptsApi = {
  getAll: async (filters?: ReceiptFilters): Promise<ApiResponse<Receipt[]>> => {
    const response = await apiClient.get('/receipts', { params: filters });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Receipt>> => {
    const response = await apiClient.get(`/receipts/${id}`);
    return response.data;
  },

  upload: async (file: File): Promise<ApiResponse<Receipt>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/receipts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: string, input: UpdateReceiptInput): Promise<ApiResponse<Receipt>> => {
    const response = await apiClient.patch(`/receipts/${id}`, input);
    return response.data;
  },

  retryOcr: async (id: string): Promise<ApiResponse<Receipt>> => {
    const response = await apiClient.post(`/receipts/${id}/retry-ocr`);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/receipts/${id}`);
    return response.data;
  },

  confirm: async (id: string, input: ConfirmReceiptInput): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post(`/receipts/${id}/confirm`, input);
    return response.data;
  },
};
