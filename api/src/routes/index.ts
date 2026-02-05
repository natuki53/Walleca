import { Router } from 'express';
import authRoutes from './auth.routes';
import transactionRoutes from './transaction.routes';
import receiptRoutes from './receipt.routes';
import subscriptionRoutes from './subscription.routes';
import viewRoutes from './view.routes';
import notificationRoutes from './notification.routes';
import searchRoutes from './search.routes';
import exportRoutes from './export.routes';

export const router = Router();

// 認証
router.use('/auth', authRoutes);

// 取引
router.use('/transactions', transactionRoutes);

// レシート
router.use('/receipts', receiptRoutes);

// サブスクリプション
router.use('/subscriptions', subscriptionRoutes);

// ビュー
router.use('/views', viewRoutes);

// 通知
router.use('/notifications', notificationRoutes);

// 検索
router.use('/search', searchRoutes);

// エクスポート
router.use('/export', exportRoutes);
