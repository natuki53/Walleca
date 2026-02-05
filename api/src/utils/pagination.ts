import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

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

export function parseDateRange(req: Request): { from?: Date; to?: Date } {
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;

  return {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
  };
}
