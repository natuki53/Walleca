import { NextRequest, NextResponse } from 'next/server';

// バックエンド API サーバーのオリジン（プロトコル + ホスト + ポート）
const API_SERVER_ORIGIN = process.env.API_SERVER_ORIGIN || 'http://localhost:3000';
// バックエンド API のベースパス（例: /v1）
const API_SERVER_BASE_PATH = process.env.API_SERVER_BASE_PATH || '/v1';
// 先頭スラッシュの正規化（二重スラッシュや末尾スラッシュを取り除く）
const NORMALIZED_API_BASE_PATH = `/${API_SERVER_BASE_PATH}`.replace(/\/+/g, '/').replace(/\/$/, '');

// フロントのリクエストパスからプレフィックスを取り除き、バックエンドの URL を構築する
function buildUpstreamUrl(request: NextRequest, stripPrefix: string) {
  const incomingPath = request.nextUrl.pathname;
  // /api/xxx → /xxx のようにプレフィックスを除去する
  const suffix = incomingPath.startsWith(stripPrefix)
    ? incomingPath.slice(stripPrefix.length)
    : incomingPath;
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;

  const upstreamUrl = new URL(`${NORMALIZED_API_BASE_PATH}${normalizedSuffix}`, API_SERVER_ORIGIN);
  // クエリパラメータもそのまま転送する
  upstreamUrl.search = request.nextUrl.search;

  return upstreamUrl;
}

// プロキシリクエスト用のヘッダーを構築する
// fetch が自動的に設定するヘッダー（host・connection・content-length）を削除する
function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  return headers;
}

// Next.js の Route Handler からバックエンド API へリクエストをプロキシする
// バックエンドの応答をそのままクライアントに返す。接続失敗時は 502 を返す
export async function proxyApiRequest(request: NextRequest, stripPrefix: string) {
  const method = request.method.toUpperCase();
  const upstreamUrl = buildUpstreamUrl(request, stripPrefix);
  const headers = buildProxyHeaders(request);

  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
  };

  // GET・HEAD 以外のメソッドはリクエストボディを転送する
  // duplex: 'half' はストリーミングボディの転送に必要
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);
    // バックエンドのレスポンス（ステータス・ヘッダー・ボディ）をそのまま返す
    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: upstreamResponse.headers,
    });
  } catch {
    // バックエンドへの接続自体に失敗した場合は 502 Bad Gateway を返す
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'API サーバーへの接続に失敗しました',
        },
      },
      { status: 502 }
    );
  }
}
