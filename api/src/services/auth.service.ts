import { prisma } from '../config/database';
import { hashPassword, verifyPassword, hashToken } from '../utils/hash';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  TokenPayload,
} from '../utils/jwt';
import { Errors } from '../utils/errors';
import {
  RegisterInput,
  LoginInput,
  UpdateMeInput,
  ChangePasswordInput,
} from '../validators/auth.validator';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    // メールアドレスの重複チェック
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw Errors.duplicate('メールアドレス');
    }

    // パスワードハッシュ化
    const passwordHash = await hashPassword(input.password);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    // トークン生成
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      ...tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw Errors.invalidCredentials();
    }

    // パスワード検証
    const isValid = await verifyPassword(input.password, user.passwordHash);

    if (!isValid) {
      throw Errors.invalidCredentials();
    }

    // トークン生成
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // トークン検証
    let decoded: TokenPayload;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw Errors.tokenInvalid();
    }

    // DBでリフレッシュトークン検索
    const tokenHash = hashToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw Errors.tokenExpired();
    }

    // 古いトークン削除
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // 新しいトークン生成
    return this.generateTokens(decoded.userId, decoded.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw Errors.notFound('ユーザー');
    }

    return user;
  }

  async updateMe(userId: string, input: UpdateMeInput) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw Errors.notFound('ユーザー');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw Errors.notFound('ユーザー');
    }

    const isValidCurrentPassword = await verifyPassword(
      input.currentPassword,
      user.passwordHash
    );

    if (!isValidCurrentPassword) {
      throw Errors.validation('現在のパスワードが正しくありません');
    }

    const passwordHash = await hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private async generateTokens(userId: string, email: string) {
    const payload: TokenPayload = { userId, email };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // リフレッシュトークンをDBに保存
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
