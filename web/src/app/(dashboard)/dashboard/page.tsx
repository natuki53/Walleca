'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { transactionsApi } from '@/api/transactions';
import { subscriptionsApi } from '@/api/subscriptions';
import { ArrowDownIcon, ArrowUpIcon, CreditCard, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { data: transactionSummary } = useQuery({
    queryKey: ['transactions', 'summary'],
    queryFn: () => transactionsApi.getSummary({ groupBy: 'month' }),
  });

  const { data: subscriptionSummary } = useQuery({
    queryKey: ['subscriptions', 'summary'],
    queryFn: () => subscriptionsApi.getSummary(),
  });

  const summary = transactionSummary?.data;
  const subSummary = subscriptionSummary?.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の支出</CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(summary?.summary.expense.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.summary.expense.count || 0}件の取引
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の収入</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.summary.income.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.summary.income.count || 0}件の取引
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">収支バランス</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (summary?.balance || 0) >= 0 ? 'text-green-600' : 'text-destructive'
              }`}
            >
              {formatCurrency(summary?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">今月の収支</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">月額サブスク</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(subSummary?.monthlyTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {subSummary?.count || 0}件のサービス
            </p>
          </CardContent>
        </Card>
      </div>

      {subSummary?.upcomingPayments && subSummary.upcomingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>今後の支払い予定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subSummary.upcomingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{payment.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.nextPaymentDate).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="font-medium">{formatCurrency(payment.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
