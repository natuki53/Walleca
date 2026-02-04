import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { app } from './app';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  // データベース接続
  await connectDatabase();

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
