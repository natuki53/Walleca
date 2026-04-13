import { apiClient } from './client';
import { ApiResponse } from '@/types/api';

export interface OcrJobEntry {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'confirmed' | 'expired';
  extractedMerchant: string | null;
  extractedDate: string | null;
  extractedTotal: number | null;
  rawText: string | null;
  expiresAt: string;
  processedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOcrJobResponse {
  jobId: string;
  status: string;
  expiresAt: string;
}

export interface UpdateReceiptOcrInput {
  extractedMerchant?: string | null;
  extractedDate?: string | null;
  extractedTotal?: number | null;
}

export const receiptsApi = {
  // OCR ジョブ作成（アップロード）
  upload: async (file: File): Promise<ApiResponse<CreateOcrJobResponse>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/receipt-ocr-jobs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // OCR ジョブ取得（ポーリング用）
  getJob: async (id: string): Promise<ApiResponse<OcrJobEntry>> => {
    const response = await apiClient.get(`/receipt-ocr-jobs/${id}`);
    return response.data;
  },

  // OCR 結果確定 → Transaction 生成
  confirm: async (id: string, input: {
    type?: string;
    amount: number;
    transactionDate: string;
    merchant?: string;
    categoryId?: string;
    paymentMethod?: string;
    memo?: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post(`/receipt-ocr-jobs/${id}/confirm`, input);
    return response.data;
  },

  // OCR ジョブ破棄
  discard: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/receipt-ocr-jobs/${id}`);
    return response.data;
  },

  update: async (id: string, input: UpdateReceiptOcrInput): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.patch(`/receipt-ocr-jobs/${id}`, input);
    return response.data;
  },

  retryOcr: async (id: string): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post(`/receipt-ocr-jobs/${id}/retry`);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/receipt-ocr-jobs/${id}`);
    return response.data;
  },
};
