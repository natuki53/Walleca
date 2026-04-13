export type TransactionType = 'expense' | 'income' | 'adjustment';
export type TransactionSummaryGroupBy = 'day' | 'week' | 'month' | 'year';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  transactionDate: string;
  merchant: string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  paymentMethod?: string | null;
  memo?: string | null;
  properties?: Record<string, unknown>;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  type?: TransactionType;
  amount: number;
  transactionDate: string;
  merchant?: string;
  categoryId?: string;
  paymentMethod?: string;
  memo?: string;
  properties?: Record<string, unknown>;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  amount?: number;
  transactionDate?: string;
  merchant?: string | null;
  categoryId?: string | null;
  paymentMethod?: string | null;
  memo?: string | null;
  properties?: Record<string, unknown>;
}

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  from?: string;
  to?: string;
  merchant?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionSummary {
  summary: {
    expense: { total: number; count: number };
    income: { total: number; count: number };
    adjustment: { total: number; count: number };
  };
  balance: number;
  grouped: Array<{
    period: string;
    expense: number;
    income: number;
    adjustment: number;
  }>;
}
