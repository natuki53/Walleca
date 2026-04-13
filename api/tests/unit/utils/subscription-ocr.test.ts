import { inferSubscriptionFields } from '@/utils/subscription-ocr';

describe('inferSubscriptionFields', () => {
  test('picks monthly amount and next payment date from subscription-style OCR text', () => {
    const text = [
      'Spotify Premium',
      'ご利用中のプラン',
      '月額料金 ¥980',
      '次回請求日 2026/05/12',
      '登録日 2025/11/12',
      'お問い合わせ 03-1234-5678',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'Spotify Premium',
      date: new Date('2025-11-12'),
      total: 980,
    });

    expect(result.serviceName).toBe('Spotify Premium');
    expect(result.amount).toBe(980);
    expect(result.billingCycle).toBe('monthly');
    expect(result.nextPaymentDate?.toISOString().slice(0, 10)).toBe('2026-05-12');
  });

  test('avoids choosing signup date as next payment date', () => {
    const text = [
      'Example Service',
      '開始日 2025/01/15',
      '料金 $9.99 / month',
      'お問い合わせ番号 2026',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'Example Service',
      date: new Date('2025-01-15'),
      total: 9.99,
    });

    expect(result.amount).toBe(9.99);
    expect(result.billingCycle).toBe('monthly');
    expect(result.nextPaymentDate).toBeNull();
  });

  test('avoids selecting support numbers as amount', () => {
    const text = [
      'Acme Cloud',
      'Customer ID 12345678',
      'Users 25',
      'Annual plan',
      'Price USD 120.00 / year',
      'Started 2025/06/01',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'Acme Cloud',
      date: new Date('2025-06-01'),
      total: 120,
    });

    expect(result.amount).toBe(120);
    expect(result.billingCycle).toBe('yearly');
  });

  test('prefers actual service name over billing metadata lines', () => {
    const text = [
      'ご利用明細',
      '注文番号 A12B34C56',
      'YouTube Premium',
      '月額料金 ¥1,280',
      '次回請求日 2026/06/20',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: null,
      date: new Date('2026-05-20'),
      total: 1280,
    });

    expect(result.serviceName).toBe('YouTube Premium');
  });

  test('normalizes known service aliases with dictionary entries', () => {
    const text = [
      'OpenAI ChatGPT Plus',
      'Monthly price USD 20.00',
      'Next billing date 2026/06/20',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'OpenAI ChatGPT Plus',
      date: new Date('2026-05-20'),
      total: 20,
    });

    expect(result.serviceName).toBe('ChatGPT Plus');
    expect(result.amount).toBe(20);
  });

  test('extracts next payment date from english month-name format', () => {
    const text = [
      'Notion AI',
      'Monthly plan',
      'Price USD 10.00',
      'Next billing date May 12, 2026',
      'Started Apr 12, 2026',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'Notion AI',
      date: new Date('2026-04-12'),
      total: 10,
    });

    expect(result.billingCycle).toBe('monthly');
    expect(result.nextPaymentDate?.toISOString().slice(0, 10)).toBe('2026-05-12');
  });

  test('extracts suffix USD subscription amount', () => {
    const text = [
      'Figma Professional',
      'Monthly plan',
      'Price 15.00 USD / month',
      'Next billing date May 12, 2026',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'Figma Professional',
      date: new Date('2026-04-12'),
      total: null,
    });

    expect(result.amount).toBe(15);
    expect(result.billingCycle).toBe('monthly');
  });

  test('does not treat leading 1 in Japanese per-month billing copy as USD amount', () => {
    const text = [
      'ChatGPT Plus Subscription',
      '1カ月ごとに $20.00',
      'サービスは 2026年5月5日に終了します。',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'ChatGPT Plus Subscription',
      date: new Date('2026-04-13'),
      total: null,
    });

    expect(result.amount).toBe(20);
    expect(result.amountCurrencyHint).toBe('USD');
  });

  test('infers USD when dollar sign is missing from OCR but billing line is Stripe-style', () => {
    const text = [
      'ChatGPT Plus Subscription',
      '1カ月ごとに 20.00',
      'サービスは 2026年5月5日に終了します。',
    ].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'ChatGPT Plus Subscription',
      date: new Date('2026-04-13'),
      total: null,
    });

    expect(result.amount).toBe(20);
    expect(result.amountCurrencyHint).toBe('USD');
  });

  test('marks yen subscription line as JPY hint for conversion logic', () => {
    const text = ['Spotify', '月額料金 ¥980', '次回請求日 2026/05/12'].join('\n');

    const result = inferSubscriptionFields(text, {
      rawText: text,
      merchant: 'Spotify',
      date: new Date('2025-11-12'),
      total: 980,
    });

    expect(result.amount).toBe(980);
    expect(result.amountCurrencyHint).toBe('JPY');
  });
});
