import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  subscriptionQuerySchema,
  subscriptionSummaryQuerySchema,
} from '../validators/subscription.validator';

const router = Router();

router.use(authMiddleware);

// GET /subscriptions - 一覧取得
router.get(
  '/',
  validateQuery(subscriptionQuerySchema),
  subscriptionController.list.bind(subscriptionController)
);

// GET /subscriptions/summary - 集計
router.get(
  '/summary',
  validateQuery(subscriptionSummaryQuerySchema),
  subscriptionController.getSummary.bind(subscriptionController)
);

// POST /subscriptions - 登録
router.post(
  '/',
  validate(createSubscriptionSchema),
  subscriptionController.create.bind(subscriptionController)
);

// GET /subscriptions/:id - 詳細取得
router.get(
  '/:id',
  subscriptionController.getById.bind(subscriptionController)
);

// PATCH /subscriptions/:id - 更新
router.patch(
  '/:id',
  validate(updateSubscriptionSchema),
  subscriptionController.update.bind(subscriptionController)
);

// DELETE /subscriptions/:id - 削除
router.delete(
  '/:id',
  subscriptionController.delete.bind(subscriptionController)
);

export default router;
