import { z } from 'zod';

export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['createdAt', 'ocrStatus', 'extractedDate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  ocrStatus: z.enum(['pending', 'processing', 'success', 'failed']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateReceiptSchema = z.object({
  extractedMerchant: z
    .string()
    .max(255, '店舗名は255文字以内で入力してください')
    .nullable()
    .optional(),
  extractedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .nullable()
    .optional(),
  extractedTotal: z
    .number()
    .positive('金額は正の数で入力してください')
    .nullable()
    .optional(),
});

export const confirmReceiptSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']).default('expense'),
  amount: z.number().positive('金額は正の数で入力してください').optional(),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .optional(),
  merchant: z
    .string()
    .max(255, '店舗名は255文字以内で入力してください')
    .optional(),
  properties: z.record(z.unknown()).optional().default({}),
});

export type ReceiptQueryInput = z.infer<typeof receiptQuerySchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
export type ConfirmReceiptInput = z.infer<typeof confirmReceiptSchema>;
