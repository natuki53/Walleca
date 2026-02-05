import { Router } from 'express';
import { exportController } from '../controllers/export.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  exportTransactionsSchema,
  exportSubscriptionsSchema,
} from '../validators/export.validator';

const router = Router();

router.use(authMiddleware);

// POST /export/transactions - 取引CSVエクスポート
router.post(
  '/transactions',
  validate(exportTransactionsSchema),
  exportController.exportTransactions.bind(exportController)
);

// POST /export/subscriptions - サブスクリプションCSVエクスポート
router.post(
  '/subscriptions',
  validate(exportSubscriptionsSchema),
  exportController.exportSubscriptions.bind(exportController)
);

export default router;
