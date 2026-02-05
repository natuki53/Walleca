import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder, buildOrderBy } from '../utils/query-builder';
import { CreateViewInput, UpdateViewInput } from '../validators/view.validator';

export interface ViewListParams {
  page: number;
  limit: number;
  skip: number;
}

export interface ViewDataParams {
  page: number;
  limit: number;
  skip: number;
}

const viewSelect = {
  id: true,
  name: true,
  viewType: true,
  filters: true,
  sortConfig: true,
  groupBy: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
};

export class ViewService {
  async list(userId: string, params: ViewListParams) {
    const where = { userId };

    const [views, total] = await Promise.all([
      prisma.view.findMany({
        where,
        select: viewSelect,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: params.skip,
        take: params.limit,
      }),
      prisma.view.count({ where }),
    ]);

    return { views, total };
  }

  async create(userId: string, input: CreateViewInput) {
    // デフォルトビューに設定する場合、既存のデフォルトを解除
    if (input.isDefault) {
      await prisma.view.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await prisma.view.create({
      data: {
        userId,
        name: input.name,
        viewType: input.viewType,
        filters: input.filters || {},
        sortConfig: input.sortConfig || { field: 'transactionDate', order: 'desc' },
        groupBy: input.groupBy,
        isDefault: input.isDefault,
      },
      select: viewSelect,
    });

    return view;
  }

  async getById(userId: string, viewId: string) {
    const view = await prisma.view.findFirst({
      where: { id: viewId, userId },
      select: viewSelect,
    });

    if (!view) {
      throw Errors.notFound('ビュー');
    }

    return view;
  }

  async getData(userId: string, viewId: string, params: ViewDataParams) {
    const view = await prisma.view.findFirst({
      where: { id: viewId, userId },
    });

    if (!view) {
      throw Errors.notFound('ビュー');
    }

    const filters = view.filters as Record<string, unknown>;
    const sortConfig = view.sortConfig as { field: string; order: 'asc' | 'desc' };

    // フィルター条件を構築
    const qb = new QueryBuilder().where({ userId });

    if (filters.type) {
      qb.whereEquals('type', filters.type);
    }

    if (filters.merchant) {
      qb.whereContains('merchant', filters.merchant as string);
    }

    if (filters.dateFrom || filters.dateTo) {
      qb.whereDateRange(
        'transactionDate',
        filters.dateFrom ? new Date(filters.dateFrom as string) : undefined,
        filters.dateTo ? new Date(filters.dateTo as string) : undefined
      );
    }

    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      const amountCondition: Record<string, number> = {};
      if (filters.amountMin !== undefined) amountCondition.gte = filters.amountMin as number;
      if (filters.amountMax !== undefined) amountCondition.lte = filters.amountMax as number;
      qb.where({ amount: amountCondition });
    }

    const where = qb.build();

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          amount: true,
          transactionDate: true,
          merchant: true,
          properties: true,
          receiptId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: buildOrderBy(sortConfig.field, sortConfig.order),
        skip: params.skip,
        take: params.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    // グループ化が設定されている場合
    let grouped: Record<string, typeof transactions> | null = null;

    if (view.groupBy) {
      grouped = {};
      for (const tx of transactions) {
        const key = this.getGroupKey(tx, view.groupBy);
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(tx);
      }
    }

    return {
      view: {
        id: view.id,
        name: view.name,
        viewType: view.viewType,
      },
      transactions: grouped ? undefined : transactions,
      grouped,
      total,
    };
  }

  async update(userId: string, viewId: string, input: UpdateViewInput) {
    const existing = await prisma.view.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) {
      throw Errors.notFound('ビュー');
    }

    // デフォルトビューに設定する場合、既存のデフォルトを解除
    if (input.isDefault && !existing.isDefault) {
      await prisma.view.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await prisma.view.update({
      where: { id: viewId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.viewType !== undefined && { viewType: input.viewType }),
        ...(input.filters !== undefined && { filters: input.filters }),
        ...(input.sortConfig !== undefined && { sortConfig: input.sortConfig }),
        ...(input.groupBy !== undefined && { groupBy: input.groupBy }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      },
      select: viewSelect,
    });

    return view;
  }

  async delete(userId: string, viewId: string) {
    const existing = await prisma.view.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) {
      throw Errors.notFound('ビュー');
    }

    await prisma.view.delete({
      where: { id: viewId },
    });
  }

  private getGroupKey(
    tx: { transactionDate: Date; type: string; merchant: string | null },
    groupBy: string
  ): string {
    switch (groupBy) {
      case 'day':
        return tx.transactionDate.toISOString().slice(0, 10);
      case 'month':
        return tx.transactionDate.toISOString().slice(0, 7);
      case 'year':
        return tx.transactionDate.toISOString().slice(0, 4);
      case 'type':
        return tx.type;
      case 'merchant':
        return tx.merchant || '不明';
      default:
        return 'その他';
    }
  }
}

export const viewService = new ViewService();
