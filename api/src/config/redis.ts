import Redis from 'ioredis';
import { config } from './index';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

export const redisConnection = {
  host: new URL(config.redis.url).hostname || 'localhost',
  port: parseInt(new URL(config.redis.url).port || '6379', 10),
};
