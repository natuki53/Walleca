import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, DecodedToken } from '../utils/jwt';
import { Errors } from '../utils/errors';

// Express の Request 型に認証済みユーザー情報を追加する型拡張
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

// JWT アクセストークンを検証し、有効であればリクエストに user を付与する認証ミドルウェア
// Authorization ヘッダーに "Bearer <token>" 形式が必要
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    // Authorization ヘッダーが存在しない、または Bearer 形式でない場合はエラー
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Errors.unauthorized();
    }

    // "Bearer " の部分（7文字）を除いたトークン文字列を取得する
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    // 検証済みのデコード結果をリクエストオブジェクトに付与して次の処理へ進む
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
