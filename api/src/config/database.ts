import { PrismaClient } from '@prisma/client';

// Prisma クライアントのシングルトンインスタンス。開発環境ではクエリログを出力する
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// データベースへの接続を確立する。失敗した場合はプロセスを終了する
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// データベース接続を切断する
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('Database disconnected');
}
