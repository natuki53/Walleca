import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { config } from './index';

// Redis URL を解析して接続パラメータを取得する
const redisUrl = new URL(config.redis.url);
// URL パスにデータベース番号が指定されている場合はパースする
const redisDb = redisUrl.pathname.length > 1
  ? parseInt(redisUrl.pathname.slice(1), 10)
  : undefined;

// BullMQ 用の Redis 接続設定。TLS を使う場合は tls オプションを付与する
export const connection = {
  host: redisUrl.hostname || 'localhost',
  port: parseInt(redisUrl.port || '6379', 10),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: Number.isNaN(redisDb) ? undefined : redisDb,
  maxRetriesPerRequest: null,
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
};

// キュー名の定数
export const QUEUE_NAMES = {
  OCR: 'ocr-queue',
  NOTIFICATION: 'notification-queue',
} as const;

// レシート・サブスク画像の OCR 処理キュー
export const ocrQueue = new Queue(QUEUE_NAMES.OCR, { connection });

// プッシュ通知・リマインダー送信キュー
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, { connection });

// OCR ジョブに渡すデータの型
export interface OcrJobData {
  receiptId: string;
  imagePath: string;
  userId: string;
}

// 通知ジョブに渡すデータの型
export interface NotificationJobData {
  userId: string;
  type: 'subscription_reminder' | 'system' | 'info';
  title: string;
  message?: string;
  relatedId?: string;
  scheduledAt?: Date;
}

// OCR キューにジョブを追加する。失敗時は指数バックオフで最大 3 回リトライする
export async function addOcrJob(data: OcrJobData): Promise<Job<OcrJobData>> {
  return ocrQueue.add('process-receipt', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

// 通知キューにジョブを追加する。scheduledAt が指定されていれば遅延実行する
export async function addNotificationJob(data: NotificationJobData): Promise<Job<NotificationJobData>> {
  const options: Parameters<typeof notificationQueue.add>[2] = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  };

  // 予定日時が設定されている場合は現在時刻からの差分をミリ秒で遅延として設定する
  if (data.scheduledAt) {
    options.delay = data.scheduledAt.getTime() - Date.now();
  }

  return notificationQueue.add('send-notification', data, options);
}

export { Queue, Worker, Job, QueueEvents };
