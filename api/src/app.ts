import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { router } from './routes';

export const app = express();

// セキュリティミドルウェア
app.use(helmet());

// CORS設定
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://walleca.local']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// ボディパーサー
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// APIルート
app.use('/v1', router);

// 404ハンドラー
app.use(notFoundHandler);

// エラーハンドラー
app.use(errorHandler);
