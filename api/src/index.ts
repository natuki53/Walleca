import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { app } from './app';
import { logger } from './utils/logger';
import { startOcrWorker } from './workers/ocr.worker';

// アプリケーションのエントリポイント。データベース接続・サーバー起動・シャットダウン処理を行う
async function main(): Promise<void> {
  // データベースに接続する
  await connectDatabase();

  // 環境変数または開発環境かどうかに応じて OCR ワーカーを自動起動するか判定する
  const shouldAutoStartOcrWorker = process.env.AUTO_START_OCR_WORKER
    ? process.env.AUTO_START_OCR_WORKER === 'true'
    : config.nodeEnv === 'development';
  const ocrWorker = shouldAutoStartOcrWorker ? startOcrWorker() : null;

  if (ocrWorker) {
    logger.info('OCR worker auto-started in API process');
  }

  // HTTP サーバーを指定ポートで起動する
  const server = app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
  });

  // SIGTERM / SIGINT シグナルを受け取ったときにグレースフルシャットダウンを行う
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // HTTP サーバーを閉じ、接続がすべて終わったら後処理を実行する
    server.close(async () => {
      logger.info('HTTP server closed');
      if (ocrWorker) {
        // OCR ワーカーを停止する
        await ocrWorker.close();
        logger.info('OCR worker closed');
      }
      // データベース接続を切断する
      await disconnectDatabase();
      process.exit(0);
    });

    // 一定時間内にシャットダウンが完了しなければ強制終了する
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  // OS シグナルに対してシャットダウン関数を登録する
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// 起動失敗時はエラーをログに残してプロセスを終了する
main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
