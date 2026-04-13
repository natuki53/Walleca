import { BillingCycle } from '@prisma/client';
import {
  type SupportedCurrency,
  detectCurrencyFromAmountContext,
  lineContainsDistinctAmount,
} from './currency-conversion';
import { canonicalizeKnownOcrName } from './ocr-name-dictionary';
import { ExtractedReceiptFields, extractMerchant } from './receipt-ocr';

export interface ExtractedSubscriptionFields {
  serviceName: string | null;
  amount: number | null;
  /** 抽出した金額が載っていた行から推定。USD のときワーカーで円換算に使う */
  amountCurrencyHint: SupportedCurrency | null;
  billingCycle: BillingCycle | null;
  nextPaymentDate: Date | null;
}

interface AmountCandidate {
  amount: number;
  score: number;
  lineIndex: number;
  line: string;
  matchText: string;
}

interface DateCandidate {
  date: Date;
  score: number;
  lineIndex: number;
}

const DATE_PATTERNS = [
  /(20\d{2}|19\d{2})[./-年](\d{1,2})[./-月](\d{1,2})日?/g,
  /(\d{2})[./-](\d{1,2})[./-](\d{1,2})/g,
];
const ENGLISH_MONTH_PATTERN =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ENGLISH_DATE_MONTH_FIRST_PATTERN = new RegExp(
  `${ENGLISH_MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2}|19\\d{2}|\\d{2})`,
  'gi'
);
const ENGLISH_DATE_DAY_FIRST_PATTERN = new RegExp(
  `(\\d{1,2})(?:st|nd|rd|th)?\\s+${ENGLISH_MONTH_PATTERN}(?:,)?\\s+(20\\d{2}|19\\d{2}|\\d{2})`,
  'gi'
);
const DATE_YEAR_LAST_PATTERN = /(\d{1,2})[./-](\d{1,2})[./-]((?:20\d{2}|19\d{2}|\d{2}))/g;
const DATE_COMPACT_PATTERN = /((?:20\d{2}|19\d{2}))(\d{2})(\d{2})/g;
const REIWA_DATE_PATTERN = /(?:令和|R|r)\s*(\d{1,2})[./-年]?\s*(\d{1,2})[./-月]?\s*(\d{1,2})日?/g;
const HEISEI_DATE_PATTERN = /(?:平成|H|h)\s*(\d{1,2})[./-年]?\s*(\d{1,2})[./-月]?\s*(\d{1,2})日?/g;
const SHOWA_DATE_PATTERN = /(?:昭和|S|s)\s*(\d{1,2})[./-年]?\s*(\d{1,2})[./-月]?\s*(\d{1,2})日?/g;
const CURRENCY_AMOUNT_SUFFIX = '(?:\\s*(?:USD|JPY|US\\$|[$¥￥]|円))?';
const AMOUNT_PATTERN =
  new RegExp(
    `(?:USD|JPY|US\\$|[$¥￥])?\\s*\\d{1,3}(?:[,，]\\d{3})+(?:\\.\\d{1,2})?${CURRENCY_AMOUNT_SUFFIX}|(?:USD|JPY|US\\$|[$¥￥])?\\s*\\d+(?:\\.\\d{1,2})?${CURRENCY_AMOUNT_SUFFIX}`,
    'gi'
  );

const BILLING_CYCLE_HINTS: Array<{ cycle: BillingCycle; pattern: RegExp }> = [
  { cycle: 'yearly', pattern: /(年額|年払い|annual|yearly|\/year|per year|yr\b)/i },
  { cycle: 'monthly', pattern: /(月額|月払い|monthly|\/month|per month|mo\b|month\b)/i },
];

const AMOUNT_POSITIVE_KEYWORDS = [
  'amount',
  'price',
  'billing',
  'payment',
  'charge',
  'plan',
  'monthly',
  'yearly',
  '月額',
  '年額',
  '料金',
  '金額',
  '請求',
  '支払い',
  '支払',
  '更新',
  'プラン',
];

const AMOUNT_NEGATIVE_KEYWORDS = [
  'date',
  'days',
  'day',
  'free trial',
  'trial',
  'account',
  'order',
  'invoice no',
  'customer id',
  'user',
  'member',
  'gb',
  'mb',
  'minutes',
  '回',
  '日間',
  '登録',
  '開始',
  '発行',
  '注文番号',
  '請求先',
  'お問い合わせ',
  '番号',
  'contact',
  'support',
];

const NEXT_PAYMENT_POSITIVE_KEYWORDS = [
  '次回',
  '次の請求',
  '次回請求',
  '次回支払',
  '支払日',
  '請求日',
  '更新日',
  '更新予定',
  'renew',
  'renews',
  'renewal',
  'next payment',
  'next charge',
  'next billing',
  'billing date',
  'due date',
];

const NEXT_PAYMENT_NEGATIVE_KEYWORDS = [
  '登録日',
  '開始日',
  '契約日',
  '申込日',
  '購入日',
  '発行日',
  '作成日',
  '前回',
  '前の請求',
  'last payment',
  'last billed',
  'joined',
  'started',
  'purchased',
  'created',
];

// テキスト行を正規化する（全角スペース・連続空白を除去）
function normalizeLine(line: string): string {
  return line
    .replace(/[\t\u3000]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 日付テキストを正規化する（全角数字・全角記号を半角に変換）
function normalizeDateText(text: string): string {
  const replacedFullWidth = text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  );

  return replacedFullWidth
    .replace(/[／]/g, '/')
    .replace(/[．]/g, '.')
    .replace(/[－―ー]/g, '-')
    .replace(/[：]/g, ':');
}

// 2桁年を4桁年に変換する（今年±1年以内なら 2000 年代、それ以外は 1900 年代）
function normalizeYear(year: number): number {
  if (year >= 100) {
    return year;
  }

  const currentYear = new Date().getFullYear() % 100;
  return year <= currentYear + 1 ? 2000 + year : 1900 + year;
}

// 年月日の数値から Date オブジェクトを生成する。無効な日付の場合は null を返す
function parseDateParts(year: number, month: number, day: number): Date | null {
  const normalizedYear = normalizeYear(year);
  const date = new Date(Date.UTC(normalizedYear, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== normalizedYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseEnglishMonthName(monthName: string): number | null {
  const normalized = monthName.toLowerCase();
  const monthEntries: Array<[string, number]> = [
    ['jan', 1],
    ['feb', 2],
    ['mar', 3],
    ['apr', 4],
    ['may', 5],
    ['jun', 6],
    ['jul', 7],
    ['aug', 8],
    ['sep', 9],
    ['oct', 10],
    ['nov', 11],
    ['dec', 12],
  ];

  for (const [prefix, month] of monthEntries) {
    if (normalized.startsWith(prefix)) {
      return month;
    }
  }

  return null;
}

function parseAmount(value: string): number | null {
  const normalized = value
    .replace(/(?:USD|JPY|US\$|[$¥￥]|\s|,|，)/gi, '')
    .trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return null;
  }

  return Number(amount.toFixed(2));
}

// 「1カ月ごとに $20.00」の先頭「1」のように、間隔を表す数量を金額と誤認しないようにする
// マッチ文字列の直後に「カ月」や「months」が続く場合はスキップする
function isBillingIntervalQuantityNotPrice(
  line: string,
  matchIndex: number,
  matchedText: string,
  amount: number
): boolean {
  if (!Number.isInteger(amount)) {
    return false;
  }

  const after = line.slice(matchIndex + matchedText.length);
  if (/^\s*(?:カ月|ヶ月|ケ月|か月)/.test(after)) {
    return true;
  }

  if (/^\s*months?\b/i.test(after)) {
    return true;
  }

  return false;
}

// テキスト全行を走査して月払い・年払いのヒントをカウントし、多数決で支払い周期を判定する
function detectBillingCycleFromText(lines: string[]): BillingCycle | null {
  const scores: Record<BillingCycle, number> = {
    monthly: 0,
    yearly: 0,
  };

  for (const line of lines) {
    for (const hint of BILLING_CYCLE_HINTS) {
      if (hint.pattern.test(line)) {
        scores[hint.cycle] += 1;
      }
    }
  }

  if (scores.monthly === 0 && scores.yearly === 0) {
    return null;
  }

  return scores.monthly >= scores.yearly ? 'monthly' : 'yearly';
}

function scoreAmountCandidate(
  amount: number,
  line: string,
  context: string,
  inferredBillingCycle: BillingCycle | null
): number {
  const lowerLine = line.toLowerCase();
  const lowerContext = context.toLowerCase();
  let score = 0;

  if (AMOUNT_POSITIVE_KEYWORDS.some((keyword) => lowerLine.includes(keyword.toLowerCase()))) {
    score += 6;
  } else if (AMOUNT_POSITIVE_KEYWORDS.some((keyword) => lowerContext.includes(keyword.toLowerCase()))) {
    score += 2;
  }

  if (/(?:カ月|ヶ月|ケ月|か月)\s*ごとに|ごとに\s*\d/.test(line)) {
    score += 7;
  }

  if (/[¥￥$]/.test(line) || /\b(?:USD|JPY|US\$)\b/i.test(line)) {
    score += 4;
  }

  if (inferredBillingCycle === 'monthly' && /(月額|monthly|\/month|per month|mo\b|month\b)/i.test(line)) {
    score += 5;
  } else if (inferredBillingCycle === 'monthly' && /(月額|monthly|\/month|per month|mo\b|month\b)/i.test(context)) {
    score += 2;
  }

  if (inferredBillingCycle === 'yearly' && /(年額|annual|yearly|\/year|per year|yr\b)/i.test(line)) {
    score += 5;
  } else if (inferredBillingCycle === 'yearly' && /(年額|annual|yearly|\/year|per year|yr\b)/i.test(context)) {
    score += 2;
  }

  if (AMOUNT_NEGATIVE_KEYWORDS.some((keyword) => lowerLine.includes(keyword.toLowerCase()))) {
    score -= 7;
  } else if (AMOUNT_NEGATIVE_KEYWORDS.some((keyword) => lowerContext.includes(keyword.toLowerCase()))) {
    score -= 3;
  }

  if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(line)) {
    score -= 8;
  }

  if (amount <= 31 && /(day|days|日間|trial|無料)/i.test(context)) {
    score -= 8;
  }

  if (amount >= 100 && amount <= 100000) {
    score += 2;
  }

  return score;
}

// テキスト全行から金額候補をスコアリングし、最も適切な金額を返す
// スコアが閾値未満（信頼度が低い）の場合は null を返す
function extractSubscriptionAmount(
  lines: string[],
  inferredBillingCycle: BillingCycle | null
): { amount: number | null; amountCurrencyHint: SupportedCurrency | null } {
  const candidates: AmountCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const prev = lines[lineIndex - 1] ?? '';
    const next = lines[lineIndex + 1] ?? '';
    const context = `${prev} ${line} ${next}`;

    for (const match of line.matchAll(AMOUNT_PATTERN)) {
      const amount = parseAmount(match[0]);
      if (amount === null) {
        continue;
      }

      const idx = match.index;
      if (
        idx !== undefined &&
        isBillingIntervalQuantityNotPrice(line, idx, match[0], amount)
      ) {
        continue;
      }

      candidates.push({
        amount,
        score: scoreAmountCandidate(amount, line, context, inferredBillingCycle),
        lineIndex,
        line,
        matchText: match[0],
      });
    }
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (a.amount !== b.amount) {
      return b.amount - a.amount;
    }

    return a.lineIndex - b.lineIndex;
  });

  const winner = candidates[0];
  if (!winner || winner.score < 4) {
    return { amount: null, amountCurrencyHint: null };
  }

  return {
    amount: winner.amount,
    amountCurrencyHint: detectCurrencyFromAmountContext(
      winner.matchText,
      winner.line,
      winner.amount
    ),
  };
}

// フォールバック金額（receipt-ocr で抽出した合計）に対して通貨ヒントを推定する
// 金額が含まれる行から通貨記号・キーワードを探す
function inferCurrencyHintFromFallbackAmount(
  lines: string[],
  amount: number
): SupportedCurrency | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const ranked = [...lines]
    .filter((line) => lineContainsDistinctAmount(line, amount))
    .sort((a, b) => {
      const score = (s: string) =>
        /(?:カ月|ヶ月|ケ月|か月)\s*ごとに/.test(s) ? 2 : /\bmonthly\b/i.test(s) ? 1 : 0;
      return score(b) - score(a);
    });

  for (const line of ranked) {
    const hint = detectCurrencyFromAmountContext('', line, amount);
    if (hint) {
      return hint;
    }
  }

  return null;
}

function collectDateCandidates(lines: string[]): DateCandidate[] {
  const candidates: DateCandidate[] = [];

  const pushCandidate = (lineIndex: number, date: Date | null) => {
    if (!date) {
      return;
    }

    const line = lines[lineIndex] ?? '';
    const prev = lines[lineIndex - 1] ?? '';
    const next = lines[lineIndex + 1] ?? '';
    const lowerLine = line.toLowerCase();
    const context = `${prev} ${line} ${next}`.toLowerCase();
    const today = new Date();
    let score = 0;

    if (NEXT_PAYMENT_POSITIVE_KEYWORDS.some((keyword) => lowerLine.includes(keyword.toLowerCase()))) {
      score += 10;
    } else if (NEXT_PAYMENT_POSITIVE_KEYWORDS.some((keyword) => context.includes(keyword.toLowerCase()))) {
      score += 3;
    }

    if (NEXT_PAYMENT_NEGATIVE_KEYWORDS.some((keyword) => lowerLine.includes(keyword.toLowerCase()))) {
      score -= 8;
    } else if (NEXT_PAYMENT_NEGATIVE_KEYWORDS.some((keyword) => context.includes(keyword.toLowerCase()))) {
      score -= 3;
    }

    const diffDays = Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays >= -3 && diffDays <= 400) {
      score += 5;
    } else if (diffDays < -35) {
      score -= 6;
    } else if (diffDays > 550) {
      score -= 4;
    }

    if (/(年額|annual|yearly|月額|monthly)/i.test(context)) {
      score += 1;
    }

    candidates.push({
      date,
      score,
      lineIndex,
    });
  };

  lines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(REIWA_DATE_PATTERN)) {
      pushCandidate(
        lineIndex,
        parseDateParts(Number.parseInt(match[1], 10) + 2018, Number.parseInt(match[2], 10), Number.parseInt(match[3], 10))
      );
    }

    for (const match of line.matchAll(HEISEI_DATE_PATTERN)) {
      pushCandidate(
        lineIndex,
        parseDateParts(Number.parseInt(match[1], 10) + 1988, Number.parseInt(match[2], 10), Number.parseInt(match[3], 10))
      );
    }

    for (const match of line.matchAll(SHOWA_DATE_PATTERN)) {
      pushCandidate(
        lineIndex,
        parseDateParts(Number.parseInt(match[1], 10) + 1925, Number.parseInt(match[2], 10), Number.parseInt(match[3], 10))
      );
    }

    for (const pattern of DATE_PATTERNS) {
      for (const match of line.matchAll(pattern)) {
        pushCandidate(
          lineIndex,
          parseDateParts(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10))
        );
      }
    }

    for (const match of line.matchAll(DATE_YEAR_LAST_PATTERN)) {
      pushCandidate(
        lineIndex,
        parseDateParts(Number.parseInt(match[3], 10), Number.parseInt(match[1], 10), Number.parseInt(match[2], 10))
      );
    }

    for (const match of line.matchAll(DATE_COMPACT_PATTERN)) {
      pushCandidate(
        lineIndex,
        parseDateParts(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10))
      );
    }

    for (const match of line.matchAll(ENGLISH_DATE_MONTH_FIRST_PATTERN)) {
      const month = parseEnglishMonthName(match[1]);
      pushCandidate(
        lineIndex,
        month ? parseDateParts(Number.parseInt(match[3], 10), month, Number.parseInt(match[2], 10)) : null
      );
    }

    for (const match of line.matchAll(ENGLISH_DATE_DAY_FIRST_PATTERN)) {
      const month = parseEnglishMonthName(match[2]);
      pushCandidate(
        lineIndex,
        month ? parseDateParts(Number.parseInt(match[3], 10), month, Number.parseInt(match[1], 10)) : null
      );
    }
  });

  return candidates;
}

// テキスト全行から次回支払日の候補をスコアリングし、最も適切な日付を返す
// スコアが閾値未満（信頼度が低い）の場合は null を返す
function extractNextPaymentDate(lines: string[]): Date | null {
  const candidates = collectDateCandidates(lines).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.date.getTime() - b.date.getTime();
  });

  return candidates[0] && candidates[0].score >= 4 ? candidates[0].date : null;
}

// サブスク明細の OCR テキストからサービス名・金額・支払い周期・次回支払日を推定して返す
// fallback にはレシート OCR の抽出結果を渡し、サブスク固有の抽出が失敗した場合に利用する
export function inferSubscriptionFields(
  rawText: string,
  fallback: ExtractedReceiptFields
): ExtractedSubscriptionFields {
  const lines = normalizeDateText(rawText)
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const inferredBillingCycle = detectBillingCycleFromText(lines);
  const { amount: extractedAmount, amountCurrencyHint } = extractSubscriptionAmount(
    lines,
    inferredBillingCycle
  );
  const nextPaymentDate = extractNextPaymentDate(lines);
  const serviceNameCandidate = extractMerchant(rawText) ?? fallback.merchant;

  const finalAmount = extractedAmount ?? fallback.total;
  let resolvedCurrencyHint =
    extractedAmount !== null ? amountCurrencyHint : null;
  if (resolvedCurrencyHint === null && finalAmount !== null) {
    resolvedCurrencyHint = inferCurrencyHintFromFallbackAmount(lines, finalAmount);
  }

  return {
    serviceName: canonicalizeKnownOcrName(serviceNameCandidate, rawText, 'subscription'),
    amount: finalAmount,
    amountCurrencyHint: resolvedCurrencyHint,
    billingCycle: inferredBillingCycle,
    nextPaymentDate,
  };
}
