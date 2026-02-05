import { Request, Response, NextFunction } from 'express';
import { viewService } from '../services/view.service';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { CreateViewInput, UpdateViewInput } from '../validators/view.validator';

export class ViewController {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);

      const { views, total } = await viewService.list(
        req.user!.userId,
        { page, limit, skip }
      );

      sendPaginated(res, views, createPaginationMeta(page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request<{}, {}, CreateViewInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const view = await viewService.create(req.user!.userId, req.body);
      sendSuccess(res, view, 201);
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
      const view = await viewService.getById(req.user!.userId, req.params.id);
      sendSuccess(res, view);
    } catch (error) {
      next(error);
    }
  }

  async getData(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);

      const result = await viewService.getData(
        req.user!.userId,
        req.params.id,
        { page, limit, skip }
      );

      res.json({
        success: true,
        data: result,
        meta: createPaginationMeta(page, limit, result.total),
      });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, {}, UpdateViewInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const view = await viewService.update(
        req.user!.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, view);
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
      await viewService.delete(req.user!.userId, req.params.id);
      sendSuccess(res, { message: 'ビューを削除しました' });
    } catch (error) {
      next(error);
    }
  }
}

export const viewController = new ViewController();
