import { Request, Response, NextFunction } from 'express';
import { subscriptionCategoryService } from '../services/subscription-category.service';
import { sendSuccess } from '../utils/response';
import {
  CreateSubscriptionCategoryInput,
  UpdateSubscriptionCategoryInput,
} from '../validators/subscription-category.validator';

export class SubscriptionCategoryController {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const categories = await subscriptionCategoryService.list(req.user!.userId);
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request<{}, {}, CreateSubscriptionCategoryInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const category = await subscriptionCategoryService.create(req.user!.userId, req.body);
      sendSuccess(res, category, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, {}, UpdateSubscriptionCategoryInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const category = await subscriptionCategoryService.update(
        req.user!.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, category);
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
      const result = await subscriptionCategoryService.delete(req.user!.userId, req.params.id);
      sendSuccess(res, {
        message: 'カテゴリを削除しました',
        clearedSubscriptionCount: result.clearedSubscriptionCount,
        name: result.name,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionCategoryController = new SubscriptionCategoryController();
