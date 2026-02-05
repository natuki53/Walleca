import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { app } from './app';
import { logger } from './utils/logger';
import { startOcrWorker } from './workers/ocr.worker';

async function main(): Promise<void> {
  const autoStartOcrWorker = process.env.AUTO_START_OCR_WORKER === 'true'
    || (
      process.env.AUTO_START_OCR_WORKER !== 'false'
      && config.nodeEnv !== 'production'
    );

  // データベース接続
  await connectDatabase();

  const ocrWorker = autoStartOcrWorker ? startOcrWorker() : null;
  if (ocrWorker) {
    logger.info('OCR worker auto-start is enabled');
  } else {
    logger.info('OCR worker auto-start is disabled. Run `npm run worker:ocr` in another process.');
  }

  // サーバー起動
  const server = app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      if (ocrWorker) {
        await ocrWorker.close();
        logger.info('OCR worker closed');
      }

      await disconnectDatabase();
      process.exit(0);
    });

    // 強制終了タイムアウト
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
