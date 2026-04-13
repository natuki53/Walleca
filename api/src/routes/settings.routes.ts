import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const updateSettingsSchema = z.object({
  timezone: z.string().max(100).optional(),
  subscriptionNotificationEnabled: z.boolean().optional(),
  subscriptionNotificationDaysBefore: z.number().int().min(0).max(30).optional(),
});

// GET /settings
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.userSetting.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!settings) throw Errors.notFound('設定');
    sendSuccess(res, {
      timezone: settings.timezone,
      subscriptionNotificationEnabled: settings.subscriptionNotificationEnabled,
      subscriptionNotificationDaysBefore: settings.subscriptionNotificationDaysBefore,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /settings
router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('入力値が不正です', parsed.error.errors);
    }
    const settings = await prisma.userSetting.update({
      where: { userId: req.user!.userId },
      data: parsed.data,
    });
    sendSuccess(res, {
      timezone: settings.timezone,
      subscriptionNotificationEnabled: settings.subscriptionNotificationEnabled,
      subscriptionNotificationDaysBefore: settings.subscriptionNotificationDaysBefore,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
