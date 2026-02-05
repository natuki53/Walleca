import { Worker, Job } from 'bullmq';
import { connection, QUEUE_NAMES, NotificationJobData } from '../config/queue';
import { prisma } from '../config/database';

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { userId, type, title, message, relatedId } = job.data;

  console.log(`Processing notification for user: ${userId}`);

  // 通知を作成
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      relatedId,
    },
  });

  console.log(`Notification created for user: ${userId}`);
}

export function startNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    processNotification,
    {
      connection,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err.message);
  });

  console.log('Notification Worker started');

  return worker;
}

// サブスクリプションのリマインダーをスケジュール
export async function scheduleSubscriptionReminders(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // 明日支払いのサブスクリプションを取得
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextPaymentDate: {
        gte: tomorrow,
        lt: dayAfter,
      },
    },
    include: { user: true },
  });

  const { addNotificationJob } = await import('../config/queue');

  for (const sub of subscriptions) {
    await addNotificationJob({
      userId: sub.userId,
      type: 'subscription_reminder',
      title: `${sub.serviceName}の支払い日が近づいています`,
      message: `明日、${sub.serviceName}の支払い（¥${sub.amount}）があります。`,
      relatedId: sub.id,
    });
  }

  console.log(`Scheduled ${subscriptions.length} subscription reminders`);
}
