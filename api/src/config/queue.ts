import { Queue, Worker, Job, QueueEvents } from 'bullmq';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

export const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
};

// キュー名
export const QUEUE_NAMES = {
  OCR: 'ocr-queue',
  NOTIFICATION: 'notification-queue',
} as const;

// OCRキュー
export const ocrQueue = new Queue(QUEUE_NAMES.OCR, { connection });

// 通知キュー
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, { connection });

// ジョブデータ型
export interface OcrJobData {
  receiptId: string;
  imagePath: string;
  userId: string;
}

export interface NotificationJobData {
  userId: string;
  type: 'subscription_reminder' | 'system' | 'info';
  title: string;
  message?: string;
  relatedId?: string;
  scheduledAt?: Date;
}

// キューにジョブを追加するヘルパー
export async function addOcrJob(data: OcrJobData): Promise<Job<OcrJobData>> {
  return ocrQueue.add('process-receipt', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

export async function addNotificationJob(data: NotificationJobData): Promise<Job<NotificationJobData>> {
  const options: Parameters<typeof notificationQueue.add>[2] = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  };

  if (data.scheduledAt) {
    options.delay = data.scheduledAt.getTime() - Date.now();
  }

  return notificationQueue.add('send-notification', data, options);
}

export { Queue, Worker, Job, QueueEvents };
