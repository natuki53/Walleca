import dotenv from 'dotenv';

// .env ファイルを読み込んで環境変数をセットする
dotenv.config();

// アプリケーション全体で使用する設定値をまとめたオブジェクト
export const config = {
  // 実行環境の種別（development / production など）
  nodeEnv: process.env.NODE_ENV || 'development',
  // サーバーが待ち受けるポート番号
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    // データベース接続 URL
    url: process.env.DATABASE_URL!,
  },

  redis: {
    // Redis 接続 URL
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    // アクセストークン署名秘密鍵
    secret: process.env.JWT_SECRET!,
    // リフレッシュトークン署名秘密鍵
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    // アクセストークンの有効期限
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    // リフレッシュトークンの有効期限
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  storage: {
    // アップロードファイルの保存ディレクトリ
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    // アップロード可能な最大ファイルサイズ（バイト）
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
} as const;

// 必須環境変数のチェック
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

// 必須の環境変数が未設定の場合は起動時にエラーを throw する
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
