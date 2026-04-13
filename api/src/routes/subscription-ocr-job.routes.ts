import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload } from '../config/upload';
import { addOcrJob } from '../config/queue';
import { sendSuccess } from '../utils/response';
import { advanceNextPaymentDateToCurrentOrFuture, getCurrentUtcDate } from '../utils/subscription-date';
import { Errors } from '../utils/errors';

const router = Router();
router.use(authMiddleware);

const OCR_JOB_TTL_MINUTES = 30;

const confirmSchema = z.object({
  serviceName: z.string().min(1).max(255),
  amount: z.number().positive(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  nextPaymentDate: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  memo: z.string().optional(),
});

// POST /subscription-ocr-jobs
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw Errors.validation('ファイルをアップロードしてください');

    const expiresAt = new Date(Date.now() + OCR_JOB_TTL_MINUTES * 60 * 1000);
    const job = await prisma.subscriptionOcrJob.create({
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

// GET /subscription-ocr-jobs/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.subscriptionOcrJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) throw Errors.notFound('OCRジョブ');
    if (job.expiresAt < new Date() && job.status !== 'confirmed') {
      throw Errors.validation('OCRジョブの有効期限が切れています');
    }
    sendSuccess(res, {
      status: job.status,
      extractedServiceName: job.extractedServiceName,
      extractedAmount: job.extractedAmount ? Number(job.extractedAmount) : null,
      extractedBillingCycle: job.extractedBillingCycle,
      extractedNextPaymentDate: job.extractedNextPaymentDate,
      rawText: job.rawText,
      expiresAt: job.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /subscription-ocr-jobs/:id/confirm
router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation('入力値が不正です', parsed.error.errors);

    const job = await prisma.subscriptionOcrJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) throw Errors.notFound('OCRジョブ');
    if (job.status === 'confirmed') throw Errors.validation('このジョブはすでに確定済みです');
    if (job.expiresAt < new Date()) throw Errors.validation('OCRジョブの有効期限が切れています');

    const { categoryId, nextPaymentDate, ...rest } = parsed.data;
    const baseDate = new Date(nextPaymentDate);
    const resolvedDate = rest.status === 'active'
      ? advanceNextPaymentDateToCurrentOrFuture(baseDate, rest.billingCycle)
      : baseDate;

    const result = await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          userId: req.user!.userId,
          categoryId: categoryId ?? null,
          nextPaymentDate: resolvedDate,
          sourceType: 'ocr',
          ...rest,
        },
      });
      await tx.subscriptionOcrJob.update({
        where: { id: job.id },
        data: { status: 'confirmed', rawText: null, confirmedAt: new Date() },
      });
      return subscription;
    });

    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
});

// DELETE /subscription-ocr-jobs/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.subscriptionOcrJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) throw Errors.notFound('OCRジョブ');
    await prisma.subscriptionOcrJob.delete({ where: { id: job.id } });
    sendSuccess(res, { message: 'OCRジョブを削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
