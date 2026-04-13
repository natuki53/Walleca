import jwt from 'jsonwebtoken';
import { config } from '../config';

// JWT に埋め込むペイロードの型定義
export interface TokenPayload {
  userId: string;
  email: string;
}

// JWT をデコードしたときの型定義（iat: 発行日時, exp: 有効期限）
export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

// アクセストークンを生成する（有効期限は設定値に従う）
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

// リフレッシュトークンを生成する（アクセストークンより有効期限が長い）
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

// アクセストークンを検証してデコードされたペイロードを返す。無効な場合は例外が発生する
export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, config.jwt.secret) as DecodedToken;
}

// リフレッシュトークンを検証してデコードされたペイロードを返す。無効な場合は例外が発生する
export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, config.jwt.refreshSecret) as DecodedToken;
}

// リフレッシュトークンの有効期限（Date オブジェクト）を返す
// 設定値を "30d" のような文字列から ms に変換して計算する
export function getRefreshTokenExpiry(): Date {
  const match = config.jwt.refreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // デフォルト30日
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  // 単位（s/m/h/d）をミリ秒に変換するテーブル
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}
