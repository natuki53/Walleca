import { advanceNextPaymentDateToCurrentOrFuture } from '@/utils/subscription-date';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('advanceNextPaymentDateToCurrentOrFuture', () => {
  test('keeps current date when payment date is today', () => {
    const nextPaymentDate = new Date('2026-02-05');
    const referenceDate = new Date('2026-02-05');

    const result = advanceNextPaymentDateToCurrentOrFuture(
      nextPaymentDate,
      'monthly',
      referenceDate
    );

    expect(toIsoDate(result)).toBe('2026-02-05');
  });

  test('advances monthly payment date to the nearest future cycle', () => {
    const nextPaymentDate = new Date('2025-11-10');
    const referenceDate = new Date('2026-02-05');

    const result = advanceNextPaymentDateToCurrentOrFuture(
      nextPaymentDate,
      'monthly',
      referenceDate
    );

    expect(toIsoDate(result)).toBe('2026-02-10');
  });

  test('advances yearly payment date to the nearest future cycle', () => {
    const nextPaymentDate = new Date('2023-04-15');
    const referenceDate = new Date('2026-02-05');

    const result = advanceNextPaymentDateToCurrentOrFuture(
      nextPaymentDate,
      'yearly',
      referenceDate
    );

    expect(toIsoDate(result)).toBe('2026-04-15');
  });

  test('preserves end-of-month anchor day for monthly subscriptions', () => {
    const nextPaymentDate = new Date('2025-01-31');
    const referenceDate = new Date('2025-03-01');

    const result = advanceNextPaymentDateToCurrentOrFuture(
      nextPaymentDate,
      'monthly',
      referenceDate
    );

    expect(toIsoDate(result)).toBe('2025-03-31');
  });
});
