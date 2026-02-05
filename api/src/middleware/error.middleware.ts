import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError, Errors } from '../utils/errors';
import { logger } from '../utils/logger';

const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const appError = Errors.fileTooLarge(MAX_FILE_SIZE);
      res.status(appError.statusCode).json(appError.toJSON());
      return;
    }

    const appError = Errors.validation('アップロードデータが不正です', {
      code: err.code,
      field: err.field,
    });
    res.status(appError.statusCode).json(appError.toJSON());
    return;
  }

  // AppErrorの場合
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // バリデーションエラー（Zod）
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: (err as any).errors,
      },
    });
    return;
  }

  // Prismaエラー
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;

    // ユニーク制約違反
    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: '既に登録されています',
        },
      });
      return;
    }

    // 外部キー制約違反
    if (prismaError.code === 'P2003') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '関連データが見つかりません',
        },
      });
      return;
    }
  }

  // その他のエラー
  logger.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'サーバーエラーが発生しました'
        : err.message,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: `${req.method} ${req.path} は存在しません`,
    },
  });
}
