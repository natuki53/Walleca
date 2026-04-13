export interface TransactionCategory {
  id: string;
  name: string;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionCategoryInput {
  name: string;
}

export interface UpdateTransactionCategoryInput {
  name: string;
}
