import { NextRequest, NextResponse } from 'next/server';

const API_SERVER_ORIGIN = process.env.API_SERVER_ORIGIN || 'http://localhost:3000';
const API_SERVER_BASE_PATH = process.env.API_SERVER_BASE_PATH || '/v1';
const NORMALIZED_API_BASE_PATH = `/${API_SERVER_BASE_PATH}`.replace(/\/+/g, '/').replace(/\/$/, '');

function buildUpstreamUrl(request: NextRequest, stripPrefix: string) {
  const incomingPath = request.nextUrl.pathname;
  const suffix = incomingPath.startsWith(stripPrefix)
    ? incomingPath.slice(stripPrefix.length)
    : incomingPath;
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;

  const upstreamUrl = new URL(`${NORMALIZED_API_BASE_PATH}${normalizedSuffix}`, API_SERVER_ORIGIN);
  upstreamUrl.search = request.nextUrl.search;

  return upstreamUrl;
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  // Let fetch set these for the upstream request.
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  return headers;
}

export async function proxyApiRequest(request: NextRequest, stripPrefix: string) {
  const method = request.method.toUpperCase();
  const upstreamUrl = buildUpstreamUrl(request, stripPrefix);
  const headers = buildProxyHeaders(request);

  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);
    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: upstreamResponse.headers,
    });
  } catch {
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
