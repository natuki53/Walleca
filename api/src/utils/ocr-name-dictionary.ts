// 辞書のエントリ種別（サブスク名 or 店名）
type OcrNameKind = 'subscription' | 'merchant';

// 辞書エントリの型定義
// canonical: 正規化された正式名称
// aliases: OCR で読み取られる可能性のある表記ゆれ一覧
interface OcrNameDictionaryEntry {
  canonical: string;
  aliases: string[];
  kind: OcrNameKind;
}

// 既知のサービス名・店名の正規化辞書
// OCR で読み取った文字列を正式名称に変換するために使用する
const OCR_NAME_DICTIONARY: OcrNameDictionaryEntry[] = [
  {
    canonical: 'Netflix',
    aliases: ['netflix', 'netflixpremium'],
    kind: 'subscription',
  },
  {
    canonical: 'Spotify Premium',
    aliases: ['spotify', 'spotifypremium'],
    kind: 'subscription',
  },
  {
    canonical: 'YouTube Premium',
    aliases: ['youtubepremium', 'youtube premium', 'ytpremium'],
    kind: 'subscription',
  },
  {
    canonical: 'ChatGPT Plus',
    aliases: ['chatgptplus', 'chatgpt', 'openaichatgptplus'],
    kind: 'subscription',
  },
  {
    canonical: 'Amazon Prime',
    aliases: ['amazonprime', 'primevideo', 'prime video'],
    kind: 'subscription',
  },
  {
    canonical: 'Apple Music',
    aliases: ['applemusic', 'apple music'],
    kind: 'subscription',
  },
  {
    canonical: 'Google One',
    aliases: ['googleone', 'google one'],
    kind: 'subscription',
  },
];

// 名前の表記を正規化する（全角→半角変換、小文字化、記号・空白除去）
function normalizeOcrName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s"'.,/\\|()[\]{}:;!?+_-]+/g, '');
}

// OCR で取得した候補名を辞書と照合し、一致する正規名称（canonical）を返す
// candidate（抽出した候補名）と rawText（元のテキスト全体）の両方でマッチングする
// 一致するエントリが見つからなければ candidate をそのまま返す
export function canonicalizeKnownOcrName(
  candidate: string | null,
  rawText: string,
  kind: OcrNameKind
): string | null {
  // 対象の kind（subscription / merchant）のエントリだけに絞る
  const scopedEntries = OCR_NAME_DICTIONARY.filter((entry) => entry.kind === kind);
  if (scopedEntries.length === 0) {
    return candidate;
  }

  const normalizedCandidate = candidate ? normalizeOcrName(candidate) : '';
  // rawText を行に分割して各行を正規化する
  const normalizedLines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeOcrName(line))
    .filter(Boolean);

  for (const entry of scopedEntries) {
    const normalizedAliases = entry.aliases.map(normalizeOcrName);

    // 候補名がエイリアスと一致または包含関係にある場合は正規名称を返す
    if (
      normalizedCandidate &&
      normalizedAliases.some((alias) =>
        normalizedCandidate === alias ||
        normalizedCandidate.includes(alias) ||
        alias.includes(normalizedCandidate)
      )
    ) {
      return entry.canonical;
    }

    // 候補名で一致しない場合、rawText の各行にエイリアスが含まれるかチェックする
    if (
      normalizedLines.some((line) =>
        normalizedAliases.some((alias) => line === alias || line.includes(alias))
      )
    ) {
      return entry.canonical;
    }
  }

  return candidate;
}
