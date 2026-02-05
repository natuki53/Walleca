import { z } from 'zod';

export const exportTransactionsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください').optional(),
  type: z.enum(['expense', 'income', 'adjustment']).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

export const exportSubscriptionsSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

export type ExportTransactionsInput = z.infer<typeof exportTransactionsSchema>;
export type ExportSubscriptionsInput = z.infer<typeof exportSubscriptionsSchema>;
