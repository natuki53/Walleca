import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess, sendMessage } from '../utils/response';
import { hashPassword, verifyPassword, hashToken } from '../utils/hash';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../utils/jwt';
import { Errors } from '../utils/errors';

const router = Router();

// 会員登録時のバリデーションスキーマ
const registerSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  displayName: z.string().min(1, '表示名を入力してください').max(100),
});

// ログイン時のバリデーションスキーマ
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// 新規ユーザー登録時にデフォルトで作成する取引カテゴリ
const DEFAULT_TRANSACTION_CATEGORIES = [
  '食費', '日用品', '交通費', '娯楽', '通信費',
  '光熱費', '医療費', '衣服', '教育', 'その他',
];

// 新規ユーザー登録時にデフォルトで作成するサブスクカテゴリ
const DEFAULT_SUBSCRIPTION_CATEGORIES = [
  '動画配信', '音楽配信', 'クラウドサービス', 'ゲーム',
  'ニュース・雑誌', 'フィットネス', 'ソフトウェア', 'その他',
];

// POST /auth/register - 新規ユーザー登録
// ユーザー作成・設定・デフォルトカテゴリ生成をトランザクションで一括処理し、トークンを返す
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('入力値が不正です', parsed.error.errors);
    }
    const { email, password, displayName } = parsed.data;

    // 同じメールアドレスが既に登録されていないか確認する
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw Errors.duplicate('メールアドレス');

    const passwordHash = await hashPassword(password);

    // ユーザー・設定・デフォルトカテゴリをトランザクションで一括作成する
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, passwordHash, displayName },
      });
      await tx.userSetting.create({ data: { userId: newUser.id } });
      await tx.transactionCategory.createMany({
        data: DEFAULT_TRANSACTION_CATEGORIES.map((name, i) => ({
          userId: newUser.id, name, sortOrder: i, isDefault: true,
        })),
      });
      await tx.subscriptionCategory.createMany({
        data: DEFAULT_SUBSCRIPTION_CATEGORIES.map((name, i) => ({
          userId: newUser.id, name, sortOrder: i, isDefault: true,
        })),
      });
      return newUser;
    });

    // アクセストークンとリフレッシュトークンを発行してDBに保存する
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiry();

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    }, 201);
  } catch (err) {
    next(err);
  }
});

// POST /auth/login - ログイン
// メールアドレスとパスワードを検証し、一致すればトークンを発行する
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.invalidCredentials();

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw Errors.invalidCredentials();

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw Errors.invalidCredentials();

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiry();

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh - アクセストークンの更新
// リフレッシュトークンを検証して新しいトークンペアを発行し、古いトークンを削除する（ローテーション）
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw Errors.unauthorized();

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw Errors.tokenInvalid();
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { tokenHash } });
      throw Errors.tokenInvalid();
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw Errors.tokenInvalid();

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user.id, email: user.email });
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = getRefreshTokenExpiry();

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { tokenHash } }),
      prisma.refreshToken.create({ data: { userId: user.id, tokenHash: newTokenHash, expiresAt } }),
    ]);

    sendSuccess(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout - ログアウト
// リフレッシュトークンをDBから削除してセッションを無効化する
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    sendMessage(res, 'ログアウトしました');
  } catch (err) {
    next(err);
  }
});

// GET /auth/me - 現在ログイン中のユーザー情報を取得する
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
    if (!user) throw Errors.notFound('ユーザー');
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

export default router;
