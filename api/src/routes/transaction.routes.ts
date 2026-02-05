import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
  transactionSummaryQuerySchema,
} from '../validators/transaction.validator';

const router = Router();

router.use(authMiddleware);

// GET /transactions - 一覧取得
router.get(
  '/',
  validateQuery(transactionQuerySchema),
  transactionController.list.bind(transactionController)
);

// GET /transactions/summary - 集計
router.get(
  '/summary',
  validateQuery(transactionSummaryQuerySchema),
  transactionController.getSummary.bind(transactionController)
);

// POST /transactions - 手動登録
router.post(
  '/',
  validate(createTransactionSchema),
  transactionController.create.bind(transactionController)
);

// GET /transactions/:id - 詳細取得
router.get(
  '/:id',
  transactionController.getById.bind(transactionController)
);

// PATCH /transactions/:id - 更新
router.patch(
  '/:id',
  validate(updateTransactionSchema),
  transactionController.update.bind(transactionController)
);

// DELETE /transactions/:id - 削除
router.delete(
  '/:id',
  transactionController.delete.bind(transactionController)
);

export default router;
