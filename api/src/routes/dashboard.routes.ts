import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { addUtcDays, getCurrentUtcDate } from '../utils/subscription-date';

const router = Router();
router.use(authMiddleware);

// GET /dashboard
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const today = getCurrentUtcDate();
    const thisMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    const lastMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));

    const [thisMonthTx, lastMonthTx, subscriptions, notifications] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          transactionDate: { gte: thisMonthStart, lt: nextMonthStart },
        },
        select: { type: true, amount: true, transactionDate: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          transactionDate: { gte: lastMonthStart, lt: thisMonthStart },
        },
        select: { type: true, amount: true },
      }),
      prisma.subscription.findMany({
        where: { userId, status: 'active' },
        select: { id: true, serviceName: true, amount: true, billingCycle: true, nextPaymentDate: true },
        orderBy: { nextPaymentDate: 'asc' },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    // 今月の支出
    const thisMonthExpense = thisMonthTx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // 先月の支出
    const lastMonthExpense = lastMonthTx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const diff = thisMonthExpense - lastMonthExpense;
    const changeRate = lastMonthExpense === 0 ? null : (diff / lastMonthExpense) * 100;

    // サブスク月額合計
    const subscriptionMonthlyTotal = subscriptions.reduce((sum, s) => {
      return sum + (s.billingCycle === 'yearly' ? Number(s.amount) / 12 : Number(s.amount));
    }, 0);

    // 直近7日以内の支払い予定
    const soon = addUtcDays(today, 7);
    const upcomingPayments = subscriptions
      .filter(s => new Date(s.nextPaymentDate) <= soon)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        serviceName: s.serviceName,
        amount: Number(s.amount),
        nextPaymentDate: s.nextPaymentDate,
      }));

    // 今月のカレンダー集計（日別）
    const calendarMap = new Map<string, { expense: number; income: number }>();
    for (const t of thisMonthTx) {
      const key = new Date(t.transactionDate).toISOString().slice(0, 10);
      if (!calendarMap.has(key)) calendarMap.set(key, { expense: 0, income: 0 });
      const entry = calendarMap.get(key)!;
      if (t.type === 'expense') entry.expense += Number(t.amount);
      else if (t.type === 'income') entry.income += Number(t.amount);
    }
    const calendar = Array.from(calendarMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));

    sendSuccess(res, {
      thisMonthExpense,
      lastMonthExpense,
      diff,
      changeRate,
      subscriptionMonthlyTotal,
      upcomingPayments,
      unreadNotifications: notifications,
      calendar,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
