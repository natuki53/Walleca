import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination, parseSort, parseDateRange } from '../utils/pagination';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator';
import { TransactionType } from '@prisma/client';

export class TransactionController {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);
      const { field: sortBy, order: sortOrder } = parseSort(
        req,
        ['transactionDate', 'amount', 'createdAt', 'merchant'],
        'transactionDate'
      );
      const { from, to } = parseDateRange(req);
      const type = req.query.type as TransactionType | undefined;
      const merchant = req.query.merchant as string | undefined;

      const { transactions, total } = await transactionService.list(
        req.user!.userId,
        { page, limit, skip, sortBy, sortOrder, type, from, to, merchant }
      );

      sendPaginated(res, transactions, createPaginationMeta(page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request<{}, {}, CreateTransactionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = await transactionService.create(
        req.user!.userId,
        req.body
      );
      sendSuccess(res, transaction, 201);
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
      const transaction = await transactionService.getById(
        req.user!.userId,
        req.params.id
      );
      sendSuccess(res, transaction);
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, {}, UpdateTransactionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = await transactionService.update(
        req.user!.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, transaction);
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
      await transactionService.delete(req.user!.userId, req.params.id);
      sendSuccess(res, { message: '取引を削除しました' });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { from, to } = parseDateRange(req);
      const groupBy = req.query.groupBy as 'day' | 'week' | 'month' | 'year' | 'type' | undefined;

      const summary = await transactionService.getSummary(
        req.user!.userId,
        { from, to, groupBy }
      );
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}

export const transactionController = new TransactionController();
