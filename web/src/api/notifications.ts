import { apiClient } from './client';
import { ApiResponse } from '@/types/api';
import { Notification, NotificationFilters } from '@/types/notification';

export const notificationsApi = {
  getAll: async (filters?: NotificationFilters): Promise<ApiResponse<Notification[]> & { meta?: { unreadCount: number } }> => {
    const response = await apiClient.get('/notifications', { params: filters });
    return response.data;
  },

  markAsRead: async (id: string): Promise<ApiResponse<Notification>> => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post('/notifications/read-all');
    return response.data;
  },
};
