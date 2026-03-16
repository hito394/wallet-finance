/** @type {import('next').NextConfig} */
const backendOrigin = process.env.BACKEND_API_ORIGIN || 'http://127.0.0.1:8000';

const nextConfig = {
  // バックエンドAPIへのプロキシ設定（本番はBACKEND_API_ORIGINで切り替え）
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
