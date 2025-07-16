import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://forms-capital.getseesail.com/api/:path*", // Proxy to your API
      },
    ];
  },
};

export default nextConfig;
