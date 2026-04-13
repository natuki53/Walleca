import { Request } from 'express';

// ページネーションパラメータの型定義（skip は Prisma の skip オプションに渡す値）
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// ソートパラメータの型定義
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

// ページネーションのデフォルト値と上限
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// クエリパラメータからページネーション情報をパースして返す
// page は最小 1、limit は最大 100 にクランプする
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT)
  );
  // Prisma の skip（スキップするレコード数）を計算する
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// クエリパラメータからソート情報をパースして返す
// allowedFields に含まれないフィールドは defaultField にフォールバックする
export function parseSort(
  req: Request,
  allowedFields: string[],
  defaultField: string = 'createdAt',
  defaultOrder: 'asc' | 'desc' = 'desc'
): SortParams {
  const field = allowedFields.includes(req.query.sortBy as string)
    ? (req.query.sortBy as string)
    : defaultField;

  const order = req.query.sortOrder === 'asc' ? 'asc' : defaultOrder;

  return { field, order };
}

// クエリパラメータから日付範囲（from / to）をパースして返す
// 不正な日付は undefined として扱う
export function parseDateRange(req: Request): { from?: Date; to?: Date } {
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;

  return {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
  };
}
