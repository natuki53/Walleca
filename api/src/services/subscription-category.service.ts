import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import {
  CreateSubscriptionCategoryInput,
  UpdateSubscriptionCategoryInput,
} from '../validators/subscription-category.validator';

const subscriptionCategorySelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
};

export class SubscriptionCategoryService {
  async list(userId: string) {
    const categories = await prisma.subscriptionCategory.findMany({
      where: { userId },
      select: subscriptionCategorySelect,
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      return [];
    }

    const usageByName = await this.getUsageByName(
      userId,
      categories.map((category) => category.name)
    );

    return categories.map((category) => ({
      ...category,
      subscriptionCount: usageByName.get(category.name) ?? 0,
    }));
  }

  async create(userId: string, input: CreateSubscriptionCategoryInput) {
    const existing = await prisma.subscriptionCategory.findUnique({
      where: {
        userId_name: {
          userId,
          name: input.name,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw Errors.duplicate('カテゴリ名');
    }

    const category = await prisma.subscriptionCategory.create({
      data: {
        userId,
        name: input.name,
      },
      select: subscriptionCategorySelect,
    });

    return {
      ...category,
      subscriptionCount: 0,
    };
  }

  async update(userId: string, categoryId: string, input: UpdateSubscriptionCategoryInput) {
    const existing = await prisma.subscriptionCategory.findFirst({
      where: {
        id: categoryId,
        userId,
      },
      select: subscriptionCategorySelect,
    });

    if (!existing) {
      throw Errors.notFound('カテゴリ');
    }

    if (existing.name === input.name) {
      const subscriptionCount = await prisma.subscription.count({
        where: {
          userId,
          category: existing.name,
        },
      });

      return {
        ...existing,
        subscriptionCount,
      };
    }

    const duplicate = await prisma.subscriptionCategory.findUnique({
      where: {
        userId_name: {
          userId,
          name: input.name,
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw Errors.duplicate('カテゴリ名');
    }

    return prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          userId,
          category: existing.name,
        },
        data: {
          category: input.name,
        },
      });

      const updated = await tx.subscriptionCategory.update({
        where: { id: categoryId },
        data: {
          name: input.name,
        },
        select: subscriptionCategorySelect,
      });

      const subscriptionCount = await tx.subscription.count({
        where: {
          userId,
          category: updated.name,
        },
      });

      return {
        ...updated,
        subscriptionCount,
      };
    });
  }

  async delete(userId: string, categoryId: string) {
    const existing = await prisma.subscriptionCategory.findFirst({
      where: {
        id: categoryId,
        userId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!existing) {
      throw Errors.notFound('カテゴリ');
    }

    const result = await prisma.$transaction(async (tx) => {
      const cleared = await tx.subscription.updateMany({
        where: {
          userId,
          category: existing.name,
        },
        data: {
          category: null,
        },
      });

      await tx.subscriptionCategory.delete({
        where: { id: categoryId },
      });

      return {
        clearedSubscriptionCount: cleared.count,
      };
    });

    return {
      ...result,
      name: existing.name,
    };
  }

  private async getUsageByName(userId: string, names: string[]) {
    const grouped = await prisma.subscription.groupBy({
      by: ['category'],
      where: {
        userId,
        category: {
          in: names,
        },
      },
      _count: {
        _all: true,
      },
    });

    const usageByName = new Map<string, number>();

    for (const row of grouped) {
      if (!row.category) {
        continue;
      }
      usageByName.set(row.category, row._count._all);
    }

    return usageByName;
  }

  async ensureExistsByName(userId: string, name: string) {
    const existing = await prisma.subscriptionCategory.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    await prisma.subscriptionCategory.create({
      data: {
        userId,
        name,
      },
      select: {
        id: true,
      },
    });
  }
}

export const subscriptionCategoryService = new SubscriptionCategoryService();
