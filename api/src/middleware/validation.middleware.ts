import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = new Error('Validation Error');
      error.name = 'ZodError';
      (error as any).errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      next(error);
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
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
