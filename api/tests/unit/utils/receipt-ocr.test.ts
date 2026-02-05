import {
  extractDate,
  extractMerchant,
  extractReceiptFields,
  extractTotal,
} from '@/utils/receipt-ocr';

describe('extractMerchant', () => {
  test('returns likely merchant name from upper lines', () => {
    const text = [
      'レシート',
      '株式会社テストストア 新宿店',
      '東京都新宿区テスト1-2-3',
      'TEL 03-1234-5678',
      '2026/01/15 13:34',
      '合計 ¥1,234',
    ].join('\n');

    expect(extractMerchant(text)).toBe('株式会社テストストア 新宿店');
  });

  test('returns null when merchant-like line is not found', () => {
    const text = [
      'レシート',
      '2026/01/15 13:34',
      '合計 ¥1,234',
      'TEL 03-1234-5678',
    ].join('\n');

    expect(extractMerchant(text)).toBeNull();
  });
});

describe('extractDate', () => {
  test('extracts YYYY/MM/DD format', () => {
    const date = extractDate('ご利用日 2026/01/15 13:34');

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(15);
  });

  test('extracts 2-digit year format', () => {
    const date = extractDate('利用日: 26-01-15');

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(15);
  });

  test('prefers transaction date over expiry date', () => {
    const date = extractDate([
      'ご利用日 2026/01/15 13:34',
      '有効期限 2026/12/31',
    ].join('\n'));

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(15);
  });

  test('supports full-width date characters', () => {
    const date = extractDate('購入日 ２０２６年０２月０３日');

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(3);
  });

  test('supports reiwa notation', () => {
    const date = extractDate('取引日 令和6年2月3日');

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(3);
  });
});

describe('extractTotal', () => {
  test('prioritizes lines with total keywords', () => {
    const text = [
      '小計 ¥980',
      '税 ¥98',
      '合計 ¥1,078',
    ].join('\n');

    expect(extractTotal(text)).toBe(1078);
  });

  test('extracts TOTAL keyword in english receipts', () => {
    const text = [
      'SUBTOTAL 8.50',
      'TAX 0.85',
      'TOTAL 9.35',
    ].join('\n');

    expect(extractTotal(text)).toBe(9.35);
  });

  test('returns null when amount is not found', () => {
    expect(extractTotal('ご来店ありがとうございました')).toBeNull();
  });
});

describe('extractReceiptFields', () => {
  test('extracts merchant, date and total together', () => {
    const result = extractReceiptFields([
      'スーパーサンプル',
      '購入日 2026年1月15日',
      '合計 ¥2,345',
    ].join('\n'));

    expect(result.merchant).toBe('スーパーサンプル');
    expect(result.date?.getFullYear()).toBe(2026);
    expect(result.total).toBe(2345);
    expect(result.rawText).toContain('スーパーサンプル');
  });
});
