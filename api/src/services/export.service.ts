import { prisma } from '../config/database';
import { QueryBuilder } from '../utils/query-builder';
import { TransactionType, SubscriptionStatus } from '@prisma/client';

export interface ExportTransactionsParams {
  from?: Date;
  to?: Date;
  type?: TransactionType;
  format: 'csv' | 'json';
}

export interface ExportSubscriptionsParams {
  status?: SubscriptionStatus;
  format: 'csv' | 'json';
}

export class ExportService {
  async exportTransactions(userId: string, params: ExportTransactionsParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('type', params.type)
      .whereDateRange('transactionDate', params.from, params.to)
      .build();

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        amount: true,
        transactionDate: true,
        merchant: true,
        properties: true,
        createdAt: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    if (params.format === 'json') {
      return {
        contentType: 'application/json',
        filename: `transactions_${new Date().toISOString().slice(0, 10)}.json`,
        data: JSON.stringify(transactions, null, 2),
      };
    }

    // CSV形式
    const headers = ['ID', '種類', '金額', '取引日', '店舗', '作成日'];
    const rows = transactions.map((t) => [
      t.id,
      t.type,
      t.amount.toString(),
      t.transactionDate.toISOString().slice(0, 10),
      t.merchant || '',
      t.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `transactions_${new Date().toISOString().slice(0, 10)}.csv`,
      data: '\uFEFF' + csv, // BOM for Excel
    };
  }

  async exportSubscriptions(userId: string, params: ExportSubscriptionsParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('status', params.status)
      .build();

    const subscriptions = await prisma.subscription.findMany({
      where,
      select: {
        id: true,
        serviceName: true,
        amount: true,
        billingCycle: true,
        nextPaymentDate: true,
        category: true,
        status: true,
        memo: true,
        createdAt: true,
      },
      orderBy: { serviceName: 'asc' },
    });

    if (params.format === 'json') {
      return {
        contentType: 'application/json',
        filename: `subscriptions_${new Date().toISOString().slice(0, 10)}.json`,
        data: JSON.stringify(subscriptions, null, 2),
      };
    }

    // CSV形式
    const headers = ['ID', 'サービス名', '金額', '請求サイクル', '次回支払日', 'カテゴリ', 'ステータス', 'メモ', '作成日'];
    const rows = subscriptions.map((s) => [
      s.id,
      s.serviceName,
      s.amount.toString(),
      s.billingCycle,
      s.nextPaymentDate.toISOString().slice(0, 10),
      s.category || '',
      s.status,
      s.memo || '',
      s.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `subscriptions_${new Date().toISOString().slice(0, 10)}.csv`,
      data: '\uFEFF' + csv, // BOM for Excel
    };
  }
}

export const exportService = new ExportService();
