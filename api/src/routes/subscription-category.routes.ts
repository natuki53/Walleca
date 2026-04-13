import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /subscription-categories
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.subscriptionCategory.findMany({
      where: { userId: req.user!.userId },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    sendSuccess(
      res,
      categories.map(({ _count, ...category }) => ({
        ...category,
        subscriptionCount: _count.subscriptions,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /subscription-categories
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const { name, sortOrder } = parsed.data;
    const userId = req.user!.userId;

    const maxOrder = await prisma.subscriptionCategory.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const order = sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

    const category = await prisma.subscriptionCategory.create({
      data: { userId, name, sortOrder: order },
    });
    sendSuccess(res, category, 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /subscription-categories/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const category = await prisma.subscriptionCategory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!category) throw Errors.notFound('カテゴリ');

    const updated = await prisma.subscriptionCategory.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /subscription-categories/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.subscriptionCategory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });
    if (!category) throw Errors.notFound('カテゴリ');

    await prisma.subscriptionCategory.delete({ where: { id: req.params.id } });
    sendSuccess(res, {
      message: 'カテゴリを削除しました',
      clearedSubscriptionCount: category._count.subscriptions,
      name: category.name,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
