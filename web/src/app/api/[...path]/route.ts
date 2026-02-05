import { NextRequest } from 'next/server';
import { proxyApiRequest } from '@/lib/server/apiProxy';

export const runtime = 'nodejs';

async function proxy(request: NextRequest) {
  return proxyApiRequest(request, '/api');
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
