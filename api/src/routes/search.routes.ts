import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authMiddleware);

// GET /search
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const keyword = (req.query.keyword as string | undefined)?.trim() ?? '';

    if (!keyword) {
      sendSuccess(res, { transactions: [], subscriptions: [] });
      return;
    }

    const [transactions, subscriptions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { merchant: { contains: keyword } },
            { memo: { contains: keyword } },
          ],
        },
        orderBy: { transactionDate: 'desc' },
        take: 20,
        include: { category: true },
      }),
      prisma.subscription.findMany({
        where: {
          userId,
          serviceName: { contains: keyword },
        },
        orderBy: { nextPaymentDate: 'asc' },
        take: 20,
        include: { category: true },
      }),
    ]);

    sendSuccess(res, { transactions, subscriptions });
  } catch (err) {
    next(err);
  }
});

export default router;
