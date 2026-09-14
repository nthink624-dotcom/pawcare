import type { NextConfig } from "next";

const localPreviewDistDir = process.env.PETMANAGER_LOCAL_PREVIEW_DIST_DIR;

const nextConfig: NextConfig = {
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
};

export default nextConfig;
