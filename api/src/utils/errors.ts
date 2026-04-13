// アプリケーションで使用するエラーコードの型定義
export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_UNAUTHORIZED'
  | 'NOT_IMPLEMENTED'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'DUPLICATE_ENTRY'
  | 'INTERNAL_ERROR';

// アプリケーション独自のエラークラス。エラーコード・HTTPステータス・詳細情報を持つ
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

  // HTTP レスポンスに適した JSON 形式に変換する
  toJSON() {
    const errorObj: { code: ErrorCode; message: string; details?: unknown } = {
      code: this.code,
      message: this.message,
    };
    if (this.details) {
      errorObj.details = this.details;
    }
    return {
      success: false,
      error: errorObj,
    };
  }
}

// よく使うエラーのファクトリ関数（new AppError(...) を簡単に書けるようにする）
export const Errors = {
  // 認証情報が正しくない場合（メール・パスワード不一致）
  invalidCredentials: () =>
    new AppError('AUTH_INVALID_CREDENTIALS', 'メールアドレスまたはパスワードが正しくありません', 401),

  // アクセストークンの有効期限が切れている場合
  tokenExpired: () =>
    new AppError('AUTH_TOKEN_EXPIRED', 'トークンの有効期限が切れています', 401),

  // トークンの形式や署名が不正な場合
  tokenInvalid: () =>
    new AppError('AUTH_TOKEN_INVALID', '無効なトークンです', 401),

  // 認証が必要なエンドポイントにトークンなしでアクセスした場合
  unauthorized: () =>
    new AppError('AUTH_UNAUTHORIZED', '認証が必要です', 401),

  // 指定したリソースが見つからない場合
  notFound: (resource: string) =>
    new AppError('RESOURCE_NOT_FOUND', `${resource}が見つかりません`, 404),

  // 入力値のバリデーションに失敗した場合
  validation: (message: string, details?: unknown) =>
    new AppError('VALIDATION_ERROR', message, 400, details),

  // アップロードファイルのサイズが上限を超えた場合
  fileTooLarge: (maxSize: number) =>
    new AppError('FILE_TOO_LARGE', `ファイルサイズが上限(${maxSize / 1024 / 1024}MB)を超えています`, 400),

  // 許可されていないファイル形式をアップロードしようとした場合
  fileTypeNotAllowed: (allowedTypes: string[]) =>
    new AppError('FILE_TYPE_NOT_ALLOWED', `許可されているファイル形式: ${allowedTypes.join(', ')}`, 400),

  // 一意制約に違反する重複データが存在する場合
  duplicate: (field: string) =>
    new AppError('DUPLICATE_ENTRY', `この${field}は既に使用されています`, 409),

  // まだ実装されていない機能にアクセスした場合
  notImplemented: (feature: string) =>
    new AppError('NOT_IMPLEMENTED', `${feature} はまだ実装されていません`, 501),

  // その他のサーバー内部エラー
  internal: (message = 'サーバーエラーが発生しました') =>
    new AppError('INTERNAL_ERROR', message, 500),
};
