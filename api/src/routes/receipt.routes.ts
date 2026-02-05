import { Router } from 'express';
import { receiptController } from '../controllers/receipt.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import { upload } from '../config/upload';
import {
  receiptQuerySchema,
  updateReceiptSchema,
  confirmReceiptSchema,
} from '../validators/receipt.validator';

const router = Router();

router.use(authMiddleware);

// GET /receipts - 一覧取得
router.get(
  '/',
  validateQuery(receiptQuerySchema),
  receiptController.list.bind(receiptController)
);

// POST /receipts - アップロード
router.post(
  '/',
  upload.single('file'),
  receiptController.upload.bind(receiptController)
);

// GET /receipts/:id - 詳細取得
router.get(
  '/:id',
  receiptController.getById.bind(receiptController)
);

// PATCH /receipts/:id - OCR結果修正
router.patch(
  '/:id',
  validate(updateReceiptSchema),
  receiptController.update.bind(receiptController)
);

// POST /receipts/:id/retry-ocr - OCR再実行
router.post(
  '/:id/retry-ocr',
  receiptController.retryOcr.bind(receiptController)
);

// DELETE /receipts/:id - 削除
router.delete(
  '/:id',
  receiptController.delete.bind(receiptController)
);

// POST /receipts/:id/confirm - 確定→Transaction生成
router.post(
  '/:id/confirm',
  validate(confirmReceiptSchema),
  receiptController.confirm.bind(receiptController)
);

export default router;
