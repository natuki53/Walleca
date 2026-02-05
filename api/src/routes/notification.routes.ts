import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { notificationQuerySchema } from '../validators/notification.validator';

const router = Router();

router.use(authMiddleware);

// GET /notifications - 一覧取得
router.get(
  '/',
  validateQuery(notificationQuerySchema),
  notificationController.list.bind(notificationController)
);

// PATCH /notifications/:id/read - 既読
router.patch(
  '/:id/read',
  notificationController.markAsRead.bind(notificationController)
);

// POST /notifications/read-all - 全既読
router.post(
  '/read-all',
  notificationController.markAllAsRead.bind(notificationController)
);

export default router;
