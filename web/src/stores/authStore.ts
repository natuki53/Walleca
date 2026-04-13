import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/auth';

// 認証状態と操作メソッドの型定義
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // ログイン成功時にユーザー情報とトークンを設定する
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  // トークン更新時にトークンのみを更新する（リフレッシュトークンローテーション）
  setTokens: (accessToken: string, refreshToken: string) => void;
  // ユーザー情報のみ更新する
  setUser: (user: User) => void;
  // ログアウト処理（状態クリア＋リフレッシュトークン削除）
  logout: () => void;
  // ローディング状態を更新する
  setLoading: (loading: boolean) => void;
}

// 認証状態を管理する Zustand ストア
// persist ミドルウェアにより user・accessToken・isAuthenticated を localStorage に永続化する
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      // ログイン・登録成功時: リフレッシュトークンは localStorage に、アクセストークンはメモリに保存する
      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', refreshToken);
        }
        set({
          user,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      // トークン更新時: リフレッシュトークンを localStorage に更新し、アクセストークンをストアに保存する
      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', refreshToken);
        }
        set({ accessToken });
      },

      setUser: (user) => set({ user }),

      // ログアウト時: localStorage のリフレッシュトークンを削除してストアを初期状態に戻す
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
        }
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      // localStorage に永続化するのは user・accessToken・isAuthenticated のみ
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      // localStorage から状態を復元した後に isLoading を false にする
      onRehydrateStorage: () => (state) => {
        state?.setLoading(false);
      },
    }
  )
);
