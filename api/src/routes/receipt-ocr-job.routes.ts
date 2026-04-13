import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload } from '../config/upload';
import { addOcrJob } from '../config/queue';
import { sendSuccess } from '../utils/response';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const OCR_JOB_TTL_MINUTES = 30;

const confirmSchema = z.object({
  merchant: z.string().max(255).optional(),
  amount: z.number().positive(),
  transactionDate: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  paymentMethod: z.enum([
    'cash', 'credit_card', 'debit_card', 'e_money',
    'qr_payment', 'bank_transfer', 'other',
  ]).optional(),
  memo: z.string().optional(),
  type: z.enum(['expense', 'income', 'adjustment']).default('expense'),
});

// POST /receipt-ocr-jobs
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw Errors.validation('ファイルをアップロードしてください');

    const expiresAt = new Date(Date.now() + OCR_JOB_TTL_MINUTES * 60 * 1000);
    const job = await prisma.receiptOcrJob.create({
      data: {
        userId: req.user!.userId,
        status: 'pending',
        expiresAt,
      },
    });

    await addOcrJob({
      receiptId: job.id,
      imagePath: req.file.path,
      userId: req.user!.userId,
    });

    sendSuccess(res, {
      jobId: job.id,
      status: job.status,
      expiresAt: job.expiresAt,
    }, 201);
  } catch (err) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    next(err);
  }
});

// GET /receipt-ocr-jobs/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.receiptOcrJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) throw Errors.notFound('OCRジョブ');
    if (job.expiresAt < new Date() && job.status !== 'confirmed') {
      throw new (class extends Error { statusCode = 410; code = 'OCR_JOB_EXPIRED'; constructor() { super('OCRジョブの有効期限が切れています'); this.name = 'AppError'; } })();
    }
    sendSuccess(res, {
      status: job.status,
      extractedMerchant: job.extractedMerchant,
      extractedDate: job.extractedDate,
      extractedTotal: job.extractedTotal ? Number(job.extractedTotal) : null,
      rawText: job.rawText,
      expiresAt: job.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /receipt-ocr-jobs/:id/confirm
router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const job = await prisma.receiptOcrJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) throw Errors.notFound('OCRジョブ');
    if (job.status === 'confirmed') throw Errors.validation('このジョブはすでに確定済みです');
    if (job.expiresAt < new Date()) throw Errors.validation('OCRジョブの有効期限が切れています');

    const { categoryId, ...rest } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          userId: req.user!.userId,
          merchant: rest.merchant ?? job.extractedMerchant,
          receiptDate: new Date(rest.transactionDate),
          totalAmount: rest.amount,
          ocrStatus: 'confirmed',
        },
      });
      const transaction = await tx.transaction.create({
        data: {
          userId: req.user!.userId,
          receiptId: receipt.id,
          type: rest.type,
          amount: rest.amount,
          transactionDate: new Date(rest.transactionDate),
          merchant: rest.merchant ?? job.extractedMerchant,
          categoryId: categoryId ?? null,
          paymentMethod: rest.paymentMethod ?? null,
          memo: rest.memo ?? null,
        },
      });
      await tx.receiptOcrJob.update({
        where: { id: job.id },
        data: { status: 'confirmed', rawText: null, confirmedAt: new Date() },
      });
      return transaction;
    });

    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
});

// DELETE /receipt-ocr-jobs/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.receiptOcrJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) throw Errors.notFound('OCRジョブ');
    await prisma.receiptOcrJob.delete({ where: { id: job.id } });
    sendSuccess(res, { message: 'OCRジョブを削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
