import type { NextConfig } from "next";

const ownerMobileEmbedFrameAncestors = [
  "'self'",
  "https://www.petmanager.co.kr",
  "https://petmanager.co.kr",
  ...(process.env.NODE_ENV === "development" ? ["http://127.0.0.1:3000", "http://localhost:3000"] : []),
  ...(process.env.PETMANAGER_EMBED_FRAME_ANCESTORS ?? "")
    .split(/\s+/)
    .map((origin) => origin.trim())
    .filter(Boolean),
].join(" ");

const nextConfig: NextConfig = {
  devIndicators: false,
  typedRoutes: true,
  // Keep the default Next 16 production build on Turbopack while retaining
  // the existing webpack-only development watch exclusions below.
  turbopack: {},
  async headers() {
    return [
      {
        source: "/demo/owner-mobile",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${ownerMobileEmbedFrameAncestors}`,
          },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.local-chrome-firebase/**",
          "**/.tmp-fig/**",
          "**/android/**",
          "**/artifacts/**",
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
