import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// Zod スキーマを使ってリクエストボディを検証するミドルウェアを返すファクトリ関数
// バリデーション成功時は検証済みデータを req.body に上書きして次の処理へ進む
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // バリデーションエラーを ZodError 形式に変換してエラーハンドラに渡す
      const error = new Error('Validation Error');
      error.name = 'ZodError';
      (error as any).errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      next(error);
      return;
    }

    // バリデーション後の安全なデータで req.body を置き換える
    req.body = result.data;
    next();
  };
}

// Zod スキーマを使ってクエリパラメータを検証するミドルウェアを返すファクトリ関数
// バリデーション成功時は検証済みデータを req.query に上書きして次の処理へ進む
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      // バリデーションエラーを ZodError 形式に変換してエラーハンドラに渡す
      const error = new Error('Validation Error');
      error.name = 'ZodError';
      (error as any).errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      next(error);
      return;
    }

    req.query = result.data;
    next();
  };
}
