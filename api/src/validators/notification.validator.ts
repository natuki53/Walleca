import { z } from 'zod';

export const notificationTypeEnum = z.enum(['subscription_reminder', 'system', 'info']);

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  isRead: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  type: notificationTypeEnum.optional(),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
