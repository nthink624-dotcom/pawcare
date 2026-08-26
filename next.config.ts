import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.226"],
  images: {
    qualities: [75, 90],
  },
  env: {
    NEXT_PUBLIC_VERCEL_ENV:
      process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || "",
  },
};

export default nextConfig;
