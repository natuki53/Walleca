export type NotificationType = 'subscription_reminder' | 'system' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  relatedId: string | null;
  isRead: boolean;
  scheduledAt: string | null;
  createdAt: string;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
}
