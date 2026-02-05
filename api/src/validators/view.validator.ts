import { z } from 'zod';

export const viewTypeEnum = z.enum(['list', 'calendar']);

export const viewFiltersSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  merchant: z.string().optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
}).optional();

export const sortConfigSchema = z.object({
  field: z.enum(['transactionDate', 'amount', 'createdAt', 'merchant']),
  order: z.enum(['asc', 'desc']),
}).optional();

export const createViewSchema = z.object({
  name: z
    .string()
    .min(1, 'ビュー名を入力してください')
    .max(100, 'ビュー名は100文字以内で入力してください'),
  viewType: viewTypeEnum.default('list'),
  filters: viewFiltersSchema.default({}),
  sortConfig: sortConfigSchema.default({ field: 'transactionDate', order: 'desc' }),
  groupBy: z
    .string()
    .max(50, 'グループ化フィールドは50文字以内で入力してください')
    .nullable()
    .optional(),
  isDefault: z.boolean().default(false),
});

export const updateViewSchema = z.object({
  name: z
    .string()
    .min(1, 'ビュー名を入力してください')
    .max(100, 'ビュー名は100文字以内で入力してください')
    .optional(),
  viewType: viewTypeEnum.optional(),
  filters: viewFiltersSchema,
  sortConfig: sortConfigSchema,
  groupBy: z
    .string()
    .max(50, 'グループ化フィールドは50文字以内で入力してください')
    .nullable()
    .optional(),
  isDefault: z.boolean().optional(),
});

export const viewQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const viewDataQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateViewInput = z.infer<typeof createViewSchema>;
export type UpdateViewInput = z.infer<typeof updateViewSchema>;
export type ViewQueryInput = z.infer<typeof viewQuerySchema>;
export type ViewDataQueryInput = z.infer<typeof viewDataQuerySchema>;
