import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder, buildOrderBy } from '../utils/query-builder';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator';
import { TransactionType, Prisma } from '@prisma/client';

export interface TransactionListParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  type?: TransactionType;
  from?: Date;
  to?: Date;
  merchant?: string;
}

export interface TransactionSummaryParams {
  from?: Date;
  to?: Date;
  groupBy?: 'day' | 'week' | 'month' | 'year' | 'type';
}

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  transactionDate: true,
  merchant: true,
  properties: true,
  receiptId: true,
  createdAt: true,
  updatedAt: true,
};

export class TransactionService {
  async list(userId: string, params: TransactionListParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('type', params.type)
      .whereContains('merchant', params.merchant)
      .whereDateRange('transactionDate', params.from, params.to)
      .build();

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: transactionSelect,
        orderBy: buildOrderBy(params.sortBy, params.sortOrder),
        skip: params.skip,
        take: params.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  async create(userId: string, input: CreateTransactionInput) {
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: input.amount,
        transactionDate: new Date(input.transactionDate),
        merchant: input.merchant,
        properties: (input.properties || {}) as Prisma.InputJsonValue,
      },
      select: transactionSelect,
    });

    return transaction;
  }

  async getById(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      select: {
        ...transactionSelect,
        receipt: {
          select: {
            id: true,
            imagePath: true,
            ocrStatus: true,
          },
        },
      },
    });

    if (!transaction) {
      throw Errors.notFound('取引');
    }

    return transaction;
  }

  async update(userId: string, transactionId: string, input: UpdateTransactionInput) {
    // 所有権チェック
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw Errors.notFound('取引');
    }

    const updateData: Prisma.TransactionUpdateInput = {};
    if (input.type !== undefined) updateData.type = input.type;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.transactionDate !== undefined) updateData.transactionDate = new Date(input.transactionDate);
    if (input.merchant !== undefined) updateData.merchant = input.merchant;
    if (input.properties !== undefined) updateData.properties = input.properties as Prisma.InputJsonValue;

    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
      select: transactionSelect,
    });

    return transaction;
  }

  async delete(userId: string, transactionId: string) {
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw Errors.notFound('取引');
    }

    await prisma.transaction.delete({
      where: { id: transactionId },
    });
  }

  async getSummary(userId: string, params: TransactionSummaryParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereDateRange('transactionDate', params.from, params.to)
      .build();

    // 基本集計
    const aggregation = await prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const summary = {
      expense: { total: 0, count: 0 },
      income: { total: 0, count: 0 },
      adjustment: { total: 0, count: 0 },
    };

    for (const item of aggregation) {
      summary[item.type] = {
        total: Number(item._sum.amount) || 0,
        count: item._count,
      };
    }

    const balance = summary.income.total - summary.expense.total + summary.adjustment.total;

    // グループ化集計
    let grouped: Array<{ period: string; expense: number; income: number; adjustment: number }> = [];

    if (params.groupBy && params.groupBy !== 'type') {
      const dateFormat = this.getDateFormat(params.groupBy);

      const rawResult = await prisma.$queryRaw<Array<{ period: string; type: string; total: number }>>`
        SELECT
          TO_CHAR(transaction_date, ${dateFormat}) as period,
          type::text,
          SUM(amount)::float as total
        FROM transactions
        WHERE user_id = ${userId}::uuid
          ${params.from ? Prisma.sql`AND transaction_date >= ${params.from}` : Prisma.empty}
          ${params.to ? Prisma.sql`AND transaction_date <= ${params.to}` : Prisma.empty}
        GROUP BY period, type
        ORDER BY period
      `;

      // 結果を整形
      const periodMap = new Map<string, { expense: number; income: number; adjustment: number }>();

      for (const row of rawResult) {
        if (!periodMap.has(row.period)) {
          periodMap.set(row.period, { expense: 0, income: 0, adjustment: 0 });
        }
        const entry = periodMap.get(row.period)!;
        entry[row.type as keyof typeof entry] = row.total;
      }

      grouped = Array.from(periodMap.entries()).map(([period, data]) => ({
        period,
        ...data,
      }));
    }

    return {
      summary,
      balance,
      grouped,
    };
  }

  private getDateFormat(groupBy: string): string {
    switch (groupBy) {
      case 'day':
        return 'YYYY-MM-DD';
      case 'week':
        return 'IYYY-IW';
      case 'month':
        return 'YYYY-MM';
      case 'year':
        return 'YYYY';
      default:
        return 'YYYY-MM-DD';
    }
  }
}

export const transactionService = new TransactionService();
