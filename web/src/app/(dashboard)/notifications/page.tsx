'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { notificationsApi } from '@/api/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll({ limit: 50 }),
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: 'すべて既読にしました' });
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">通知</h1>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          通知
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              未読 {unreadCount} 件
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            すべて既読
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <BellOff className="h-10 w-10 mb-3" />
            <p>通知はありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'cursor-pointer transition-colors',
                !notification.isRead && 'border-primary/50 bg-primary/5'
              )}
              onClick={() => {
                if (!notification.isRead) {
                  markReadMutation.mutate(notification.id);
                }
              }}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Bell className={cn(
                  'h-5 w-5 mt-0.5 shrink-0',
                  notification.isRead ? 'text-muted-foreground' : 'text-primary'
                )} />
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', !notification.isRead && 'text-primary')}>
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {notification.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(notification.createdAt), 'yyyy年M月d日 HH:mm', { locale: ja })}
                  </p>
                </div>
                {!notification.isRead && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
