'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, SlidersHorizontal, Upload } from 'lucide-react';
import { subscriptionsApi } from '@/api/subscriptions';
import { subscriptionCategoriesApi } from '@/api/subscriptionCategories';
import { SubscriptionForm, SubscriptionFormData } from '@/components/subscriptions/SubscriptionForm';
import { SubscriptionList } from '@/components/subscriptions/SubscriptionList';
import { SubscriptionUploader } from '@/components/subscriptions/SubscriptionUploader';
import { toast } from '@/hooks/useToast';
import { BillingCycle, CreateSubscriptionInput, SubscriptionStatus } from '@/types/subscription';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const searchParams = useSearchParams();
  const ocrSectionRef = useRef<HTMLDivElement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [dismissedAutoAction, setDismissedAutoAction] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [billingCycleFilter, setBillingCycleFilter] = useState<'all' | BillingCycle>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const { data: categoryResponse } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoriesApi.getAll(),
  });

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
  const categoryOptions = useMemo(
    () => (categoryResponse?.data ?? []).map((category) => category.name),
    [categoryResponse?.data]
  );
  const availableCategoryOptions = useMemo(() => {
    const fromSubscriptions = subscriptions
      .map((subscription) => subscription.category?.name?.trim() || '')
      .filter((category): category is string => category.length > 0);
    return Array.from(new Set([...categoryOptions, ...fromSubscriptions])).sort((a, b) =>
      a.localeCompare(b, 'ja')
    );
  }, [categoryOptions, subscriptions]);

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
  const activeFilterCount = [
    statusFilter !== 'all',
    billingCycleFilter !== 'all',
    Boolean(categoryFilter.trim()),
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;
  const resetFilters = () => {
    setStatusFilter('all');
    setBillingCycleFilter('all');
    setCategoryFilter('');
    setIsFilterOpen(false);
  };

  const action = searchParams?.get('action') ?? '';
  const autoOpenForm = action === 'new' && dismissedAutoAction !== action;

  useEffect(() => {
    if (action === 'ocr') {
      ocrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [action]);

  const handleCloseForm = () => {
    setIsFormOpen(false);
    if (action === 'new') {
      setDismissedAutoAction(action);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">サブスク</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            手入力とOCRを同じフローにまとめて、サブスク登録までここで完結できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setDismissedAutoAction(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            手動で追加
          </Button>
          <Button
            variant="outline"
            onClick={() => ocrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <Upload className="mr-2 h-4 w-4" />
            OCRを読み取る
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>手動入力</CardTitle>
            <CardDescription>
              契約中サービスを直接登録したい場合はこちらから入力します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
              サービス名、金額、支払周期、次回支払日を手動で登録できます。
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setDismissedAutoAction(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              サブスクフォームを開く
            </Button>
          </CardContent>
        </Card>

        <div ref={ocrSectionRef} id="subscription-ocr-upload">
          <Card>
            <CardHeader>
              <CardTitle>サブスクOCR</CardTitle>
              <CardDescription>
                アップロード後はそのまま確認画面へ進み、修正してサブスク登録できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionUploader />
            </CardContent>
          </Card>
        </div>
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
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isFilterOpen ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIsFilterOpen((prev) => !prev)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              フィルター
              {isFilterOpen ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-2 h-4 w-4" />
              )}
            </Button>
            <Badge variant={hasActiveFilters ? 'default' : 'outline'}>
              適用中 {activeFilterCount}
            </Badge>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={resetFilters}>
                フィルタをリセット
              </Button>
            )}
          </div>

          {isFilterOpen && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                <Select
                  value={categoryFilter || 'all'}
                  onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {availableCategoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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
        <SubscriptionList
          subscriptions={subscriptions}
          categoryOptions={availableCategoryOptions}
        />
      )}

      <SubscriptionForm
        open={isFormOpen || autoOpenForm}
        onClose={handleCloseForm}
        categoryOptions={availableCategoryOptions}
        onSubmit={async (formData) => {
          await createMutation.mutateAsync(toCreateInput(formData));
        }}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
