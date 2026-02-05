'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Subscription, SubscriptionStatus, UpdateSubscriptionInput } from '@/types/subscription';
import { subscriptionsApi } from '@/api/subscriptions';
import { toast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SubscriptionForm, SubscriptionFormData } from './SubscriptionForm';

interface SubscriptionListProps {
  subscriptions: Subscription[];
}

const statusLabels: Record<SubscriptionStatus, string> = {
  active: '有効',
  paused: '停止',
  cancelled: '解約',
};

const statusVariants: Record<SubscriptionStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-muted text-muted-foreground',
};

const cycleLabels = {
  monthly: '月額',
  yearly: '年額',
};

function toUpdateInput(data: SubscriptionFormData): UpdateSubscriptionInput {
  const category = data.category?.trim();
  const memo = data.memo?.trim();

  return {
    serviceName: data.serviceName.trim(),
    amount: data.amount,
    billingCycle: data.billingCycle,
    nextPaymentDate: data.nextPaymentDate,
    status: data.status,
    category: category ? category : null,
    memo: memo ? memo : null,
  };
}

export function SubscriptionList({ subscriptions }: SubscriptionListProps) {
  const queryClient = useQueryClient();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubscriptionInput }) =>
      subscriptionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'サブスクを更新しました' });
    },
    onError: () => {
      toast({ title: '更新に失敗しました', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'サブスクを削除しました' });
    },
    onError: () => {
      toast({ title: '削除に失敗しました', variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          サブスクがありません
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {subscriptions.map((subscription) => (
          <Card key={subscription.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{subscription.serviceName}</p>
                    <Badge className={statusVariants[subscription.status]}>
                      {statusLabels[subscription.status]}
                    </Badge>
                    <Badge variant="outline">{cycleLabels[subscription.billingCycle]}</Badge>
                    {subscription.category && (
                      <Badge variant="outline">{subscription.category}</Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    次回支払日:{' '}
                    {format(new Date(subscription.nextPaymentDate), 'yyyy年M月d日', {
                      locale: ja,
                    })}
                  </p>

                  {subscription.memo && (
                    <p className="text-sm text-muted-foreground">{subscription.memo}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatCurrency(subscription.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.billingCycle === 'monthly' ? '/ 月' : '/ 年'}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingSubscription(subscription)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingSubscription(subscription)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingSubscription && (
        <SubscriptionForm
          open={!!editingSubscription}
          onClose={() => setEditingSubscription(null)}
          subscription={editingSubscription}
          onSubmit={async (data) => {
            await updateMutation.mutateAsync({
              id: editingSubscription.id,
              data: toUpdateInput(data),
            });
          }}
          isLoading={updateMutation.isPending}
        />
      )}

      <AlertDialog
        open={!!deletingSubscription}
        onOpenChange={() => setDeletingSubscription(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>サブスクを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingSubscription) {
                  deleteMutation.mutate(deletingSubscription.id);
                  setDeletingSubscription(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
