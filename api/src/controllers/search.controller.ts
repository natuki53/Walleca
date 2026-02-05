import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/search.service';
import { sendSuccess } from '../utils/response';
import { parsePagination } from '../utils/pagination';

export class SearchController {
  async search(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);
      const q = req.query.q as string;
      const type = (req.query.type as 'all' | 'transactions' | 'subscriptions') || 'all';

      const results = await searchService.search(
        req.user!.userId,
        { q, page, limit, skip, type }
      );

      sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();
