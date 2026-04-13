import {
  detectCurrencyFromAmountContext,
  detectCurrencyFromRawText,
  maybeConvertDetectedUsdAmountToJpy,
} from '@/utils/currency-conversion';

describe('detectCurrencyFromRawText', () => {
  test('detects USD from dollar symbol line', () => {
    const text = [
      'Netflix',
      'TOTAL $9.99',
    ].join('\n');

    expect(detectCurrencyFromRawText(text)).toBe('USD');
  });

  test('detects USD from suffix currency format', () => {
    const text = [
      'Sample Service',
      'Total 9.99 USD',
    ].join('\n');

    expect(detectCurrencyFromRawText(text)).toBe('USD');
  });

  test('detects USD from lightly corrupted OCR marker', () => {
    const text = [
      'Sample Service',
      'Billing amount U5D 19.99',
    ].join('\n');

    expect(detectCurrencyFromRawText(text)).toBe('USD');
  });

  test('detects JPY from yen symbol line', () => {
    const text = [
      'スーパーサンプル',
      '合計 ¥1,280',
    ].join('\n');

    expect(detectCurrencyFromRawText(text)).toBe('JPY');
  });

  test('returns null when neither currency is clear', () => {
    const text = [
      'Sample Service',
      'TOTAL 9.99',
    ].join('\n');

    expect(detectCurrencyFromRawText(text)).toBeNull();
  });
});

describe('detectCurrencyFromAmountContext', () => {
  test('detects USD from dollar sign in matched fragment', () => {
    expect(detectCurrencyFromAmountContext('$20.00', '1カ月ごとに $20.00')).toBe('USD');
  });

  test('detects USD from line when match is digits only but line has $ amount', () => {
    expect(detectCurrencyFromAmountContext('20.00', '1カ月ごとに $20.00')).toBe('USD');
  });

  test('detects USD from Japanese billing copy when OCR drops dollar sign', () => {
    expect(detectCurrencyFromAmountContext('', '1カ月ごとに 20', 20)).toBe('USD');
    expect(detectCurrencyFromAmountContext('20.00', '1カ月ごとに 20.00', 20)).toBe('USD');
  });

  test('does not imply USD when the same line has yen', () => {
    expect(detectCurrencyFromAmountContext('', '1カ月ごとに ¥2,000', 2000)).not.toBe('USD');
  });

  test('detects JPY from yen in match', () => {
    expect(detectCurrencyFromAmountContext('¥980', '月額料金 ¥980')).toBe('JPY');
  });
});

describe('maybeConvertDetectedUsdAmountToJpy', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('converts detected USD amount using historical rate', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rates: {
          JPY: 150.25,
        },
      }),
    }) as unknown as typeof fetch;

    const result = await maybeConvertDetectedUsdAmountToJpy({
      amount: 9.99,
      rawText: 'TOTAL $9.99',
      preferredDate: new Date('2026-01-15T00:00:00.000Z'),
      fallbackDate: new Date('2026-01-16T00:00:00.000Z'),
    });

    expect(result).not.toBeNull();
    expect(result?.convertedAmount).toBe(1501);
    expect(result?.rateDate).toBe('2026-01-15');
  });

  test('converts suffix USD format using historical rate', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rates: {
          JPY: 150.25,
        },
      }),
    }) as unknown as typeof fetch;

    const result = await maybeConvertDetectedUsdAmountToJpy({
      amount: 19.99,
      rawText: 'Total 19.99 USD',
      preferredDate: new Date('2026-01-15T00:00:00.000Z'),
      fallbackDate: new Date('2026-01-16T00:00:00.000Z'),
    });

    expect(result).not.toBeNull();
    expect(result?.convertedAmount).toBe(3003);
  });

  test('returns null when text is not detected as USD', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await maybeConvertDetectedUsdAmountToJpy({
      amount: 1280,
      rawText: '合計 ¥1,280',
      preferredDate: new Date('2026-01-15T00:00:00.000Z'),
    });

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('converts when amount line hints USD even if document would not resolve to USD', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rates: {
          JPY: 150,
        },
      }),
    }) as unknown as typeof fetch;

    const result = await maybeConvertDetectedUsdAmountToJpy({
      amount: 20,
      rawText: ['請求先 〒800-0302', '内訳 円建ての表記あり', '1カ月ごとに $20.00'].join('\n'),
      amountLineCurrencyHint: 'USD',
      preferredDate: new Date('2019-11-11T00:00:00.000Z'),
      fallbackDate: new Date('2019-11-12T00:00:00.000Z'),
    });

    expect(result).not.toBeNull();
    expect(result?.convertedAmount).toBe(3000);
    expect(result?.rateDate).toBe('2019-11-11');
    expect(global.fetch).toHaveBeenCalled();
  });

  test('does not convert when amount line hints JPY', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await maybeConvertDetectedUsdAmountToJpy({
      amount: 980,
      rawText: 'TOTAL $999 noise',
      amountLineCurrencyHint: 'JPY',
      preferredDate: new Date('2026-01-15T00:00:00.000Z'),
    });

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('uses FALLBACK_USD_JPY_RATE when Frankfurter fails', async () => {
    const prev = process.env.FALLBACK_USD_JPY_RATE;
    process.env.FALLBACK_USD_JPY_RATE = '150';

    try {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;

      const result = await maybeConvertDetectedUsdAmountToJpy({
        amount: 20,
        rawText: '1カ月ごとに $20.00',
        amountLineCurrencyHint: 'USD',
        preferredDate: new Date('2019-11-11T00:00:00.000Z'),
      });

      expect(result).not.toBeNull();
      expect(result?.convertedAmount).toBe(3000);
      expect(result?.rate).toBe(150);
    } finally {
      process.env.FALLBACK_USD_JPY_RATE = prev;
    }
  });
});
