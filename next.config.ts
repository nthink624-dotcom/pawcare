import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_VERCEL_ENV:
      process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || "",
  },
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
