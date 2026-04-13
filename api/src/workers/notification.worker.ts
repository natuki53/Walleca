import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { advanceNextPaymentDateToCurrentOrFuture, addUtcDays, getCurrentUtcDate } from '../utils/subscription-date';

// 全ユーザーのサブスク支払日リマインダー通知を生成する
// ユーザー設定の「何日前に通知するか」に基づき、対象サブスクの通知レコードを作成する
async function generateSubscriptionReminders(): Promise<void> {
  const users = await prisma.user.findMany({
    include: { settings: true },
  });

  for (const user of users) {
    // ユーザーの通知設定（何日前に通知するか）を取得する。未設定の場合はデフォルト値を使用
    const daysBefore = user.settings?.subscriptionNotificationDaysBefore ?? 3;
    const enabled = user.settings?.subscriptionNotificationEnabled ?? true;
    if (!enabled) continue;

    const today = getCurrentUtcDate();
    // 今日から daysBefore 日後までの間に支払日があるサブスクを取得する
    const targetDate = addUtcDays(today, daysBefore);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: 'active',
        nextPaymentDate: {
          gte: today,
          lte: targetDate,
        },
      },
    });

    for (const sub of subscriptions) {
      // 同じサブスク・同じ支払日の通知が既に存在する場合は重複生成しない
      const existing = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          relatedSubscriptionId: sub.id,
          type: 'subscription_reminder',
          scheduledAt: { gte: today },
        },
      });
      if (existing) continue;

      // 通知レコードをデータベースに作成する
      const paymentDateStr = new Date(sub.nextPaymentDate).toLocaleDateString('ja-JP');
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'subscription_reminder',
          title: `${sub.serviceName} の支払い予定`,
          message: `${paymentDateStr} に ${Number(sub.amount).toLocaleString('ja-JP')}円 の支払いが予定されています。`,
          relatedSubscriptionId: sub.id,
          scheduledAt: new Date(sub.nextPaymentDate),
        },
      });
    }
  }
}

// 有効期限が切れた OCR ジョブ（confirmed 以外）をデータベースから削除する
async function cleanupExpiredOcrJobs(): Promise<void> {
  const now = new Date();

  const [deletedReceipts, deletedSubs] = await Promise.all([
    prisma.receiptOcrJob.deleteMany({
      where: {
        expiresAt: { lt: now },
        status: { notIn: ['confirmed'] },
      },
    }),
    prisma.subscriptionOcrJob.deleteMany({
      where: {
        expiresAt: { lt: now },
        status: { notIn: ['confirmed'] },
      },
    }),
  ]);

  if (deletedReceipts.count > 0 || deletedSubs.count > 0) {
    logger.info(`Cleaned up ${deletedReceipts.count} receipt OCR jobs, ${deletedSubs.count} subscription OCR jobs`);
  }
}

// 有効期限が切れたリフレッシュトークンをデータベースから削除する
async function cleanupExpiredRefreshTokens(): Promise<void> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (count > 0) {
    logger.info(`Cleaned up ${count} expired refresh tokens`);
  }
}

// 次回支払日が過去になっている有効サブスクの支払日を現在以降に進める
async function advanceSubscriptionPaymentDates(): Promise<void> {
  const today = getCurrentUtcDate();

  const staleSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextPaymentDate: { lt: today },
    },
  });

  for (const sub of staleSubscriptions) {
    const advanced = advanceNextPaymentDateToCurrentOrFuture(
      new Date(sub.nextPaymentDate),
      sub.billingCycle,
      today,
    );
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextPaymentDate: advanced },
    });
  }

  if (staleSubscriptions.length > 0) {
    logger.info(`Advanced ${staleSubscriptions.length} subscription payment dates`);
  }
}

// 毎日実行する定期バッチ。支払日更新・リマインダー生成・クリーンアップを順番に実行する
export async function runDailyJobs(): Promise<void> {
  logger.info('Running daily jobs...');
  try {
    await advanceSubscriptionPaymentDates();
    await generateSubscriptionReminders();
    await cleanupExpiredOcrJobs();
    await cleanupExpiredRefreshTokens();
    logger.info('Daily jobs completed');
  } catch (err) {
    logger.error('Daily jobs failed:', err);
  }
}

// 通知ワーカーを起動するエントリポイント
// 起動直後に日次バッチを実行し、以降は 24 時間ごとに繰り返す
export async function startNotificationWorker(): Promise<void> {
  logger.info('Notification worker started');

  // 起動時に即実行して初回の処理を行う
  await runDailyJobs();

  // 24時間（ミリ秒換算）ごとに繰り返す
  setInterval(() => {
    runDailyJobs().catch((err) => logger.error('Scheduled job error:', err));
  }, 24 * 60 * 60 * 1000);
}
