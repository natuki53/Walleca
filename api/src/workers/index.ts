import { logger } from '../utils/logger';
import { startOcrWorker } from './ocr.worker';
import { startNotificationWorker } from './notification.worker';

// コマンドライン引数でどのワーカーを起動するか選択できる
// --ocr: OCR ワーカーのみ起動
// --notification: 通知ワーカーのみ起動
// 引数なし: 全ワーカーを起動
const mode = process.argv[2];

async function main() {
  if (mode === '--ocr') {
    logger.info('Starting OCR worker...');
    startOcrWorker();
    logger.info('OCR worker running');
  } else if (mode === '--notification') {
    logger.info('Starting notification worker...');
    await startNotificationWorker();
  } else {
    // デフォルトは全ワーカーを起動する
    logger.info('Starting all workers...');
    startOcrWorker();
    await startNotificationWorker();
  }
}

// ワーカー起動失敗時はエラーをログに残してプロセスを終了する
main().catch((err) => {
  logger.error('Worker startup failed:', err);
  process.exit(1);
});
