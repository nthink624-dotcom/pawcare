import type { Metadata } from "next";

import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: PETMANAGER_SERVICE_NAME,
  title: {
    default: PETMANAGER_SERVICE_NAME,
    template: `%s | ${PETMANAGER_SERVICE_NAME}`,
  },
  description: `${PETMANAGER_SERVICE_NAME}는 반려동물 미용샵 예약과 고객 관리를 위한 운영 SaaS입니다.`,
};

export const viewport: import("next").Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f6f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "'Noto Sans KR', system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
