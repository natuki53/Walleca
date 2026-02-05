import { Request } from 'express';
import { parseDateRange, parsePagination, parseSort } from '@/utils/pagination';

function makeRequest(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe('parsePagination', () => {
  test('returns defaults when query is empty', () => {
    const req = makeRequest({});

    expect(parsePagination(req)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  test('normalizes invalid values and clamps limit', () => {
    const req = makeRequest({ page: '-1', limit: '500' });

    expect(parsePagination(req)).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
    });
  });
});

describe('parseSort', () => {
  test('uses request sort values when allowed', () => {
    const req = makeRequest({ sortBy: 'amount', sortOrder: 'asc' });

    expect(parseSort(req, ['amount', 'date'])).toEqual({
      field: 'amount',
      order: 'asc',
    });
  });

  test('falls back to defaults when values are invalid', () => {
    const req = makeRequest({ sortBy: 'invalid', sortOrder: 'invalid' });

    expect(parseSort(req, ['amount', 'date'], 'date', 'desc')).toEqual({
      field: 'date',
      order: 'desc',
    });
  });
});

describe('parseDateRange', () => {
  test('returns valid date objects and ignores invalid dates', () => {
    const req = makeRequest({
      from: '2026-01-01',
      to: 'not-a-date',
    });

    const result = parseDateRange(req);

    expect(result.from).toBeInstanceOf(Date);
    expect(result.from?.toISOString()).toContain('2026-01-01');
    expect(result.to).toBeUndefined();
  });
});
