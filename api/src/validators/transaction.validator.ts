import { z } from 'zod';

export const transactionTypeEnum = z.enum(['expense', 'income', 'adjustment']);

export const createTransactionSchema = z.object({
  type: transactionTypeEnum.default('expense'),
  amount: z
    .number()
    .positive('金額は正の数で入力してください')
    .max(999999999999, '金額が上限を超えています'),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください'),
  merchant: z
    .string()
    .max(255, '店舗名は255文字以内で入力してください')
    .optional(),
  properties: z.record(z.unknown()).optional().default({}),
});

export const updateTransactionSchema = z.object({
  type: transactionTypeEnum.optional(),
  amount: z
    .number()
    .positive('金額は正の数で入力してください')
    .max(999999999999, '金額が上限を超えています')
    .optional(),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .optional(),
  merchant: z
    .string()
    .max(255, '店舗名は255文字以内で入力してください')
    .nullable()
    .optional(),
  properties: z.record(z.unknown()).optional(),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['transactionDate', 'amount', 'createdAt', 'merchant']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  type: transactionTypeEnum.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  merchant: z.string().optional(),
});

export const transactionSummaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year', 'type']).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type TransactionSummaryQueryInput = z.infer<typeof transactionSummaryQuerySchema>;
