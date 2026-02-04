import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, DecodedToken } from '../utils/jwt';
import { Errors } from '../utils/errors';

// Express Request型を拡張
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Errors.unauthorized();
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(Errors.tokenExpired());
    } else if (error.name === 'JsonWebTokenError') {
      next(Errors.tokenInvalid());
    } else {
      next(error);
    }
  }
}
