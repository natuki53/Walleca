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

// GET /transaction-categories
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.transactionCategory.findMany({
      where: { userId: req.user!.userId },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    sendSuccess(
      res,
      categories.map(({ _count, ...category }) => ({
        ...category,
        transactionCount: _count.transactions,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /transaction-categories
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const { name, sortOrder } = parsed.data;
    const userId = req.user!.userId;

    const maxOrder = await prisma.transactionCategory.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const order = sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

    const category = await prisma.transactionCategory.create({
      data: { userId, name, sortOrder: order },
    });
    sendSuccess(res, category, 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /transaction-categories/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const category = await prisma.transactionCategory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!category) throw Errors.notFound('カテゴリ');

    const updated = await prisma.transactionCategory.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /transaction-categories/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.transactionCategory.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });
    if (!category) throw Errors.notFound('カテゴリ');

    await prisma.transactionCategory.delete({ where: { id: req.params.id } });
    sendSuccess(res, {
      message: 'カテゴリを削除しました',
      clearedTransactionCount: category._count.transactions,
      name: category.name,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
