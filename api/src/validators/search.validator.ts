import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1, '検索キーワードを入力してください'),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  type: z.enum(['all', 'transactions', 'subscriptions']).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
