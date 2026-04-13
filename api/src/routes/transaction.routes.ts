import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination, parseSort, parseDateRange } from '../utils/pagination';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']).default('expense'),
  amount: z.number().positive('金額は正の数で入力してください'),
  transactionDate: z.string().min(1, '日付を入力してください'),
  merchant: z.string().max(255).optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: z.enum([
    'cash', 'credit_card', 'debit_card', 'e_money',
    'qr_payment', 'bank_transfer', 'other',
  ]).optional(),
  memo: z.string().optional(),
});

const updateSchema = createSchema.partial();

// GET /transactions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, skip } = parsePagination(req);
    const { field, order } = parseSort(req, ['transactionDate', 'amount', 'createdAt'], 'transactionDate');
    const { from, to } = parseDateRange(req);

    const where: Prisma.TransactionWhereInput = { userId };
    if (req.query.type) where.type = req.query.type as any;
    if (req.query.categoryId) where.categoryId = req.query.categoryId as string;
    if (req.query.paymentMethod) where.paymentMethod = req.query.paymentMethod as any;
    if (req.query.merchant) where.merchant = { contains: req.query.merchant as string };
    if (req.query.keyword) {
      where.OR = [
        { merchant: { contains: req.query.keyword as string } },
        { memo: { contains: req.query.keyword as string } },
      ];
    }
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = from;
      if (to) where.transactionDate.lte = to;
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { [field]: order },
        skip,
        take: limit,
        include: { category: true },
      }),
    ]);

    sendPaginated(res, transactions, createPaginationMeta(page, limit, total));
  } catch (err) {
    next(err);
  }
});

// GET /transactions/summary
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = parseDateRange(req);
    const groupBy = (req.query.groupBy as string) || 'month';

    const where: Prisma.TransactionWhereInput = { userId };
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = from;
      if (to) where.transactionDate.lte = to;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: { type: true, amount: true, transactionDate: true },
    });

    const summary = { expense: { total: 0, count: 0 }, income: { total: 0, count: 0 }, adjustment: { total: 0, count: 0 } };
    const groupedMap = new Map<string, { expense: number; income: number; adjustment: number }>();

    for (const t of transactions) {
      const amt = Number(t.amount);
      summary[t.type].total += amt;
      summary[t.type].count += 1;

      const date = new Date(t.transactionDate);
      let key: string;
      if (groupBy === 'day') key = date.toISOString().slice(0, 10);
      else if (groupBy === 'week') {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        key = d.toISOString().slice(0, 10);
      } else if (groupBy === 'year') key = String(date.getFullYear());
      else key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!groupedMap.has(key)) groupedMap.set(key, { expense: 0, income: 0, adjustment: 0 });
      groupedMap.get(key)![t.type] += amt;
    }

    const grouped = Array.from(groupedMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, vals]) => ({ period, ...vals }));

    sendSuccess(res, {
      summary,
      balance: summary.income.total - summary.expense.total,
      grouped,
    });
  } catch (err) {
    next(err);
  }
});

// POST /transactions
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const { categoryId, ...rest } = parsed.data;
    if (categoryId) {
      const cat = await prisma.transactionCategory.findFirst({ where: { id: categoryId, userId: req.user!.userId } });
      if (!cat) throw Errors.notFound('カテゴリ');
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user!.userId,
        categoryId: categoryId ?? null,
        ...rest,
        transactionDate: new Date(rest.transactionDate),
      },
      include: { category: true },
    });
    sendSuccess(res, transaction, 201);
  } catch (err) {
    next(err);
  }
});

// GET /transactions/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { category: true },
    });
    if (!transaction) throw Errors.notFound('取引');
    sendSuccess(res, transaction);
  } catch (err) {
    next(err);
  }
});

// PATCH /transactions/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw Errors.notFound('取引');

    const { categoryId, transactionDate, ...rest } = parsed.data;
    const updateData: Prisma.TransactionUpdateInput = { ...rest };
    if (categoryId) {
      const category = await prisma.transactionCategory.findFirst({
        where: { id: categoryId, userId: req.user!.userId },
      });
      if (!category) throw Errors.notFound('カテゴリ');
    }
    if (categoryId !== undefined) {
      updateData.category = categoryId ? { connect: { id: categoryId } } : { disconnect: true };
    }
    if (transactionDate) updateData.transactionDate = new Date(transactionDate);

    const updated = await prisma.transaction.update({
      where: { id: req.params.id },
      data: updateData,
      include: { category: true },
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /transactions/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw Errors.notFound('取引');
    await prisma.transaction.delete({ where: { id: req.params.id } });
    sendSuccess(res, { message: '取引を削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
