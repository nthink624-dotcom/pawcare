import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/owner/mobile",
        destination: "http://127.0.0.1:3100/owner/mobile",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
