'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isSameYear,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { transactionsApi } from '@/api/transactions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TransactionSummaryGroupBy } from '@/types/transaction';

type ViewMode = 'all' | 'expense' | 'income';
type CalendarView = 'day' | 'week' | 'month' | 'year';
type PeriodSummary = { expense: number; income: number };

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const CALENDAR_VIEWS: Array<{ value: CalendarView; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];
const VIEW_MODE_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'all', label: '全て' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' },
];
const WEEK_OPTIONS = { weekStartsOn: 0 as const };

function formatCurrency(amount: number): string {
  if (amount === 0) return '';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

function formatCompactAmount(amount: number): string {
  if (amount === 0) return '';
  return new Intl.NumberFormat('ja-JP').format(amount);
}

function getPeriodConfig(date: Date, calendarView: CalendarView): {
  from: Date;
  to: Date;
  groupBy: TransactionSummaryGroupBy;
} {
  switch (calendarView) {
    case 'day':
      return { from: date, to: date, groupBy: 'day' };
    case 'week':
      return {
        from: startOfWeek(date, WEEK_OPTIONS),
        to: endOfWeek(date, WEEK_OPTIONS),
        groupBy: 'day',
      };
    case 'year':
      return {
        from: startOfYear(date),
        to: endOfYear(date),
        groupBy: 'month',
      };
    case 'month':
    default:
      return {
        from: startOfMonth(date),
        to: endOfMonth(date),
        groupBy: 'day',
      };
  }
}

function getHeadingLabel(date: Date, calendarView: CalendarView): string {
  switch (calendarView) {
    case 'day':
      return format(date, 'yyyy年M月d日 (E)', { locale: ja });
    case 'week': {
      const start = startOfWeek(date, WEEK_OPTIONS);
      const end = endOfWeek(date, WEEK_OPTIONS);
      return `${format(start, 'yyyy年M月d日', { locale: ja })} - ${format(end, 'M月d日', { locale: ja })}`;
    }
    case 'year':
      return format(date, 'yyyy年', { locale: ja });
    case 'month':
    default:
      return format(date, 'yyyy年M月', { locale: ja });
  }
}

function getCurrentButtonLabel(calendarView: CalendarView): string {
  switch (calendarView) {
    case 'day':
      return '今日';
    case 'week':
      return '今週';
    case 'year':
      return '今年';
    case 'month':
    default:
      return '今月';
  }
}

function isCurrentPeriod(date: Date, calendarView: CalendarView): boolean {
  const now = new Date();
  switch (calendarView) {
    case 'day':
      return isSameDay(date, now);
    case 'week':
      return isSameDay(startOfWeek(date, WEEK_OPTIONS), startOfWeek(now, WEEK_OPTIONS));
    case 'year':
      return isSameYear(date, now);
    case 'month':
    default:
      return isSameMonth(date, now);
  }
}

function shiftPeriod(date: Date, calendarView: CalendarView, direction: -1 | 1): Date {
  switch (calendarView) {
    case 'day':
      return addDays(date, direction);
    case 'week':
      return addWeeks(date, direction);
    case 'year':
      return addYears(date, direction);
    case 'month':
    default:
      return addMonths(date, direction);
  }
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [calendarView, setCalendarView] = useState<CalendarView>('month');

  const { from, to, groupBy } = getPeriodConfig(currentDate, calendarView);

  const { data, isLoading } = useQuery({
    queryKey: [
      'transactions',
      'summary',
      'calendar',
      calendarView,
      format(from, 'yyyy-MM-dd'),
      format(to, 'yyyy-MM-dd'),
      groupBy,
    ],
    queryFn: () => transactionsApi.getSummary({
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
      groupBy,
    }),
  });

  const groupedMap = new Map<string, PeriodSummary>();
  for (const g of data?.data?.grouped ?? []) {
    groupedMap.set(g.period, { expense: g.expense, income: g.income });
  }

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, WEEK_OPTIONS),
    end: endOfWeek(currentDate, WEEK_OPTIONS),
  });
  const yearMonths = eachMonthOfInterval({
    start: startOfYear(currentDate),
    end: endOfYear(currentDate),
  });
  const startWeekday = getDay(startOfMonth(currentDate));

  const prevPeriod = () => setCurrentDate((date) => shiftPeriod(date, calendarView, -1));
  const nextPeriod = () => setCurrentDate((date) => shiftPeriod(date, calendarView, 1));
  const goToToday = () => setCurrentDate(new Date());

  const summary = data?.data?.summary;
  const totalExpense = summary?.expense.total ?? 0;
  const totalIncome = summary?.income.total ?? 0;

  const getDisplayAmounts = (periodSummary?: PeriodSummary) => {
    if (!periodSummary) {
      return { expense: 0, income: 0 };
    }
    return periodSummary;
  };

  const renderSummaryAmounts = (
    amounts: PeriodSummary,
    options?: {
      compact?: boolean;
      stacked?: boolean;
      zeroFallback?: boolean;
    }
  ) => {
    const { compact = false, stacked = false, zeroFallback = false } = options ?? {};
    const formatAmount = compact ? formatCompactAmount : formatCurrency;
    const expenseText = formatAmount(amounts.expense);
    const incomeText = formatAmount(amounts.income);

    if (viewMode === 'expense') {
      return (
        <span className="text-destructive">
          {expenseText || (zeroFallback ? '¥0' : '')}
        </span>
      );
    }

    if (viewMode === 'income') {
      return (
        <span className="text-green-600">
          {incomeText || (zeroFallback ? '¥0' : '')}
        </span>
      );
    }

    const hasExpense = amounts.expense > 0;
    const hasIncome = amounts.income > 0;

    if (!hasExpense && !hasIncome) {
      return zeroFallback ? <span className="text-muted-foreground">¥0</span> : null;
    }

    return (
      <div className={cn('flex gap-2', stacked && 'flex-col gap-1')}>
        {hasExpense && (
          <span className="text-destructive">
            {compact ? '支' : '支出'} {expenseText}
          </span>
        )}
        {hasIncome && (
          <span className="text-green-600">
            {compact ? '収' : '収入'} {incomeText}
          </span>
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const key = format(currentDate, 'yyyy-MM-dd');
    const amounts = getDisplayAmounts(groupedMap.get(key));
    const title = viewMode === 'all' ? '支出・収入' : viewMode === 'expense' ? '支出' : '収入';

    return (
      <div className="rounded-lg border bg-background p-6">
        <p className="text-sm text-muted-foreground">
          {format(currentDate, 'M月d日 (E)', { locale: ja })} の{title}
        </p>
        <div className="mt-3 text-3xl font-bold">
          {renderSummaryAmounts(amounts, { stacked: true, zeroFallback: true })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => (
    <>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-medium py-1',
              i === 0 && 'text-red-500',
              i === 6 && 'text-blue-500',
            )}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const amounts = getDisplayAmounts(groupedMap.get(key));
          const weekday = getDay(day);

          return (
            <div
              key={key}
              className={cn(
                'bg-background min-h-28 p-3 flex flex-col',
                isToday(day) && 'bg-primary/5',
              )}
            >
              <span className={cn(
                'text-sm font-medium',
                isToday(day) && 'text-primary font-bold',
                weekday === 0 && 'text-red-500',
                weekday === 6 && 'text-blue-500',
              )}>
                {format(day, 'M/d')}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {format(day, 'E', { locale: ja })}
              </span>
              <div className="mt-auto text-sm font-semibold">
                {renderSummaryAmounts(amounts, { stacked: true, zeroFallback: true })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderMonthView = () => (
    <>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-medium py-1',
              i === 0 && 'text-red-500',
              i === 6 && 'text-blue-500',
            )}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {Array.from({ length: startWeekday }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-background h-20" />
        ))}
        {monthDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const amounts = getDisplayAmounts(groupedMap.get(key));
          const weekday = getDay(day);
          const shouldShowAmount =
            viewMode === 'all'
              ? amounts.expense > 0 || amounts.income > 0
              : amounts[viewMode] > 0;

          return (
            <div
              key={key}
              className={cn(
                'bg-background h-20 p-2 flex flex-col',
                isToday(day) && 'bg-primary/5',
              )}
            >
              <span className={cn(
                'text-xs font-medium',
                isToday(day) && 'text-primary font-bold',
                weekday === 0 && 'text-red-500',
                weekday === 6 && 'text-blue-500',
              )}>
                {format(day, 'd')}
              </span>
              {shouldShowAmount && (
                <div className="mt-auto text-[11px] leading-tight">
                  {renderSummaryAmounts(amounts, { compact: true, stacked: true })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderYearView = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {yearMonths.map((month) => {
        const key = format(month, 'yyyy-MM');
        const amounts = getDisplayAmounts(groupedMap.get(key));

        return (
          <div
            key={key}
            className={cn(
              'rounded-lg border bg-background p-4',
              isSameMonth(month, new Date()) && 'border-primary/50 bg-primary/5',
            )}
          >
            <p className="text-sm font-medium">{format(month, 'M月', { locale: ja })}</p>
            <div className="mt-3 text-2xl font-bold">
              {renderSummaryAmounts(amounts, { stacked: true, zeroFallback: true })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">カレンダー</h1>
          <p className="text-sm text-muted-foreground">日・週・月・年で表示期間を切り替えできます。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CALENDAR_VIEWS.map((view) => (
            <Button
              key={view.value}
              size="sm"
              variant={calendarView === view.value ? 'default' : 'outline'}
              onClick={() => setCalendarView(view.value)}
            >
              {view.label}
            </Button>
          ))}
        </div>
        <div className="w-full sm:w-40">
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <SelectTrigger aria-label="表示種別">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEW_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">表示期間の支出</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">
              {isLoading ? '---' : formatCurrency(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">表示期間の収入</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">
              {isLoading ? '---' : formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                {getHeadingLabel(currentDate, calendarView)}
              </span>
              {!isCurrentPeriod(currentDate, calendarView) && (
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {getCurrentButtonLabel(calendarView)}
                </Button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={nextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {calendarView === 'day' && renderDayView()}
          {calendarView === 'week' && renderWeekView()}
          {calendarView === 'month' && renderMonthView()}
          {calendarView === 'year' && renderYearView()}
        </CardContent>
      </Card>
    </div>
  );
}
