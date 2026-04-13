import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { Errors } from '../utils/errors';

// ファイルのアップロード先ディレクトリ
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
// アップロード可能な最大ファイルサイズ（バイト）。デフォルトは 10MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
// 許可する MIME タイプ一覧
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];
// 許可するファイル拡張子一覧
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

// アップロードディレクトリが存在しない場合は作成する
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer のディスクストレージ設定。日付ごとにサブディレクトリを作成してファイルを保存する
const storage = multer.diskStorage({
  // アップロード先ディレクトリを日付（YYYY/MM/DD）で決定する
  destination: (_req, _file, cb) => {
    const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const uploadPath = path.join(UPLOAD_DIR, dateDir);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  // ファイル名を UUID + 元の拡張子に変換して衝突を防ぐ
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// MIME タイプと拡張子で許可するファイルかチェックするフィルター
// HEIC などは MIME が generic になる場合があるため、拡張子でも許可する
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const mimeType = (file.mimetype || '').toLowerCase();
  const extension = path.extname(file.originalname).toLowerCase();
  const isAllowedMimeType = ALLOWED_MIME_TYPES.includes(mimeType);
  const isAllowedExtension = ALLOWED_EXTENSIONS.includes(extension);
  const isGenericMimeType = mimeType === '' || mimeType === 'application/octet-stream';

  if (
    isAllowedMimeType ||
    (isAllowedExtension && isGenericMimeType)
  ) {
    cb(null, true);
  } else {
    cb(Errors.fileTypeNotAllowed([...ALLOWED_MIME_TYPES, ...ALLOWED_EXTENSIONS]));
  }
};

// Multer インスタンス。ストレージ・フィルター・サイズ上限を設定している
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// 外部から参照できるアップロード設定のエクスポート
export const uploadConfig = {
  uploadDir: UPLOAD_DIR,
  maxFileSize: MAX_FILE_SIZE,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  allowedExtensions: ALLOWED_EXTENSIONS,
};
