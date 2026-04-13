// Prisma の where 条件に使う汎用型
type WhereCondition = Record<string, unknown>;

// Prisma の where 句を動的に組み立てるビルダークラス
// メソッドチェーンで条件を追加し、最後に build() を呼ぶと AND で結合した where 条件を返す
export class QueryBuilder {
  private conditions: WhereCondition[] = [];

  // 条件を直接追加する
  where(condition: WhereCondition): this {
    this.conditions.push(condition);
    return this;
  }

  // condition が true のときだけ条件を追加する
  whereIf(condition: boolean, whereClause: WhereCondition): this {
    if (condition) {
      this.conditions.push(whereClause);
    }
    return this;
  }

  // 値が null/undefined/空文字でなければ等値条件を追加する
  whereEquals(field: string, value: unknown): this {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push({ [field]: value });
    }
    return this;
  }

  // 値が存在する場合、大文字小文字を区別しない部分一致条件を追加する
  whereContains(field: string, value: string | undefined): this {
    if (value) {
      this.conditions.push({
        [field]: { contains: value, mode: 'insensitive' },
      });
    }
    return this;
  }

  // from / to が指定された場合に日付範囲条件を追加する
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

  // 配列が空でなければ IN 条件を追加する
  whereIn(field: string, values: unknown[] | undefined): this {
    if (values && values.length > 0) {
      this.conditions.push({ [field]: { in: values } });
    }
    return this;
  }

  // 追加した条件を AND で結合して Prisma の where 引数に渡せる形式で返す
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

// Prisma の orderBy 引数に渡せる形式でソート条件を生成する
export function buildOrderBy(
  field: string,
  order: 'asc' | 'desc'
): Record<string, 'asc' | 'desc'> {
  return { [field]: order };
}
