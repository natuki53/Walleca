import { logger } from './logger';

// このモジュールが対応している通貨の種別
export type SupportedCurrency = 'USD' | 'JPY';

// 通貨検出時のオプション。合計キーワードをカスタマイズできる
interface DetectCurrencyOptions {
  totalKeywords?: string[];
}

// USD→JPY 変換の入力パラメータ
interface FxConversionInput {
  amount: number | null;
  rawText: string;
  preferredDate?: Date | null;    // レート取得に使う優先日（レシートの日付）
  fallbackDate?: Date | null;     // preferredDate が未来や未設定の場合に使うフォールバック日
  /** 金額に対応した行からの推定。設定時は rawText 全体の判定より優先する */
  amountLineCurrencyHint?: SupportedCurrency | null;
}

// USD→JPY 変換の結果
interface FxConversionResult {
  originalAmount: number;     // 変換前の金額（USD）
  convertedAmount: number;    // 変換後の金額（JPY、四捨五入済み）
  sourceCurrency: SupportedCurrency;
  targetCurrency: 'JPY';
  rate: number;               // 使用したレート
  rateDate: string;           // レートの基準日（YYYY-MM-DD）
}

// 為替レートを取得する外部 API のベース URL
const FRANKFURTER_API_BASE = 'https://api.frankfurter.dev/v2/rates';
// 合計金額行を特定するためのデフォルトキーワード一覧
const DEFAULT_TOTAL_KEYWORDS = [
  '合計',
  'ご利用額',
  'お会計',
  '領収金額',
  '請求額',
  '総合計',
  'total',
  'amount',
  'price',
  'monthly',
  'yearly',
  '/month',
  '/year',
];

const USD_MARKER_PATTERNS = [
  /\bUSD\b/i,
  /\bUS\$/i,
  /\bU[\s._-]*S[\s._-]*D\b/i,
  /\bU[\s._-]*5[\s._-]*D\b/i,      // OCR誤読: S→5
  /\bU[\s._-]*S[\s._-]*O\b/i,      // OCR誤読: D→O
  /\b0[\s._-]*S[\s._-]*D\b/i,      // OCR誤読: U→0
  /[$＄]/,                          // 半角・全角ドル記号
  /米ドル/,
  /ドル/,
];

const JPY_MARKER_PATTERNS = [
  /[¥￥]/,
  /\bJPY\b/i,
  /\bJP[\s._-]*Y\b/i,
  /日本円/,
  /円/,
];

const USD_AMOUNT_CORE =
  '(?:USD|US\\$|U[\\s._-]*S[\\s._-]*(?:D|O)|U[\\s._-]*5[\\s._-]*D|0[\\s._-]*S[\\s._-]*D|[$＄])';
const PREFIX_USD_AMOUNT_PATTERN = new RegExp(
  `${USD_AMOUNT_CORE}\\s*\\d+(?:[.,]\\d{1,2})?`, 'i'
);
const SUFFIX_USD_AMOUNT_PATTERN = new RegExp(
  `\\d+(?:[.,]\\d{1,2})?\\s*${USD_AMOUNT_CORE}`, 'i'
);
const PREFIX_JPY_AMOUNT_PATTERN =
  /(?:JPY|JP[\s._-]*Y|[¥￥])\s*\d{1,3}(?:[,，]\d{3})*(?:\.\d{1,2})?/i;
const SUFFIX_JPY_AMOUNT_PATTERN =
  /\d{1,3}(?:[,，]\d{3})*(?:\.\d{1,2})?\s*(?:JPY|JP[\s._-]*Y|円)/i;

// 日付をキーとした為替レートのメモリキャッシュ（API 呼び出しを減らすため）
const exchangeRateCache = new Map<string, number>();

// テキスト行を正規化する（全角スペース・連続空白を除去）
function normalizeLine(line: string): string {
  return line
    .normalize('NFKC')
    .replace(/[\t\u3000]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 1行のテキストに対して指定通貨のスコアを計算する
// マーカーパターン・金額パターン・合計キーワードの有無でスコアを加算する
function scoreCurrencyForLine(
  line: string,
  currency: SupportedCurrency,
  totalKeywords: string[]
): number {
  const lower = line.toLowerCase();
  const hasTotalKeyword = totalKeywords.some((keyword) => lower.includes(keyword.toLowerCase()));

  let score = 0;

  if (currency === 'USD') {
    const hasUsdMarker = USD_MARKER_PATTERNS.some((pattern) => pattern.test(line));
    if (hasUsdMarker) {
      score += 4;
    }
    if (PREFIX_USD_AMOUNT_PATTERN.test(line) || SUFFIX_USD_AMOUNT_PATTERN.test(line)) {
      score += 6;
    }
    if (hasUsdMarker && /\d+\.\d{1,2}/.test(line)) {
      score += 1;
    }
  } else {
    const hasJpyMarker = JPY_MARKER_PATTERNS.some((pattern) => pattern.test(line));
    if (hasJpyMarker) {
      score += 4;
    }
    if (PREFIX_JPY_AMOUNT_PATTERN.test(line) || SUFFIX_JPY_AMOUNT_PATTERN.test(line)) {
      score += 6;
    }
    if (hasJpyMarker && /\d{1,3}(?:[,，]\d{3})+/.test(line)) {
      score += 1;
    }
  }

  if (hasTotalKeyword) {
    score += 3;
  }

  return score;
}

export function detectCurrencyFromRawText(
  rawText: string,
  options: DetectCurrencyOptions = {}
): SupportedCurrency | null {
  const totalKeywords = options.totalKeywords ?? DEFAULT_TOTAL_KEYWORDS;
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  let usdScore = 0;
  let jpyScore = 0;

  for (const line of lines) {
    usdScore += scoreCurrencyForLine(line, 'USD', totalKeywords);
    jpyScore += scoreCurrencyForLine(line, 'JPY', totalKeywords);
  }

  if (usdScore === 0 && jpyScore === 0) {
    return null;
  }

  if (usdScore > jpyScore) {
    return 'USD';
  }

  if (jpyScore > usdScore) {
    return 'JPY';
  }

  return null;
}

/**
 * サブスクOCRで選んだ金額マッチとその行だけを見て USD/JPY を推定する。
 * 画面全体では JPY/USD が同点・不明でも、料金行の `$20.00` などを拾う。
 * `numericAmount` はマッチが曖昧でも、行コンテキスト推定に使う。
 */
export function detectCurrencyFromAmountContext(
  matchedAmountFragment: string,
  line: string,
  numericAmount?: number | null
): SupportedCurrency | null {
  const normalizedLine = normalizeLine(line);
  const normalizedMatch = normalizeLine(matchedAmountFragment);

  const usdInMatch =
    /[$＄]/.test(normalizedMatch) ||
    /\bUSD\b/i.test(normalizedMatch) ||
    /\bUS\$/i.test(normalizedMatch);
  const jpyInMatch =
    /[¥￥]/.test(normalizedMatch) ||
    /円/.test(normalizedMatch) ||
    /\bJPY\b/i.test(normalizedMatch);

  if (usdInMatch && !jpyInMatch) {
    return 'USD';
  }
  if (jpyInMatch && !usdInMatch) {
    return 'JPY';
  }

  const usdLine =
    PREFIX_USD_AMOUNT_PATTERN.test(normalizedLine) ||
    SUFFIX_USD_AMOUNT_PATTERN.test(normalizedLine);
  const jpyLine =
    PREFIX_JPY_AMOUNT_PATTERN.test(normalizedLine) ||
    SUFFIX_JPY_AMOUNT_PATTERN.test(normalizedLine);

  if (usdLine && !jpyLine) {
    return 'USD';
  }
  if (jpyLine && !usdLine) {
    return 'JPY';
  }
  if (usdLine && jpyLine) {
    const su = scoreCurrencyForLine(normalizedLine, 'USD', []);
    const sj = scoreCurrencyForLine(normalizedLine, 'JPY', []);
    if (su > sj) {
      return 'USD';
    }
    if (sj > su) {
      return 'JPY';
    }
  }

  if (
    numericAmount !== undefined &&
    numericAmount !== null &&
    lineContainsDistinctAmount(normalizedLine, numericAmount) &&
    impliedUsdFromForeignSubscriptionBillingLine(normalizedLine, numericAmount)
  ) {
    return 'USD';
  }

  return null;
}

/**
 * Stripe 等の「1カ月ごとに (USD)」行で、OCR が $ を落としたときの USD 推定。
 * 円・¥ が同一行に無く、海外サブスクでよくある小数・中額のときに限る。
 */
function impliedUsdFromForeignSubscriptionBillingLine(
  line: string,
  amount: number
): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1000) {
    return false;
  }

  if (/[¥￥]|円|\bJPY\b/i.test(line)) {
    return false;
  }

  const billingPhrase =
    /(?:カ月|ヶ月|ケ月|か月)\s*ごとに/.test(line) ||
    /\b(?:per|\/)\s*month\b/i.test(line) ||
    /\bmonthly\b/i.test(line);

  if (!billingPhrase) {
    return false;
  }

  if (amount % 1 !== 0) {
    return true;
  }

  return amount <= 500;
}

export function lineContainsDistinctAmount(line: string, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  const n = normalizeLine(line);

  const dec = Math.round((amount % 1) * 100);
  if (dec > 0) {
    const intPart = Math.trunc(amount);
    const decStr = String(dec).padStart(2, '0');
    return new RegExp(`(?:^|[^0-9])${intPart}\\.${decStr}(?![0-9])`).test(n);
  }

  const intPart = Math.trunc(amount);
  return (
    new RegExp(`(?:^|[^0-9])${intPart}(?![0-9])`).test(n) ||
    new RegExp(`(?:^|[^0-9])${intPart}\\.00(?![0-9])`).test(n) ||
    new RegExp(`(?:^|[^0-9])${intPart}\\.[0-9]{2}(?![0-9])`).test(n)
  );
}

// amountLineCurrencyHint が設定されている場合は優先し、未設定の場合は rawText 全体から判定する
function resolveCurrencyForUsdConversion(input: FxConversionInput): SupportedCurrency | null {
  if (input.amountLineCurrencyHint === 'USD') {
    return 'USD';
  }
  if (input.amountLineCurrencyHint === 'JPY') {
    return 'JPY';
  }

  return detectCurrencyFromRawText(input.rawText);
}

// Date オブジェクトを YYYY-MM-DD 形式の文字列に変換する
function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// レート取得に使う日付を決定する
// preferredDate が過去または今日の場合はそれを使い、未来の場合は fallbackDate → 今日の順で使う
function resolveRateDate(preferredDate?: Date | null, fallbackDate?: Date | null): string {
  const today = new Date();
  const candidate = preferredDate && preferredDate.getTime() <= today.getTime()
    ? preferredDate
    : fallbackDate ?? today;

  return formatDateKey(candidate.getTime() <= today.getTime() ? candidate : today);
}

/**
 * 指定日のUSD→JPYレートを取得する。
 * 週末・祝日など市場が閉まっている日は直前の営業日まで最大5日遡る。
 */
async function fetchUsdToJpyRate(date: string): Promise<number> {
  const cacheKey = `USD:JPY:${date}`;
  const cachedRate = exchangeRateCache.get(cacheKey);
  if (cachedRate) {
    return cachedRate;
  }

  // 最大5営業日遡ってレートを取得する
  const targetDate = new Date(date);
  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const tryDate = new Date(targetDate);
    tryDate.setDate(tryDate.getDate() - dayOffset);
    const tryDateKey = tryDate.toISOString().slice(0, 10);

    const tryCacheKey = `USD:JPY:${tryDateKey}`;
    const tryCachedRate = exchangeRateCache.get(tryCacheKey);
    if (tryCachedRate) {
      exchangeRateCache.set(cacheKey, tryCachedRate);
      return tryCachedRate;
    }

    try {
      const url = `${FRANKFURTER_API_BASE}?date=${tryDateKey}&base=USD&quotes=JPY`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!response.ok) {
        continue;
      }

      // v2 API のレスポンスは配列形式: [{ date, base, quote, rate }]
      const data = (await response.json()) as
        | Array<{ rate?: number }>
        | { rates?: Record<string, number> };
      const rate = Array.isArray(data)
        ? data[0]?.rate
        : data.rates?.JPY;

      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        exchangeRateCache.set(tryCacheKey, rate);
        exchangeRateCache.set(cacheKey, rate);
        return rate;
      }
    } catch {
      // タイムアウトやネットワークエラーは次の日付にフォールバック
      continue;
    }
  }

  throw new Error(`USD→JPY rate not found for date: ${date}`);
}

export async function maybeConvertDetectedUsdAmountToJpy(
  input: FxConversionInput
): Promise<FxConversionResult | null> {
  if (input.amount === null || !Number.isFinite(input.amount) || input.amount <= 0) {
    return null;
  }

  const detectedCurrency = resolveCurrencyForUsdConversion(input);
  if (detectedCurrency !== 'USD') {
    return null;
  }

  const rateDate = resolveRateDate(input.preferredDate, input.fallbackDate);
  const todayKey = formatDateKey(new Date());
  const amount = input.amount;

  const buildResult = (rate: number, usedRateDate: string): FxConversionResult => ({
    originalAmount: amount,
    convertedAmount: Math.round(amount * rate),
    sourceCurrency: 'USD',
    targetCurrency: 'JPY',
    rate,
    rateDate: usedRateDate,
  });

  try {
    const rate = await fetchUsdToJpyRate(rateDate);
    return buildResult(rate, rateDate);
  } catch (error) {
    logger.warn('Failed to convert detected USD amount to JPY', {
      error: error instanceof Error ? error.message : String(error),
      rateDate,
    });

    if (rateDate !== todayKey) {
      try {
        const rate = await fetchUsdToJpyRate(todayKey);
        return buildResult(rate, todayKey);
      } catch (retryError) {
        logger.warn('USD→JPY retry with today rate failed', {
          error: retryError instanceof Error ? retryError.message : String(retryError),
          rateDate: todayKey,
        });
      }
    }

    const fallback = Number.parseFloat(process.env.FALLBACK_USD_JPY_RATE ?? '');
    if (Number.isFinite(fallback) && fallback > 0) {
      logger.warn('Using FALLBACK_USD_JPY_RATE for USD→JPY conversion');
      return buildResult(fallback, todayKey);
    }

    return null;
  }
}
