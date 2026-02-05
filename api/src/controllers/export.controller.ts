import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service';
import { ExportTransactionsInput, ExportSubscriptionsInput } from '../validators/export.validator';

export class ExportController {
  async exportTransactions(
    req: Request<{}, {}, ExportTransactionsInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { from, to, type, format } = req.body;

      const result = await exportService.exportTransactions(req.user!.userId, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        type,
        format,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      next(error);
    }
  }

  async exportSubscriptions(
    req: Request<{}, {}, ExportSubscriptionsInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status, format } = req.body;

      const result = await exportService.exportSubscriptions(req.user!.userId, {
        status,
        format,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      next(error);
    }
  }
}

export const exportController = new ExportController();
