const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];
const DEFAULT_HEIC_EXTENSIONS = ['.heic', '.heif'];
const DEFAULT_HEIC_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeExtension(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('.') ? normalized : `.${normalized}`;
}

function parseExtensionList(value: string | undefined, fallback: readonly string[]): string[] {
  if (!value) {
    return [...fallback];
  }

  const parsed = value
    .split(',')
    .map((token) => normalizeExtension(token))
    .filter((token): token is string => token.length > 1);

  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique : [...fallback];
}

function parseMimeTypeList(value: string | undefined, fallback: readonly string[]): string[] {
  if (!value) {
    return [...fallback];
  }

  const parsed = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token): token is string => token.length > 0 && token.includes('/'));

  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique : [...fallback];
}

const allowedExtensions = parseExtensionList(
  process.env.NEXT_PUBLIC_UPLOAD_ALLOWED_EXTENSIONS,
  DEFAULT_ALLOWED_EXTENSIONS
);

const allowedMimeTypes = parseMimeTypeList(
  process.env.NEXT_PUBLIC_UPLOAD_ALLOWED_MIME_TYPES,
  DEFAULT_ALLOWED_MIME_TYPES
);

export const uploadClientConfig = {
  maxFileSizeBytes: parsePositiveInt(
    process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE,
    DEFAULT_MAX_FILE_SIZE_BYTES
  ),
  allowedExtensions,
  allowedMimeTypes,
  heicExtensions: parseExtensionList(
    process.env.NEXT_PUBLIC_UPLOAD_HEIC_EXTENSIONS,
    DEFAULT_HEIC_EXTENSIONS
  ),
  heicMimeTypes: [...DEFAULT_HEIC_MIME_TYPES],
  fileInputAccept: [...allowedMimeTypes, ...allowedExtensions].join(','),
} as const;
