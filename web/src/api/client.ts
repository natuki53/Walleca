import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

// API のベース URL。環境変数が未設定の場合は Next.js のプロキシ経由で /api を使う
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// 全 API 呼び出しで使用する Axios インスタンス
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター: 認証済みの場合は Authorization ヘッダーを自動付与する
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// レスポンスインターセプター: 401 エラー時にリフレッシュトークンでトークンを更新して再試行する
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // アクセストークンの期限切れ（401）の場合、リフレッシュトークンで新しいトークンを取得する
    if (error.response?.status === 401 && originalRequest) {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          // リフレッシュトークンで新しいアクセストークンを取得する
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          const { setTokens } = useAuthStore.getState();
          setTokens(accessToken, newRefreshToken);

          // 新しいアクセストークンで元のリクエストを再実行する
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // リフレッシュも失敗した場合はログアウトしてログインページへリダイレクトする
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }

    return Promise.reject(error);
  }
);
