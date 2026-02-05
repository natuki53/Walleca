import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import {
  RegisterInput,
  LoginInput,
  RefreshInput,
  UpdateMeInput,
  ChangePasswordInput,
} from '../validators/auth.validator';

export class AuthController {
  async register(
    req: Request<{}, {}, RegisterInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async login(
    req: Request<{}, {}, LoginInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async refresh(
    req: Request<{}, {}, RefreshInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async logout(
    req: Request<{}, {}, RefreshInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.logout(req.body.refreshToken);
      sendSuccess(res, { message: 'ログアウトしました' });
    } catch (error) {
      next(error);
    }
  }

  async me(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async updateMe(
    req: Request<{}, {}, UpdateMeInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await authService.updateMe(req.user!.userId, req.body);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(
    req: Request<{}, {}, ChangePasswordInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.changePassword(req.user!.userId, req.body);
      sendSuccess(res, { message: 'パスワードを更新しました' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
