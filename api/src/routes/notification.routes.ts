import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess, createPaginationMeta } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

// GET /notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, skip } = parsePagination(req);

    const isReadFilter = req.query.isRead !== undefined
      ? req.query.isRead === 'true'
      : undefined;

    const where = {
      userId,
      ...(isReadFilter !== undefined && { isRead: isReadFilter }),
    };

    const [total, notifications, unreadCount] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const meta = { ...createPaginationMeta(page, limit, total), unreadCount };
    res.status(200).json({ success: true, data: notifications, meta });
  } catch (err) {
    next(err);
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!notification) throw Errors.notFound('通知');

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// POST /notifications/read-all
router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    sendSuccess(res, { message: 'すべての通知を既読にしました' });
  } catch (err) {
    next(err);
  }
});

export default router;
