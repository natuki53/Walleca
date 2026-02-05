import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder, buildOrderBy } from '../utils/query-builder';
import {
  addUtcDays,
  advanceNextPaymentDateToCurrentOrFuture,
  getCurrentUtcDate,
} from '../utils/subscription-date';
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '../validators/subscription.validator';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';
import { subscriptionCategoryService } from './subscription-category.service';

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
  private async syncOverdueNextPaymentDates(userId: string): Promise<void> {
    const today = getCurrentUtcDate();
    const overdueSubscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        status: 'active',
        nextPaymentDate: {
          lt: today,
        },
      },
      select: {
        id: true,
        billingCycle: true,
        nextPaymentDate: true,
      },
    });

    if (overdueSubscriptions.length === 0) {
      return;
    }

    await prisma.$transaction(
      overdueSubscriptions.map((subscription) =>
        prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            nextPaymentDate: advanceNextPaymentDateToCurrentOrFuture(
              subscription.nextPaymentDate,
              subscription.billingCycle,
              today
            ),
          },
        })
      )
    );
  }

  async list(userId: string, params: SubscriptionListParams) {
    await this.syncOverdueNextPaymentDates(userId);
    const normalizedCategory =
      params.category && params.category.trim().length > 0 ? params.category.trim() : undefined;

    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('status', params.status)
      .whereEquals('billingCycle', params.billingCycle)
      .whereEquals('category', normalizedCategory)
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
    const today = getCurrentUtcDate();
    const category = this.normalizeCategoryValue(input.category);
    const registrationDate = input.registrationDate
      ? new Date(input.registrationDate)
      : input.nextPaymentDate
        ? new Date(input.nextPaymentDate)
        : today;

    if (category) {
      await subscriptionCategoryService.ensureExistsByName(userId, category);
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        serviceName: input.serviceName,
        amount: input.amount,
        billingCycle: input.billingCycle,
        nextPaymentDate: advanceNextPaymentDateToCurrentOrFuture(
          registrationDate,
          input.billingCycle,
          today
        ),
        category,
        status: input.status,
        memo: input.memo,
      },
      select: subscriptionSelect,
    });

    return subscription;
  }

  async getById(userId: string, subscriptionId: string) {
    await this.syncOverdueNextPaymentDates(userId);

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

    const category = this.normalizeCategoryValue(input.category);
    if (category) {
      await subscriptionCategoryService.ensureExistsByName(userId, category);
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
        ...(category !== undefined && { category }),
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
    await this.syncOverdueNextPaymentDates(userId);

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
    const today = getCurrentUtcDate();
    const sevenDaysFromNow = addUtcDays(today, 7);

    const upcomingPayments = await prisma.subscription.findMany({
      where: {
        userId,
        status: 'active',
        nextPaymentDate: {
          gte: today,
          lte: sevenDaysFromNow,
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

  private normalizeCategoryValue(category: string | null | undefined): string | null | undefined {
    if (category === undefined) {
      return undefined;
    }

    if (category === null) {
      return null;
    }

    const normalized = category.trim();
    return normalized.length > 0 ? normalized : null;
  }
}

export const subscriptionService = new SubscriptionService();
