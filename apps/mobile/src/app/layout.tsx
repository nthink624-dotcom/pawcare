import type { Metadata, Viewport } from "next";

import NativeSafeAreaPlatform from "@/components/platform/native-safe-area-platform";
import {
  PETMANAGER_BRAND_MARK_PATH,
  PETMANAGER_PUBLIC_SITE_URL,
  PETMANAGER_SERVICE_DESCRIPTION,
  PETMANAGER_SERVICE_NAME,
} from "@/lib/brand";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || PETMANAGER_PUBLIC_SITE_URL),
  title: {
    default: PETMANAGER_SERVICE_NAME,
    template: `%s | ${PETMANAGER_SERVICE_NAME}`,
  },
  description: PETMANAGER_SERVICE_DESCRIPTION,
  applicationName: PETMANAGER_SERVICE_NAME,
  openGraph: {
    title: PETMANAGER_SERVICE_NAME,
    description: PETMANAGER_SERVICE_DESCRIPTION,
    images: [PETMANAGER_BRAND_MARK_PATH],
  },
  twitter: {
    card: "summary",
    title: PETMANAGER_SERVICE_NAME,
    description: PETMANAGER_SERVICE_DESCRIPTION,
    images: [PETMANAGER_BRAND_MARK_PATH],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f5f7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="owner-font">
        <NativeSafeAreaPlatform />
        {children}
      </body>
    </html>
  );
}
