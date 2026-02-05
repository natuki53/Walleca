import { startOcrWorker } from './ocr.worker';
import { startNotificationWorker } from './notification.worker';

const args = process.argv.slice(2);

if (args.includes('--ocr')) {
  startOcrWorker();
} else if (args.includes('--notification')) {
  startNotificationWorker();
} else {
  // デフォルトは全ワーカー起動
  startOcrWorker();
  startNotificationWorker();
}

console.log('Workers started');
