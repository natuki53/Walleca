import { BillingCycle } from '@prisma/client';

const MONTHS_IN_YEAR = 12;

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

function getDaysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addMonthsWithAnchorDay(date: Date, months: number, anchorDay: number): Date {
  const totalMonths = (date.getUTCFullYear() * MONTHS_IN_YEAR) + date.getUTCMonth() + months;
  const targetYear = Math.floor(totalMonths / MONTHS_IN_YEAR);
  const targetMonth = totalMonths - (targetYear * MONTHS_IN_YEAR);
  const maxDay = getDaysInUtcMonth(targetYear, targetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(anchorDay, maxDay)));
}

export function getCurrentUtcDate(): Date {
  return toUtcDateOnly(new Date());
}

export function addUtcDays(date: Date, days: number): Date {
  const normalized = toUtcDateOnly(date);
  normalized.setUTCDate(normalized.getUTCDate() + days);
  return normalized;
}

export function advanceNextPaymentDateToCurrentOrFuture(
  nextPaymentDate: Date,
  billingCycle: BillingCycle,
  referenceDate: Date = getCurrentUtcDate()
): Date {
  const today = toUtcDateOnly(referenceDate);
  const anchorDay = nextPaymentDate.getUTCDate();
  let adjustedDate = toUtcDateOnly(nextPaymentDate);

  while (adjustedDate < today) {
    adjustedDate = addMonthsWithAnchorDay(
      adjustedDate,
      billingCycle === 'yearly' ? MONTHS_IN_YEAR : 1,
      anchorDay
    );
  }

  return adjustedDate;
}
