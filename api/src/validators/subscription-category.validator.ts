import { z } from 'zod';

export const createSubscriptionCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'カテゴリ名を入力してください')
    .max(100, 'カテゴリ名は100文字以内で入力してください'),
});

export const updateSubscriptionCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'カテゴリ名を入力してください')
    .max(100, 'カテゴリ名は100文字以内で入力してください'),
});

export type CreateSubscriptionCategoryInput = z.infer<typeof createSubscriptionCategorySchema>;
export type UpdateSubscriptionCategoryInput = z.infer<typeof updateSubscriptionCategorySchema>;
