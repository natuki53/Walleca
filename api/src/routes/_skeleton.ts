import { RequestHandler, Response } from 'express';

function sendSkeleton(
  res: Response,
  operation: string,
  method: string,
  path: string
): void {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: `${operation} はまだ実装されていません`,
      details: {
        operation,
        method,
        path,
      },
    },
  });
}

export function skeletonHandler(
  operation: string,
  method: string,
  path: string
): RequestHandler {
  return (_req, res) => {
    sendSkeleton(res, operation, method, path);
  };
}
