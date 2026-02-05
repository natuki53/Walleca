import { Router } from 'express';
import { subscriptionCategoryController } from '../controllers/subscription-category.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createSubscriptionCategorySchema,
  updateSubscriptionCategorySchema,
} from '../validators/subscription-category.validator';

const router = Router();

router.use(authMiddleware);

// GET /subscription-categories - 一覧取得
router.get(
  '/',
  subscriptionCategoryController.list.bind(subscriptionCategoryController)
);

// POST /subscription-categories - 作成
router.post(
  '/',
  validate(createSubscriptionCategorySchema),
  subscriptionCategoryController.create.bind(subscriptionCategoryController)
);

// PATCH /subscription-categories/:id - 更新
router.patch(
  '/:id',
  validate(updateSubscriptionCategorySchema),
  subscriptionCategoryController.update.bind(subscriptionCategoryController)
);

// DELETE /subscription-categories/:id - 削除
router.delete(
  '/:id',
  subscriptionCategoryController.delete.bind(subscriptionCategoryController)
);

export default router;
