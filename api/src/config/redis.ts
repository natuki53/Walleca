import Redis from 'ioredis';
import { config } from './index';

// ioredis クライアントのシングルトンインスタンス
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

// 接続成功時のログ
redis.on('connect', () => {
  console.log('Redis connected successfully');
});

// 接続エラー時のログ
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

// Redis のホスト・ポート情報（BullMQ など他のライブラリに渡す用途）
export const redisConnection = {
  host: new URL(config.redis.url).hostname || 'localhost',
  port: parseInt(new URL(config.redis.url).port || '6379', 10),
};
