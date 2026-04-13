import { apiClient } from './client';
import { ApiResponse } from '@/types/api';

export interface OcrJobStatus {
  status: 'pending' | 'processing' | 'success' | 'failed' | 'confirmed' | 'expired';
  expiresAt: string;
}

export interface ReceiptOcrJobResult extends OcrJobStatus {
  extractedMerchant: string | null;
  extractedDate: string | null;
  extractedTotal: number | null;
  rawText: string | null;
}

export interface SubscriptionOcrJobResult extends OcrJobStatus {
  extractedServiceName: string | null;
  extractedAmount: number | null;
  extractedBillingCycle: 'monthly' | 'yearly' | null;
  extractedNextPaymentDate: string | null;
  rawText: string | null;
}

export const receiptOcrJobsApi = {
  create: async (file: File): Promise<ApiResponse<{ jobId: string; status: string; expiresAt: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/receipt-ocr-jobs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<ReceiptOcrJobResult>> => {
    const response = await apiClient.get(`/receipt-ocr-jobs/${id}`);
    return response.data;
  },

  confirm: async (id: string, input: {
    merchant?: string;
    amount: number;
    transactionDate: string;
    categoryId?: string;
    paymentMethod?: string;
    memo?: string;
    type?: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post(`/receipt-ocr-jobs/${id}/confirm`, input);
    return response.data;
  },

  discard: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/receipt-ocr-jobs/${id}`);
    return response.data;
  },
};

export const subscriptionOcrJobsApi = {
  create: async (file: File): Promise<ApiResponse<{ jobId: string; status: string; expiresAt: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/subscription-ocr-jobs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<SubscriptionOcrJobResult>> => {
    const response = await apiClient.get(`/subscription-ocr-jobs/${id}`);
    return response.data;
  },

  confirm: async (id: string, input: {
    serviceName: string;
    amount: number;
    billingCycle?: string;
    nextPaymentDate?: string;
    categoryId?: string;
    status?: string;
    memo?: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post(`/subscription-ocr-jobs/${id}/confirm`, input);
    return response.data;
  },

  discard: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/subscription-ocr-jobs/${id}`);
    return response.data;
  },
};
