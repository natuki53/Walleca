import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder } from '../utils/query-builder';
import { NotificationType } from '@prisma/client';

export interface NotificationListParams {
  page: number;
  limit: number;
  skip: number;
  isRead?: boolean;
  type?: NotificationType;
}

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  relatedId: true,
  isRead: true,
  scheduledAt: true,
  createdAt: true,
};

export class NotificationService {
  async list(userId: string, params: NotificationListParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('isRead', params.isRead)
      .whereEquals('type', params.type)
      .build();

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return { notifications, total, unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw Errors.notFound('通知');
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
      select: notificationSelect,
    });

    return notification;
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  async create(
    userId: string,
    data: {
      type: NotificationType;
      title: string;
      message?: string;
      relatedId?: string;
      scheduledAt?: Date;
    }
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedId: data.relatedId,
        scheduledAt: data.scheduledAt,
      },
      select: notificationSelect,
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
