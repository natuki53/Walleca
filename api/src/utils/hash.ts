import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// bcrypt のソルト生成ラウンド数。数値が大きいほど安全だが処理が遅くなる
const SALT_ROUNDS = 12;

// パスワードを bcrypt でハッシュ化して返す
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// 入力パスワードとハッシュを比較して一致するか検証する
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// リフレッシュトークンを SHA-256 でハッシュ化してデータベース保存用の文字列を返す
// トークンそのものをDBに保存しないことでセキュリティリスクを低減する
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
