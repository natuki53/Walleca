export type OcrStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface Receipt {
  id: string;
  imagePath: string;
  imageSize: number;
  mimeType: string;
  ocrStatus: OcrStatus;
  ocrRawText: string | null;
  extractedMerchant: string | null;
  extractedDate: string | null;
  extractedTotal: number | null;
  ocrProcessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transaction?: {
    id: string;
  } | null;
}

export interface UpdateReceiptInput {
  extractedMerchant?: string | null;
  extractedDate?: string | null;
  extractedTotal?: number | null;
}

export interface ConfirmReceiptInput {
  type?: 'expense' | 'income' | 'adjustment';
  amount?: number;
  transactionDate?: string;
  merchant?: string;
  properties?: Record<string, unknown>;
}

export interface ReceiptFilters {
  ocrStatus?: OcrStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
