export interface ExtractedReceiptFields {
  rawText: string;
  merchant: string | null;
  date: Date | null;
  total: number | null;
}

// 全角ドル・全角円記号も含めて通貨プレフィックス/サフィックスを認識する
const CURRENCY_AMOUNT_PREFIX = '(?:USD|JPY|US\\$|[$¥￥＄]|US\\s*\\$)?\\s*';
const CURRENCY_AMOUNT_SUFFIX = '(?:\\s*(?:USD|JPY|US\\$|[$¥￥＄]|円))?';

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

const DATE_POSITIVE_KEYWORDS = [
  '取引日時',
  '取引日',
  '購入日',
  '利用日',
  'ご利用日',
  '会計日時',
  '発行日',
  '売上日時',
  '日時',
  '日付',
  'transaction date',
  'purchase date',
  'order date',
  'issued on',
  'date',
];

const DATE_NEGATIVE_KEYWORDS = [
  '有効期限',
  '期限',
  '賞味',
  '消費',
  '製造',
  '生年月日',
  '支払期限',
  '振込期限',
  '納期',
  'expiry',
  'expiration',
  'expires',
  'due date',
  'best before',
];

const POSITIVE_AMOUNT_PATTERN = new RegExp(
  `(${CURRENCY_AMOUNT_PREFIX}\\s*\\d{1,3}(?:[,，]\\d{3})+|${CURRENCY_AMOUNT_PREFIX}\\s*\\d+)(?:\\.(\\d{1,2}))?${CURRENCY_AMOUNT_SUFFIX}`,
  'gi'
);

const PRIMARY_TOTAL_KEYWORDS = [
  '合計',
  'ご利用額',
  'お会計',
  '領収金額',
  '請求額',
  '総合計',
  '税込合計',
  '税込金額',
  'お支払い金額',
  'お支払金額',
  '支払金額',
  '請求金額',
  'ご請求額',
  'ご請求金額',
  'TOTAL',
  'GRAND TOTAL',
  'AMOUNT DUE',
  'AMOUNT',
  'SUBTOTAL',
  'CHARGE',
];

const EXCLUDED_AMOUNT_KEYWORDS = [
  '小計',
  '内税',
  '外税',
  '消費税',
  '値引',
  '割引',
  'お釣',
  '釣銭',
  '預り',
  'TEL',
  '電話',
  'ポイント',
  '付与',
  'discount',
  'tax',
  'change',
  'cash',
];

const MERCHANT_LINE_BLOCK_PATTERNS = [
  /^\d+$/,
  /^〒?\d{3}-\d{4}$/,
  /^(?:tel|電話|phone|fax)/i,
  /(?:レシート|領収書|receipt|ありがとう|thank you)/i,
  /(20\d{2}|19\d{2}|\d{2})[./-年](\d{1,2})[./-月](\d{1,2})日?/,
  ENGLISH_DATE_MONTH_FIRST_PATTERN,
  ENGLISH_DATE_DAY_FIRST_PATTERN,
  /\d{1,2}:\d{2}/,
  /(?:合計|小計|税込|税|total|amount)/i,
  /(?:取引|伝票|会計|レジ|担当)/,
  /[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}/,
];

const MERCHANT_NEGATIVE_KEYWORDS = [
  '合計',
  '小計',
  '税込',
  '税',
  '金額',
  '料金',
  '請求',
  '支払',
  '支払い',
  '取引',
  '明細',
  '利用明細',
  '注文番号',
  '注文',
  '会員番号',
  'お問い合わせ',
  'カスタマー',
  'サポート',
  'ヘルプ',
  '登録日',
  '開始日',
  '更新日',
  '次回',
  'プラン',
  '無料',
  'トライアル',
  '月額',
  '年額',
  'billing',
  'payment',
  'price',
  'amount',
  'invoice',
  'order',
  'customer',
  'support',
  'help',
  'account',
  'member',
  'trial',
  'plan',
  'renew',
  'date',
];

const MERCHANT_POSITIVE_KEYWORDS = [
  '株式会社',
  '有限会社',
  '合同会社',
  '（株）',
  '(株)',
  '店',
  'ストア',
  'ショップ',
  '商店',
  'スーパー',
  'マート',
  'market',
  'mart',
  'store',
  'shop',
  'cafe',
  'coffee',
  'restaurant',
  'bakery',
  'pharmacy',
  'inc',
  'corp',
  'llc',
  'company',
  'co.',
  'ltd',
];

/**
 * 全角の数字・アルファベット・記号をASCIIに変換する。
 * 日本語カナ（ー など）はここでは変換しない（店名などを壊さないため）。
 */
function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[ａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[／]/g, '/')
    .replace(/[．]/g, '.')
    .replace(/[－―]/g, '-')
    .replace(/[：]/g, ':')
    .replace(/[￥]/g, '¥')
    .replace(/[，]/g, ',');
}

function normalizeLine(line: string): string {
  return normalizeFullWidth(line)
    .replace(/[\t\u3000]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 日付テキスト専用の正規化。長音符もハイフンに変換する（日付区切りとして使われることがある）。
 */
function normalizeDateText(text: string): string {
  return normalizeFullWidth(text).replace(/[ーｰ]/g, '-');
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeYear(year: number): number {
  if (year >= 100) {
    return year;
  }

  const currentYear = new Date().getFullYear() % 100;
  return year <= currentYear + 1 ? 2000 + year : 1900 + year;
}

function parseDateParts(
  year: number,
  month: number,
  day: number
): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const normalizedYear = normalizeYear(year);
  if (!isValidDate(normalizedYear, month, day)) {
    return null;
  }

  return new Date(normalizedYear, month - 1, day);
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

interface DateCandidate {
  date: Date;
  lineIndex: number;
  score: number;
}

function scoreDateCandidate(
  lines: string[],
  lineIndex: number,
  date: Date
): number {
  const line = lines[lineIndex] ?? '';
  const prev = lines[lineIndex - 1] ?? '';
  const next = lines[lineIndex + 1] ?? '';
  const context = `${prev} ${line} ${next}`.toLowerCase();
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  let score = 0;

  if (DATE_POSITIVE_KEYWORDS.some((keyword) => context.includes(keyword.toLowerCase()))) {
    score += 4;
  }

  if (/(?:\d{1,2}:\d{2})/.test(context)) {
    score += 1;
  }

  if (DATE_NEGATIVE_KEYWORDS.some((keyword) => context.includes(keyword.toLowerCase()))) {
    score -= 6;
  }

  if (lineIndex <= 3) {
    score += 1;
  }

  const diffMs = date.getTime() - now.getTime();
  if (diffMs > 2 * dayMs) {
    score -= 4;
  } else if (diffMs > 0) {
    score -= 1;
  }

  const fiveYearsMs = 5 * 365 * dayMs;
  if (now.getTime() - date.getTime() > fiveYearsMs) {
    score -= 2;
  }

  return score;
}

function findDateCandidates(lines: string[]): DateCandidate[] {
  const candidates: DateCandidate[] = [];

  const pushCandidate = (lineIndex: number, date: Date | null) => {
    if (!date) {
      return;
    }

    candidates.push({
      date,
      lineIndex,
      score: scoreDateCandidate(lines, lineIndex, date),
    });
  };

  lines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(REIWA_DATE_PATTERN)) {
      const year = Number.parseInt(match[1], 10) + 2018;
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, parseDateParts(year, month, day));
    }

    for (const match of line.matchAll(HEISEI_DATE_PATTERN)) {
      const year = Number.parseInt(match[1], 10) + 1988;
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, parseDateParts(year, month, day));
    }

    for (const match of line.matchAll(SHOWA_DATE_PATTERN)) {
      const year = Number.parseInt(match[1], 10) + 1925;
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, parseDateParts(year, month, day));
    }

    for (const pattern of DATE_PATTERNS) {
      for (const match of line.matchAll(pattern)) {
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        pushCandidate(lineIndex, parseDateParts(year, month, day));
      }
    }

    for (const match of line.matchAll(DATE_YEAR_LAST_PATTERN)) {
      const month = Number.parseInt(match[1], 10);
      const day = Number.parseInt(match[2], 10);
      const year = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, parseDateParts(year, month, day));
    }

    for (const match of line.matchAll(DATE_COMPACT_PATTERN)) {
      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, parseDateParts(year, month, day));
    }

    for (const match of line.matchAll(ENGLISH_DATE_MONTH_FIRST_PATTERN)) {
      const month = parseEnglishMonthName(match[1]);
      const day = Number.parseInt(match[2], 10);
      const year = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, month ? parseDateParts(year, month, day) : null);
    }

    for (const match of line.matchAll(ENGLISH_DATE_DAY_FIRST_PATTERN)) {
      const day = Number.parseInt(match[1], 10);
      const month = parseEnglishMonthName(match[2]);
      const year = Number.parseInt(match[3], 10);
      pushCandidate(lineIndex, month ? parseDateParts(year, month, day) : null);
    }
  });

  return candidates;
}

function parseAmount(value: string, decimal?: string): number | null {
  const normalized = value
    .replace(/(?:USD|JPY|US\$|[$¥￥]|円|,|，|\s)/gi, '')
    .trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  // 電話番号や登録番号の誤検出を避ける。
  if (normalized.length >= 9 && !value.includes(',') && !value.includes('，')) {
    return null;
  }

  const integerPart = Number.parseInt(normalized, 10);
  if (!Number.isFinite(integerPart) || integerPart <= 0) {
    return null;
  }

  const fraction = decimal ? Number.parseInt(decimal, 10) / 10 ** decimal.length : 0;
  const amount = integerPart + fraction;

  if (amount > 100_000_000) {
    return null;
  }

  return Number(amount.toFixed(2));
}

function extractAmountsFromLine(line: string): number[] {
  const amounts: number[] = [];

  for (const match of line.matchAll(POSITIVE_AMOUNT_PATTERN)) {
    const amount = parseAmount(match[1], match[2]);
    if (amount !== null) {
      amounts.push(amount);
    }
  }

  return amounts;
}

function scoreMerchantCandidate(line: string, lineIndex: number, totalLines: number): number {
  const compact = line.replace(/\s/g, '');
  const lower = line.toLowerCase();
  const letterCount = Array.from(compact).filter((char) =>
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z]/u.test(char)
  ).length;
  const digitCount = (compact.match(/\d/g) || []).length;
  const nonSpaceLength = compact.length;
  const letterRatio = nonSpaceLength > 0 ? letterCount / nonSpaceLength : 0;
  const hasAddressMarker = /(?:都|道|府|県|市|区|町|村|丁目|番地)/.test(line);

  let score = 0;

  if (lineIndex === 0) {
    score += 8;
  } else if (lineIndex <= 2) {
    score += 6;
  } else if (lineIndex <= 5) {
    score += 3;
  } else if (lineIndex <= Math.min(10, totalLines - 1)) {
    score += 1;
  } else {
    score -= 2;
  }

  if (nonSpaceLength >= 4 && nonSpaceLength <= 24) {
    score += 5;
  } else if (nonSpaceLength <= 36) {
    score += 2;
  } else {
    score -= 3;
  }

  if (digitCount === 0) {
    score += 4;
  } else if (digitCount <= 2) {
    score -= 1;
  } else {
    score -= 7;
  }

  if (letterRatio >= 0.8) {
    score += 4;
  } else if (letterRatio >= 0.6) {
    score += 2;
  } else {
    score -= 4;
  }

  if (MERCHANT_POSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    score += 3;
  }

  if (MERCHANT_NEGATIVE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    score -= 8;
  }

  if (hasAddressMarker) {
    score -= digitCount > 0 ? 8 : 4;
  }

  if (/[¥￥$]/.test(line)) {
    score -= 8;
  }

  if (/\b(?:https?:\/\/|www\.|co\.jp|\.com)\b/i.test(line)) {
    score -= 8;
  }

  if (/\d{1,2}:\d{2}/.test(line)) {
    score -= 8;
  }

  if (/(20\d{2}|19\d{2}|\d{2})[./-年](\d{1,2})[./-月](\d{1,2})日?/.test(line)) {
    score -= 8;
  }

  if (/[@#*_=~|\\]/.test(line)) {
    score -= 2;
  }

  return score;
}

export function extractDate(rawText: string): Date | null {
  const lines = normalizeDateText(rawText)
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const candidates = findDateCandidates(lines);
  if (candidates.length === 0) {
    return null;
  }

  const now = new Date();
  const pastOrToday = candidates
    .filter((candidate) => candidate.date.getTime() <= now.getTime())
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.date.getTime() - a.date.getTime();
    });

  if (pastOrToday.length > 0) {
    return pastOrToday[0].date;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.date.getTime() - b.date.getTime();
  });
  return candidates[0].date;
}

interface TotalCandidate {
  amount: number;
  score: number;
}

export function extractTotal(rawText: string): number | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const candidates: TotalCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const upper = line.toUpperCase();
    const hasPrimaryKeyword = PRIMARY_TOTAL_KEYWORDS.some((keyword) =>
      upper.includes(keyword.toUpperCase())
    );
    const hasExcludedKeyword = EXCLUDED_AMOUNT_KEYWORDS.some((keyword) =>
      upper.includes(keyword.toUpperCase())
    );

    if (hasExcludedKeyword && !hasPrimaryKeyword) {
      return;
    }

    const amounts = extractAmountsFromLine(line);
    if (amounts.length === 0) {
      return;
    }

    const hasCurrencySymbol = /(?:USD|JPY|US\$|[$¥￥])/i.test(line);
    const hasGroupedDigits = /\d{1,3}(?:[,，]\d{3})+/.test(line);

    for (const amount of amounts) {
      let score = 0;

      if (hasPrimaryKeyword && !hasExcludedKeyword) {
        score += 20;
      } else if (hasPrimaryKeyword) {
        score += 8;
      }

      if (hasCurrencySymbol) {
        score += 4;
      }

      if (hasGroupedDigits) {
        score += 3;
      }

      // 後半の行ほど合計に近い傾向（レシートは末尾に合計）
      const relativePos = lineIndex / Math.max(lines.length - 1, 1);
      if (relativePos >= 0.6) {
        score += 3;
      } else if (relativePos >= 0.4) {
        score += 1;
      }

      // 適切な金額範囲 (100円〜100万円)
      if (amount >= 100 && amount <= 1_000_000) {
        score += 2;
      } else if (amount < 100) {
        score -= 3;
      }

      candidates.push({ amount, score });
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  // スコア最高のものを選ぶ。同スコアなら大きい値を優先（合計は通常最大）
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.amount - a.amount;
  });

  return candidates[0].amount;
}

export function extractMerchant(rawText: string): string | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const candidates = lines
    .map((line, lineIndex) => ({
      line,
      lineIndex,
    }))
    .filter(({ line }) => {
    if (line.length < 2 || line.length > 48) {
      return false;
    }

    if (!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z]/u.test(line)) {
      return false;
    }

      return !MERCHANT_LINE_BLOCK_PATTERNS.some((pattern) => pattern.test(line));
    })
    .map(({ line, lineIndex }) => ({
      line,
      score: scoreMerchantCandidate(line, lineIndex, lines.length),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.line.length - b.line.length;
    });

  if (candidates.length === 0) {
    return null;
  }

  const winner = candidates[0];
  // スコア閾値を3に下げて、短いが正しい店名も拾えるようにする
  return winner && winner.score >= 3 ? winner.line : null;
}

export function extractReceiptFields(rawText: string): ExtractedReceiptFields {
  return {
    rawText,
    merchant: extractMerchant(rawText),
    date: extractDate(rawText),
    total: extractTotal(rawText),
  };
}
