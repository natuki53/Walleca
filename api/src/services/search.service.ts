import { prisma } from '../config/database';

export interface SearchParams {
  q: string;
  page: number;
  limit: number;
  skip: number;
  type: 'all' | 'transactions' | 'subscriptions';
}

export class SearchService {
  async search(userId: string, params: SearchParams) {
    const query = `%${params.q}%`;

    const results: {
      transactions: Array<{
        id: string;
        type: string;
        amount: number;
        transactionDate: Date;
        merchant: string | null;
      }>;
      subscriptions: Array<{
        id: string;
        serviceName: string;
        amount: number;
        status: string;
        category: string | null;
      }>;
    } = {
      transactions: [],
      subscriptions: [],
    };

    const counts = {
      transactions: 0,
      subscriptions: 0,
    };

    // 取引を検索
    if (params.type === 'all' || params.type === 'transactions') {
      const [transactions, transactionCount] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            userId,
            OR: [
              { merchant: { contains: params.q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            type: true,
            amount: true,
            transactionDate: true,
            merchant: true,
          },
          orderBy: { transactionDate: 'desc' },
          skip: params.type === 'transactions' ? params.skip : 0,
          take: params.type === 'transactions' ? params.limit : 5,
        }),
        prisma.transaction.count({
          where: {
            userId,
            OR: [
              { merchant: { contains: params.q, mode: 'insensitive' } },
            ],
          },
        }),
      ]);

      results.transactions = transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      }));
      counts.transactions = transactionCount;
    }

    // サブスクリプションを検索
    if (params.type === 'all' || params.type === 'subscriptions') {
      const [subscriptions, subscriptionCount] = await Promise.all([
        prisma.subscription.findMany({
          where: {
            userId,
            OR: [
              { serviceName: { contains: params.q, mode: 'insensitive' } },
              { category: { contains: params.q, mode: 'insensitive' } },
              { memo: { contains: params.q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            serviceName: true,
            amount: true,
            status: true,
            category: true,
          },
          orderBy: { serviceName: 'asc' },
          skip: params.type === 'subscriptions' ? params.skip : 0,
          take: params.type === 'subscriptions' ? params.limit : 5,
        }),
        prisma.subscription.count({
          where: {
            userId,
            OR: [
              { serviceName: { contains: params.q, mode: 'insensitive' } },
              { category: { contains: params.q, mode: 'insensitive' } },
              { memo: { contains: params.q, mode: 'insensitive' } },
            ],
          },
        }),
      ]);

      results.subscriptions = subscriptions.map((s) => ({
        ...s,
        amount: Number(s.amount),
      }));
      counts.subscriptions = subscriptionCount;
    }

    return {
      query: params.q,
      results,
      counts,
      total: counts.transactions + counts.subscriptions,
    };
  }
}

export const searchService = new SearchService();
