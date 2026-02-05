import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateMeSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// POST /v1/auth/register - ユーザー登録
router.post(
  '/register',
  validate(registerSchema),
  authController.register.bind(authController)
);

// POST /v1/auth/login - ログイン
router.post(
  '/login',
  validate(loginSchema),
  authController.login.bind(authController)
);

// POST /v1/auth/refresh - トークン更新
router.post(
  '/refresh',
  validate(refreshSchema),
  authController.refresh.bind(authController)
);

// POST /v1/auth/logout - ログアウト
router.post(
  '/logout',
  validate(refreshSchema),
  authController.logout.bind(authController)
);

// GET /v1/auth/me - 現在のユーザー情報
router.get(
  '/me',
  authMiddleware,
  authController.me.bind(authController)
);

// PATCH /v1/auth/me - ユーザー設定更新
router.patch(
  '/me',
  authMiddleware,
  validate(updateMeSchema),
  authController.updateMe.bind(authController)
);

// PATCH /v1/auth/password - パスワード更新
router.patch(
  '/password',
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

export default router;
