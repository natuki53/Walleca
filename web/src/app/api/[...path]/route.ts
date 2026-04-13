import { NextRequest } from 'next/server';
import { proxyApiRequest } from '@/lib/server/apiProxy';

// Node.js ランタイムを使用する（ストリーミングボディの転送に必要）
export const runtime = 'nodejs';

// /api/... へのリクエストをバックエンド API サーバーにプロキシする
// Next.js のキャッチオールルートで全メソッドを受け取り、proxyApiRequest に委譲する
async function proxy(request: NextRequest) {
  return proxyApiRequest(request, '/api');
}

// 全 HTTP メソッドに対してプロキシ関数をエクスポートする
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
