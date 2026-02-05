import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, config.jwt.secret) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, config.jwt.refreshSecret) as DecodedToken;
}

export function getRefreshTokenExpiry(): Date {
  const match = config.jwt.refreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // デフォルト30日
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}
