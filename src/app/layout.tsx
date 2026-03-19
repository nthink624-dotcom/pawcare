import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PawCare",
  description: "반려동물 미용샵 예약과 고객 관리를 위한 모바일 SaaS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "'Noto Sans KR', system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
