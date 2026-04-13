'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { transactionsApi } from '@/api/transactions';
import { subscriptionsApi } from '@/api/subscriptions';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CreditCard,
  ReceiptText,
  Settings,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ComparisonMetric = 'expense' | 'income' | 'balance';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

function formatSignedCurrency(amount: number): string {
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
}

function getComparisonStyle(metric: ComparisonMetric, diff: number): string {
  if (diff === 0) return 'text-foreground';

  if (metric === 'expense') {
    return diff > 0 ? 'text-destructive' : 'text-green-600';
  }

  return diff > 0 ? 'text-green-600' : 'text-destructive';
}

function MonthlyComparison({
  metric,
  current,
  previous,
}: {
  metric: ComparisonMetric;
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  const comparisonClassName = getComparisonStyle(metric, diff);
  const Icon = diff === 0 ? ArrowRightIcon : diff > 0 ? ArrowUpIcon : ArrowDownIcon;

  if (diff === 0) {
    return (
      <p className={cn('flex items-center gap-1 text-xs', comparisonClassName)}>
        <Icon className="h-3.5 w-3.5" />
        先月から変動なし
      </p>
    );
  }

  const rateText =
    previous === 0
      ? '先月が¥0のため増減率なし'
      : `(${diff > 0 ? '+' : ''}${((diff / previous) * 100).toFixed(1)}%)`;

  return (
    <p className={cn('flex items-center gap-1 text-xs', comparisonClassName)}>
      <Icon className="h-3.5 w-3.5" />
      先月比 {formatSignedCurrency(diff)} {rateText}
    </p>
  );
}

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
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const previousMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM');
  const currentMonth = summary?.grouped.find((item) => item.period === currentMonthKey);
  const previousMonth = summary?.grouped.find((item) => item.period === previousMonthKey);

  const currentExpense = currentMonth?.expense ?? 0;
  const previousExpense = previousMonth?.expense ?? 0;
  const currentIncome = currentMonth?.income ?? 0;
  const previousIncome = previousMonth?.income ?? 0;
  const currentBalance = currentIncome - currentExpense;
  const previousBalance = previousIncome - previousExpense;

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
              {formatCurrency(currentExpense)}
            </div>
            <MonthlyComparison
              metric="expense"
              current={currentExpense}
              previous={previousExpense}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の収入</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(currentIncome)}
            </div>
            <MonthlyComparison
              metric="income"
              current={currentIncome}
              previous={previousIncome}
            />
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
                currentBalance >= 0 ? 'text-green-600' : 'text-destructive'
              }`}
            >
              {formatCurrency(currentBalance)}
            </div>
            <MonthlyComparison
              metric="balance"
              current={currentBalance}
              previous={previousBalance}
            />
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

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">クイックアクション</h2>
          <p className="text-sm text-muted-foreground">
            よく使う入力フォームへ直接移動できます。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                手動で取引追加
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/transactions?action=manual">取引フォームへ</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ReceiptText className="h-4 w-4" />
                レシート読み取り
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/transactions?action=receipt">OCRフォームへ</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                サブスク追加
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/subscriptions?action=new">サブスクフォームへ</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                カテゴリ設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings?section=categories">設定へ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

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
