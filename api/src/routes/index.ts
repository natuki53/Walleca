import { Router } from 'express';
import authRoutes from './auth.routes';

export const router = Router();

// 認証
router.use('/auth', authRoutes);

// TODO: 他のルートを追加
// router.use('/receipts', receiptsRoutes);
// router.use('/transactions', transactionsRoutes);
// router.use('/subscriptions', subscriptionsRoutes);
// router.use('/views', viewsRoutes);
// router.use('/notifications', notificationsRoutes);
// router.use('/search', searchRoutes);
// router.use('/export', exportRoutes);
