import { Request, Response, NextFunction } from 'express';
import { receiptService } from '../services/receipt.service';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination, parseSort, parseDateRange } from '../utils/pagination';
import { UpdateReceiptInput, ConfirmReceiptInput } from '../validators/receipt.validator';
import { OcrStatus } from '@prisma/client';
import { Errors } from '../utils/errors';

export class ReceiptController {
  async upload(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw Errors.validation('ファイルがアップロードされていません');
      }

      const receipt = await receiptService.upload(req.user!.userId, req.file);
      sendSuccess(res, receipt, 201);
    } catch (error) {
      next(error);
    }
  }

  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);
      const { field: sortBy, order: sortOrder } = parseSort(
        req,
        ['createdAt', 'ocrStatus', 'extractedDate'],
        'createdAt'
      );
      const { from, to } = parseDateRange(req);
      const ocrStatus = req.query.ocrStatus as OcrStatus | undefined;

      const { receipts, total } = await receiptService.list(
        req.user!.userId,
        { page, limit, skip, sortBy, sortOrder, ocrStatus, from, to }
      );

      sendPaginated(res, receipts, createPaginationMeta(page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const receipt = await receiptService.getById(
        req.user!.userId,
        req.params.id
      );
      sendSuccess(res, receipt);
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, {}, UpdateReceiptInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const receipt = await receiptService.update(
        req.user!.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, receipt);
    } catch (error) {
      next(error);
    }
  }

  async retryOcr(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const receipt = await receiptService.retryOcr(
        req.user!.userId,
        req.params.id
      );
      sendSuccess(res, receipt);
    } catch (error) {
      next(error);
    }
  }

  async delete(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await receiptService.delete(req.user!.userId, req.params.id);
      sendSuccess(res, { message: 'レシートを削除しました' });
    } catch (error) {
      next(error);
    }
  }

  async confirm(
    req: Request<{ id: string }, {}, ConfirmReceiptInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = await receiptService.confirm(
        req.user!.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, transaction, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const receiptController = new ReceiptController();
