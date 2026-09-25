import type { NextConfig } from "next";

import path from "node:path";

const localPreviewDistDir = process.env.PETMANAGER_LOCAL_PREVIEW_DIST_DIR;

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname, "../..") },
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: ["@petmanager/shared"],
  // A running local preview serves this immutable copied generation, not the
  // mutable .next directory that ordinary builds replace.
  distDir: localPreviewDistDir || ".next",
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
