import { Prisma } from '@prisma/client';

type WhereCondition = Record<string, unknown>;

export class QueryBuilder {
  private conditions: WhereCondition[] = [];

  where(condition: WhereCondition): this {
    this.conditions.push(condition);
    return this;
  }

  whereIf(condition: boolean, whereClause: WhereCondition): this {
    if (condition) {
      this.conditions.push(whereClause);
    }
    return this;
  }

  whereEquals(field: string, value: unknown): this {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push({ [field]: value });
    }
    return this;
  }

  whereContains(field: string, value: string | undefined): this {
    if (value) {
      this.conditions.push({
        [field]: { contains: value, mode: 'insensitive' },
      });
    }
    return this;
  }

  whereDateRange(
    field: string,
    from: Date | undefined,
    to: Date | undefined
  ): this {
    if (from || to) {
      const dateCondition: Record<string, Date> = {};
      if (from) dateCondition.gte = from;
      if (to) dateCondition.lte = to;
      this.conditions.push({ [field]: dateCondition });
    }
    return this;
  }

  whereIn(field: string, values: unknown[] | undefined): this {
    if (values && values.length > 0) {
      this.conditions.push({ [field]: { in: values } });
    }
    return this;
  }

  build(): WhereCondition {
    if (this.conditions.length === 0) {
      return {};
    }
    if (this.conditions.length === 1) {
      return this.conditions[0];
    }
    return { AND: this.conditions };
  }
}

export function buildOrderBy(
  field: string,
  order: 'asc' | 'desc'
): Record<string, 'asc' | 'desc'> {
  return { [field]: order };
}
