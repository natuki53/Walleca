import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination, parseSort } from '../utils/pagination';
import { advanceNextPaymentDateToCurrentOrFuture, addUtcDays, getCurrentUtcDate } from '../utils/subscription-date';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  serviceName: z.string().min(1).max(255),
  amount: z.number().positive(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  nextPaymentDate: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  memo: z.string().optional(),
  sourceType: z.enum(['manual', 'ocr']).default('manual'),
});

const updateSchema = createSchema.partial();

// GET /subscriptions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, skip } = parsePagination(req);
    const { field, order } = parseSort(req, ['nextPaymentDate', 'amount', 'serviceName', 'createdAt'], 'nextPaymentDate');

    const where: Prisma.SubscriptionWhereInput = { userId };
    if (req.query.status) where.status = req.query.status as any;
    if (req.query.billingCycle) where.billingCycle = req.query.billingCycle as any;
    if (req.query.categoryId) where.categoryId = req.query.categoryId as string;

    const [total, subscriptions] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        orderBy: { [field]: order },
        skip,
        take: limit,
        include: { category: true },
      }),
    ]);

    sendPaginated(res, subscriptions, createPaginationMeta(page, limit, total));
  } catch (err) {
    next(err);
  }
});

// GET /subscriptions/summary
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const subscriptions = await prisma.subscription.findMany({
      where: { userId, status: 'active' },
      include: { category: true },
    });

    let monthlyTotal = 0;
    let yearlyTotal = 0;
    const categoryMap = new Map<string, number>();

    for (const sub of subscriptions) {
      const monthlyAmount = sub.billingCycle === 'yearly'
        ? Number(sub.amount) / 12
        : Number(sub.amount);
      monthlyTotal += monthlyAmount;
      yearlyTotal += sub.billingCycle === 'yearly'
        ? Number(sub.amount)
        : Number(sub.amount) * 12;

      const catName = sub.category?.name ?? 'その他';
      categoryMap.set(catName, (categoryMap.get(catName) ?? 0) + monthlyAmount);
    }

    const today = getCurrentUtcDate();
    const soon = addUtcDays(today, 7);
    const upcomingPayments = subscriptions
      .filter(s => new Date(s.nextPaymentDate) <= soon)
      .sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime())
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        serviceName: s.serviceName,
        amount: Number(s.amount),
        nextPaymentDate: s.nextPaymentDate,
      }));

    sendSuccess(res, {
      count: subscriptions.length,
      monthlyTotal,
      yearlyTotal,
      byCategory: Array.from(categoryMap.entries()).map(([category, monthlyAmount]) => ({ category, monthlyAmount })),
      upcomingPayments,
    });
  } catch (err) {
    next(err);
  }
});

// POST /subscriptions
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const { categoryId, nextPaymentDate, ...rest } = parsed.data;
    if (categoryId) {
      const cat = await prisma.subscriptionCategory.findFirst({ where: { id: categoryId, userId: req.user!.userId } });
      if (!cat) throw Errors.notFound('カテゴリ');
    }

    const baseDate = nextPaymentDate ? new Date(nextPaymentDate) : getCurrentUtcDate();
    const resolvedDate = rest.status === 'active'
      ? advanceNextPaymentDateToCurrentOrFuture(baseDate, rest.billingCycle)
      : baseDate;

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user!.userId,
        categoryId: categoryId ?? null,
        nextPaymentDate: resolvedDate,
        ...rest,
      },
      include: { category: true },
    });
    sendSuccess(res, subscription, 201);
  } catch (err) {
    next(err);
  }
});

// GET /subscriptions/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { category: true },
    });
    if (!subscription) throw Errors.notFound('サブスク');
    sendSuccess(res, subscription);
  } catch (err) {
    next(err);
  }
});

// PATCH /subscriptions/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw Errors.notFound('サブスク');

    const { categoryId, nextPaymentDate, ...rest } = parsed.data;
    const updateData: Prisma.SubscriptionUpdateInput = { ...rest };
    if (categoryId !== undefined) updateData.category = categoryId ? { connect: { id: categoryId } } : { disconnect: true };
    if (nextPaymentDate) updateData.nextPaymentDate = new Date(nextPaymentDate);

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data: updateData,
      include: { category: true },
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /subscriptions/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw Errors.notFound('サブスク');
    await prisma.subscription.delete({ where: { id: req.params.id } });
    sendSuccess(res, { message: 'サブスクを削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
