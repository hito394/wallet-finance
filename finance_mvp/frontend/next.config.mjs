/** @type {import('next').NextConfig} */
const apiProxyOrigin = (process.env.API_PROXY_ORIGIN || "https://ai-finance-assistant-api.onrender.com").replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
