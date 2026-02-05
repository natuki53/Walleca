import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder, buildOrderBy } from '../utils/query-builder';
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '../validators/subscription.validator';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';

export interface SubscriptionListParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  category?: string;
}

export interface SubscriptionSummaryParams {
  status?: SubscriptionStatus;
}

const subscriptionSelect = {
  id: true,
  serviceName: true,
  amount: true,
  billingCycle: true,
  nextPaymentDate: true,
  category: true,
  status: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
};

export class SubscriptionService {
  async list(userId: string, params: SubscriptionListParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('status', params.status)
      .whereEquals('billingCycle', params.billingCycle)
      .whereEquals('category', params.category)
      .build();

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        select: subscriptionSelect,
        orderBy: buildOrderBy(params.sortBy, params.sortOrder),
        skip: params.skip,
        take: params.limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return { subscriptions, total };
  }

  async create(userId: string, input: CreateSubscriptionInput) {
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        serviceName: input.serviceName,
        amount: input.amount,
        billingCycle: input.billingCycle,
        nextPaymentDate: new Date(input.nextPaymentDate),
        category: input.category,
        status: input.status,
        memo: input.memo,
      },
      select: subscriptionSelect,
    });

    return subscription;
  }

  async getById(userId: string, subscriptionId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
      select: subscriptionSelect,
    });

    if (!subscription) {
      throw Errors.notFound('サブスクリプション');
    }

    return subscription;
  }

  async update(userId: string, subscriptionId: string, input: UpdateSubscriptionInput) {
    const existing = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!existing) {
      throw Errors.notFound('サブスクリプション');
    }

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...(input.serviceName !== undefined && { serviceName: input.serviceName }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.billingCycle !== undefined && { billingCycle: input.billingCycle }),
        ...(input.nextPaymentDate !== undefined && {
          nextPaymentDate: new Date(input.nextPaymentDate),
        }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.memo !== undefined && { memo: input.memo }),
      },
      select: subscriptionSelect,
    });

    return subscription;
  }

  async delete(userId: string, subscriptionId: string) {
    const existing = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!existing) {
      throw Errors.notFound('サブスクリプション');
    }

    await prisma.subscription.delete({
      where: { id: subscriptionId },
    });
  }

  async getSummary(userId: string, params: SubscriptionSummaryParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('status', params.status ?? 'active')
      .build();

    const subscriptions = await prisma.subscription.findMany({
      where,
      select: {
        amount: true,
        billingCycle: true,
        category: true,
      },
    });

    // 月額換算で集計
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    const byCategory: Record<string, number> = {};

    for (const sub of subscriptions) {
      const amount = Number(sub.amount);
      const monthlyAmount = sub.billingCycle === 'yearly' ? amount / 12 : amount;
      const yearlyAmount = sub.billingCycle === 'monthly' ? amount * 12 : amount;

      monthlyTotal += monthlyAmount;
      yearlyTotal += yearlyAmount;

      const category = sub.category || '未分類';
      byCategory[category] = (byCategory[category] || 0) + monthlyAmount;
    }

    // 今後7日以内に支払いがあるサブスクリプション
    const upcomingPayments = await prisma.subscription.findMany({
      where: {
        userId,
        status: 'active',
        nextPaymentDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        serviceName: true,
        amount: true,
        nextPaymentDate: true,
      },
      orderBy: { nextPaymentDate: 'asc' },
    });

    return {
      count: subscriptions.length,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      yearlyTotal: Math.round(yearlyTotal * 100) / 100,
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({
        category,
        monthlyAmount: Math.round(amount * 100) / 100,
      })),
      upcomingPayments,
    };
  }
}

export const subscriptionService = new SubscriptionService();
