import { BillingCycle } from '@prisma/client';

// 1年の月数
const MONTHS_IN_YEAR = 12;

// 日付を UTC の日付のみ（時刻 00:00:00）に正規化する
// タイムゾーンの差異による日付ずれを防ぐ
function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

// 指定した UTC 年月の日数を返す（月末日の計算に使用）
function getDaysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// 起点日から指定した月数を加算した日付を返す
// anchorDay（元の日付の日）を維持し、月末を超える場合は月末にクランプする
// 例: 1月31日 + 1ヶ月 → 2月28日（または29日）
function addMonthsWithAnchorDay(date: Date, months: number, anchorDay: number): Date {
  const totalMonths = (date.getUTCFullYear() * MONTHS_IN_YEAR) + date.getUTCMonth() + months;
  const targetYear = Math.floor(totalMonths / MONTHS_IN_YEAR);
  const targetMonth = totalMonths - (targetYear * MONTHS_IN_YEAR);
  const maxDay = getDaysInUtcMonth(targetYear, targetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(anchorDay, maxDay)));
}

// 今日の UTC 日付（時刻なし）を返す
export function getCurrentUtcDate(): Date {
  return toUtcDateOnly(new Date());
}

// 指定した UTC 日付に日数を加算した日付を返す
export function addUtcDays(date: Date, days: number): Date {
  const normalized = toUtcDateOnly(date);
  normalized.setUTCDate(normalized.getUTCDate() + days);
  return normalized;
}

// 次回支払日が過去になっている場合、現在または未来の日付になるまで繰り返し加算して返す
// billingCycle に応じて月次または年次で進める
// 登録後に時間が経過して支払日が過去になったサブスクの更新に使用する
export function advanceNextPaymentDateToCurrentOrFuture(
  nextPaymentDate: Date,
  billingCycle: BillingCycle,
  referenceDate: Date = getCurrentUtcDate()
): Date {
  const today = toUtcDateOnly(referenceDate);
  // 元の支払日の「日」を基準日として保持する（例: 毎月31日払いなど）
  const anchorDay = nextPaymentDate.getUTCDate();
  let adjustedDate = toUtcDateOnly(nextPaymentDate);

  // 今日以降になるまで 1サイクル分ずつ進める
  while (adjustedDate < today) {
    adjustedDate = addMonthsWithAnchorDay(
      adjustedDate,
      billingCycle === 'yearly' ? MONTHS_IN_YEAR : 1,
      anchorDay
    );
  }

  return adjustedDate;
}
