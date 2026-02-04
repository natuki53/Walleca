export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_UNAUTHORIZED'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'DUPLICATE_ENTRY'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public override message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// よく使うエラーのファクトリ関数
export const Errors = {
  invalidCredentials: () =>
    new AppError('AUTH_INVALID_CREDENTIALS', 'メールアドレスまたはパスワードが正しくありません', 401),

  tokenExpired: () =>
    new AppError('AUTH_TOKEN_EXPIRED', 'トークンの有効期限が切れています', 401),

  tokenInvalid: () =>
    new AppError('AUTH_TOKEN_INVALID', '無効なトークンです', 401),

  unauthorized: () =>
    new AppError('AUTH_UNAUTHORIZED', '認証が必要です', 401),

  notFound: (resource: string) =>
    new AppError('RESOURCE_NOT_FOUND', `${resource}が見つかりません`, 404),

  validation: (message: string, details?: unknown) =>
    new AppError('VALIDATION_ERROR', message, 400, details),

  fileTooLarge: (maxSize: number) =>
    new AppError('FILE_TOO_LARGE', `ファイルサイズが上限(${maxSize / 1024 / 1024}MB)を超えています`, 400),

  fileTypeNotAllowed: (allowedTypes: string[]) =>
    new AppError('FILE_TYPE_NOT_ALLOWED', `許可されているファイル形式: ${allowedTypes.join(', ')}`, 400),

  duplicate: (field: string) =>
    new AppError('DUPLICATE_ENTRY', `この${field}は既に使用されています`, 409),

  internal: (message = 'サーバーエラーが発生しました') =>
    new AppError('INTERNAL_ERROR', message, 500),
};
