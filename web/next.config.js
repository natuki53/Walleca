const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  // API サーバーへのプロキシ設定（開発時）
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/v1/:path*',
      },
      // Backward-compatible proxy when NEXT_PUBLIC_API_URL is set to /v1.
      {
        source: '/v1/:path*',
        destination: 'http://localhost:3000/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
