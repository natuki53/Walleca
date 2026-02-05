'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { subscriptionsApi } from '@/api/subscriptions';
import { SubscriptionForm, SubscriptionFormData } from '@/components/subscriptions/SubscriptionForm';
import { SubscriptionList } from '@/components/subscriptions/SubscriptionList';
import { toast } from '@/hooks/useToast';
import { BillingCycle, CreateSubscriptionInput, SubscriptionStatus } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function toCreateInput(data: SubscriptionFormData): CreateSubscriptionInput {
  const category = data.category?.trim();
  const memo = data.memo?.trim();

  return {
    serviceName: data.serviceName.trim(),
    amount: data.amount,
    billingCycle: data.billingCycle,
    nextPaymentDate: data.nextPaymentDate,
    status: data.status,
    ...(category && { category }),
    ...(memo && { memo }),
  };
}

function toMonthlyAmount(amount: number, cycle: BillingCycle): number {
  return cycle === 'yearly' ? amount / 12 : amount;
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [billingCycleFilter, setBillingCycleFilter] = useState<'all' | BillingCycle>('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', { statusFilter, billingCycleFilter, categoryFilter }],
    queryFn: () =>
      subscriptionsApi.getAll({
        limit: 100,
        sortBy: 'nextPaymentDate',
        sortOrder: 'asc',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(billingCycleFilter !== 'all' && { billingCycle: billingCycleFilter }),
        ...(categoryFilter.trim() && { category: categoryFilter.trim() }),
      }),
  });

  const summaryStatus = statusFilter === 'all' ? undefined : statusFilter;
  const { data: summaryResponse } = useQuery({
    queryKey: ['subscriptions', 'summary', summaryStatus],
    queryFn: () =>
      subscriptionsApi.getSummary(
        summaryStatus ? { status: summaryStatus } : undefined
      ),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSubscriptionInput) => subscriptionsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'サブスクを追加しました' });
    },
    onError: () => {
      toast({ title: '追加に失敗しました', variant: 'destructive' });
    },
  });

  const subscriptions = useMemo(() => data?.data ?? [], [data?.data]);
  const summary = summaryResponse?.data;

  const filteredMonthlyTotal = useMemo(() => {
    return subscriptions.reduce((sum, subscription) => {
      return sum + toMonthlyAmount(subscription.amount, subscription.billingCycle);
    }, 0);
  }, [subscriptions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">サブスク</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          サブスクを追加
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">表示中の件数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.meta?.total ?? subscriptions.length}件</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">表示中の月額換算</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(filteredMonthlyTotal)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">集計月額</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary?.monthlyTotal || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">集計年額</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary?.yearlyTotal || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">状態</p>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as 'all' | SubscriptionStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="active">有効</SelectItem>
                  <SelectItem value="paused">停止</SelectItem>
                  <SelectItem value="cancelled">解約</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">支払周期</p>
              <Select
                value={billingCycleFilter}
                onValueChange={(value) =>
                  setBillingCycleFilter(value as 'all' | BillingCycle)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="monthly">月額</SelectItem>
                  <SelectItem value="yearly">年額</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">カテゴリ</p>
              <Input
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="動画配信"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStatusFilter('all');
                  setBillingCycleFilter('all');
                  setCategoryFilter('');
                }}
              >
                フィルタをリセット
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>カテゴリ別（月額換算）</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.byCategory?.length ? (
            <div className="space-y-2">
              {summary.byCategory.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span>{item.category}</span>
                  <span className="font-medium">{formatCurrency(item.monthlyAmount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">データがありません</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>今後7日以内の支払い予定</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.upcomingPayments?.length ? (
            <div className="space-y-2">
              {summary.upcomingPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{payment.serviceName}</p>
                    <p className="text-muted-foreground">
                      {new Date(payment.nextPaymentDate).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">直近の支払い予定はありません</p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">読み込み中...</div>
      ) : (
        <SubscriptionList subscriptions={subscriptions} />
      )}

      <SubscriptionForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={async (formData) => {
          await createMutation.mutateAsync(toCreateInput(formData));
        }}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
