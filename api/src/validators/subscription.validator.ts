import { z } from 'zod';

export const billingCycleEnum = z.enum(['monthly', 'yearly']);
export const subscriptionStatusEnum = z.enum(['active', 'paused', 'cancelled']);

export const createSubscriptionSchema = z.object({
  serviceName: z
    .string()
    .min(1, 'サービス名を入力してください')
    .max(255, 'サービス名は255文字以内で入力してください'),
  amount: z
    .number()
    .positive('金額は正の数で入力してください')
    .max(999999999999, '金額が上限を超えています'),
  billingCycle: billingCycleEnum.default('monthly'),
  nextPaymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください'),
  category: z
    .string()
    .max(100, 'カテゴリは100文字以内で入力してください')
    .optional(),
  status: subscriptionStatusEnum.default('active'),
  memo: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
  serviceName: z
    .string()
    .min(1, 'サービス名を入力してください')
    .max(255, 'サービス名は255文字以内で入力してください')
    .optional(),
  amount: z
    .number()
    .positive('金額は正の数で入力してください')
    .max(999999999999, '金額が上限を超えています')
    .optional(),
  billingCycle: billingCycleEnum.optional(),
  nextPaymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .optional(),
  category: z
    .string()
    .max(100, 'カテゴリは100文字以内で入力してください')
    .nullable()
    .optional(),
  status: subscriptionStatusEnum.optional(),
  memo: z.string().nullable().optional(),
});

export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['nextPaymentDate', 'amount', 'serviceName', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  status: subscriptionStatusEnum.optional(),
  billingCycle: billingCycleEnum.optional(),
  category: z.string().optional(),
});

export const subscriptionSummaryQuerySchema = z.object({
  status: subscriptionStatusEnum.optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type SubscriptionQueryInput = z.infer<typeof subscriptionQuerySchema>;
export type SubscriptionSummaryQueryInput = z.infer<typeof subscriptionSummaryQuerySchema>;
