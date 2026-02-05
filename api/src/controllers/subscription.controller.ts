import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscription.service';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination, parseSort } from '../utils/pagination';
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '../validators/subscription.validator';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';

export class SubscriptionController {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);
      const { field: sortBy, order: sortOrder } = parseSort(
        req,
        ['nextPaymentDate', 'amount', 'serviceName', 'createdAt'],
        'nextPaymentDate',
        'asc'
      );
      const status = req.query.status as SubscriptionStatus | undefined;
      const billingCycle = req.query.billingCycle as BillingCycle | undefined;
      const category = req.query.category as string | undefined;

      const { subscriptions, total } = await subscriptionService.list(
        req.user!.userId,
        { page, limit, skip, sortBy, sortOrder, status, billingCycle, category }
      );

      sendPaginated(res, subscriptions, createPaginationMeta(page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request<{}, {}, CreateSubscriptionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscription = await subscriptionService.create(
        req.user!.userId,
        req.body
      );
      sendSuccess(res, subscription, 201);
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
      const subscription = await subscriptionService.getById(
        req.user!.userId,
        req.params.id
      );
      sendSuccess(res, subscription);
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, {}, UpdateSubscriptionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscription = await subscriptionService.update(
        req.user!.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, subscription);
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
      await subscriptionService.delete(req.user!.userId, req.params.id);
      sendSuccess(res, { message: 'サブスクリプションを削除しました' });
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
      const status = req.query.status as SubscriptionStatus | undefined;

      const summary = await subscriptionService.getSummary(
        req.user!.userId,
        { status }
      );
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();
