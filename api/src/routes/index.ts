import { Router } from 'express';
import authRoutes from './auth.routes';
import settingsRoutes from './settings.routes';
import transactionCategoryRoutes from './transaction-category.routes';
import subscriptionCategoryRoutes from './subscription-category.routes';
import receiptOcrJobRoutes from './receipt-ocr-job.routes';
import subscriptionOcrJobRoutes from './subscription-ocr-job.routes';
import transactionRoutes from './transaction.routes';
import subscriptionRoutes from './subscription.routes';
import dashboardRoutes from './dashboard.routes';
import notificationRoutes from './notification.routes';
import searchRoutes from './search.routes';
import exportRoutes from './export.routes';

// API バージョン 1 のルートをまとめるルーターオブジェクト
export const router = Router();

// 各リソースのルートを対応するパスにマウントする
router.use('/auth', authRoutes);                             // 認証（登録・ログイン・トークン更新）
router.use('/settings', settingsRoutes);                     // ユーザー設定
router.use('/transaction-categories', transactionCategoryRoutes); // 取引カテゴリ
router.use('/subscription-categories', subscriptionCategoryRoutes); // サブスクカテゴリ
router.use('/receipt-ocr-jobs', receiptOcrJobRoutes);        // レシート OCR ジョブ
router.use('/subscription-ocr-jobs', subscriptionOcrJobRoutes); // サブスク OCR ジョブ
router.use('/transactions', transactionRoutes);              // 取引管理
router.use('/subscriptions', subscriptionRoutes);            // サブスク管理
router.use('/dashboard', dashboardRoutes);                   // ダッシュボード集計
router.use('/notifications', notificationRoutes);            // 通知管理
router.use('/search', searchRoutes);                         // 横断検索
router.use('/exports', exportRoutes);                        // CSV エクスポート
