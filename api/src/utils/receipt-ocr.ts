export interface ExtractedReceiptFields {
  rawText: string;
  merchant: string | null;
  date: Date | null;
  total: number | null;
}

const DATE_PATTERNS = [
  /(20\d{2}|19\d{2})[./-年](\d{1,2})[./-月](\d{1,2})日?/g,
  /(\d{2})[./-](\d{1,2})[./-](\d{1,2})/g,
];

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
];

const POSITIVE_AMOUNT_PATTERN = /([¥￥]?\s*\d{1,3}(?:[,，]\d{3})+|[¥￥]?\s*\d+)(?:\.(\d{1,2}))?/g;

const PRIMARY_TOTAL_KEYWORDS = [
  '合計',
  'ご利用額',
  'お会計',
  '領収金額',
  '請求額',
  '総合計',
  'TOTAL',
  'AMOUNT',
];

const EXCLUDED_AMOUNT_KEYWORDS = [
  '小計',
  '内税',
  '外税',
  '税',
  '値引',
  '割引',
  'お釣',
  '釣銭',
  '預り',
  'TEL',
  '電話',
];

const MERCHANT_LINE_BLOCK_PATTERNS = [
  /^\d+$/,
  /^〒?\d{3}-\d{4}$/,
  /^(?:tel|電話|phone|fax)/i,
  /(?:レシート|領収書|receipt|ありがとう|thank you)/i,
  /(20\d{2}|19\d{2}|\d{2})[./-年](\d{1,2})[./-月](\d{1,2})日?/,
  /\d{1,2}:\d{2}/,
  /(?:合計|小計|税込|税|total|amount)/i,
  /(?:取引|伝票|会計|レジ|担当)/,
  /[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}/,
];

function normalizeLine(line: string): string {
  return line
    .replace(/[\t\u3000]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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
  });

  return candidates;
}

function parseAmount(value: string, decimal?: string): number | null {
  const normalized = value
    .replace(/[¥￥,，\s]/g, '')
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

export function extractTotal(rawText: string): number | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const prioritized: number[] = [];
  const fallback: number[] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    const hasPrimaryKeyword = PRIMARY_TOTAL_KEYWORDS.some((keyword) =>
      upper.includes(keyword.toUpperCase())
    );
    const hasExcludedKeyword = EXCLUDED_AMOUNT_KEYWORDS.some((keyword) =>
      upper.includes(keyword.toUpperCase())
    );

    const amounts = extractAmountsFromLine(line);
    if (amounts.length === 0) {
      continue;
    }

    if (hasPrimaryKeyword && !hasExcludedKeyword) {
      prioritized.push(...amounts);
      continue;
    }

    const hasCurrencySymbol = /[¥￥]/.test(line);
    const hasGroupedDigits = /\d{1,3}(?:[,，]\d{3})+/.test(line);

    if (hasCurrencySymbol || hasGroupedDigits) {
      fallback.push(...amounts);
    }
  }

  const candidates = prioritized.length > 0 ? prioritized : fallback;

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

export function extractMerchant(rawText: string): string | null {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const candidates = lines.filter((line) => {
    if (line.length < 2 || line.length > 48) {
      return false;
    }

    if (!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z]/u.test(line)) {
      return false;
    }

    return !MERCHANT_LINE_BLOCK_PATTERNS.some((pattern) => pattern.test(line));
  });

  if (candidates.length === 0) {
    return null;
  }

  const topCandidates = candidates.slice(0, 8);
  const preferred = topCandidates.find((line) => {
    const hasAddressMarker = /(?:都|道|府|県|市|区|町|丁目)/.test(line);
    const hasDigit = /\d/.test(line);
    return !hasAddressMarker && !hasDigit;
  });

  return preferred ?? topCandidates[0];
}

export function extractReceiptFields(rawText: string): ExtractedReceiptFields {
  return {
    rawText,
    merchant: extractMerchant(rawText),
    date: extractDate(rawText),
    total: extractTotal(rawText),
  };
}
