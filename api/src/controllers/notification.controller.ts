import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess, sendPaginated, createPaginationMeta } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { NotificationType } from '@prisma/client';

export class NotificationController {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req);
      const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;
      const type = req.query.type as NotificationType | undefined;

      const { notifications, total, unreadCount } = await notificationService.list(
        req.user!.userId,
        { page, limit, skip, isRead, type }
      );

      res.json({
        success: true,
        data: notifications,
        meta: {
          ...createPaginationMeta(page, limit, total),
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const notification = await notificationService.markAsRead(
        req.user!.userId,
        req.params.id
      );
      sendSuccess(res, notification);
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await notificationService.markAllAsRead(req.user!.userId);
      sendSuccess(res, { message: `${result.count}件の通知を既読にしました` });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
