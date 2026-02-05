import { Router } from 'express';
import { viewController } from '../controllers/view.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createViewSchema,
  updateViewSchema,
  viewQuerySchema,
  viewDataQuerySchema,
} from '../validators/view.validator';

const router = Router();

router.use(authMiddleware);

// GET /views - 一覧取得
router.get(
  '/',
  validateQuery(viewQuerySchema),
  viewController.list.bind(viewController)
);

// POST /views - 作成
router.post(
  '/',
  validate(createViewSchema),
  viewController.create.bind(viewController)
);

// GET /views/:id - 詳細取得
router.get(
  '/:id',
  viewController.getById.bind(viewController)
);

// GET /views/:id/data - ビューに基づくデータ取得
router.get(
  '/:id/data',
  validateQuery(viewDataQuerySchema),
  viewController.getData.bind(viewController)
);

// PATCH /views/:id - 更新
router.patch(
  '/:id',
  validate(updateViewSchema),
  viewController.update.bind(viewController)
);

// DELETE /views/:id - 削除
router.delete(
  '/:id',
  viewController.delete.bind(viewController)
);

export default router;
