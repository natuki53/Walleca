import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { Errors } from '../utils/errors';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
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
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

// アップロードディレクトリ作成
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const uploadPath = path.join(UPLOAD_DIR, dateDir);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

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

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export const uploadConfig = {
  uploadDir: UPLOAD_DIR,
  maxFileSize: MAX_FILE_SIZE,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  allowedExtensions: ALLOWED_EXTENSIONS,
};
