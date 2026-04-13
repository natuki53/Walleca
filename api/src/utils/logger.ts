// ログレベルの型定義（重要度順: debug < info < warn < error）
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ログレベルを数値に変換してフィルタリングに使用する
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 環境変数 LOG_LEVEL、または NODE_ENV に基づいて出力する最低ログレベルを決定する
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// タイムスタンプ・レベル・メッセージ・メタ情報を含むログ文字列を生成する
function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

// 指定したログレベルが現在の設定レベル以上かどうかを判定する
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

// アプリケーション全体で使用するロガーオブジェクト
export const logger = {
  // デバッグ情報の出力（開発環境のみ）
  debug(message: string, meta?: unknown): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  // 通常の情報ログの出力
  info(message: string, meta?: unknown): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  },

  // 警告ログの出力（注意が必要だがエラーではない場合）
  warn(message: string, meta?: unknown): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  // エラーログの出力。Error インスタンスの場合はスタックトレースも出力する
  error(message: string, error?: unknown): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message));
      if (error instanceof Error) {
        console.error(error.stack);
      } else if (error) {
        console.error(error);
      }
    }
  },
};
