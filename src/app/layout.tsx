import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "petmanager",
  description: "반려동물 미용샵 예약과 고객 관리를 위한 모바일 SaaS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Noto Sans KR', system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
