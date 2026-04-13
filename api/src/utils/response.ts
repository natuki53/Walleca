import { Response } from 'express';

// API 成功レスポンスの共通型定義
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

// ページネーション情報の型定義
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 単一データの成功レスポンスを送信する
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

// ページネーション付きリストの成功レスポンスを送信する
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

// 総件数・ページ・リミットからページネーションメタ情報を生成する
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

// メッセージのみの成功レスポンスを送信する（削除完了・ログアウトなど）
export function sendMessage(
  res: Response,
  message: string,
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    data: {
      message,
    },
  });
}
