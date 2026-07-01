"use client";

import { useEffect } from "react";

const MOBILE_OWNER_URL = "http://127.0.0.1:3100/owner/mobile";

export default function OwnerMobileRedirectPage() {
  useEffect(() => {
    const nextUrl = new URL(MOBILE_OWNER_URL);
    nextUrl.search = window.location.search;
    window.location.replace(nextUrl.toString());
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center bg-white px-5 text-center text-[16px] text-[#475467]">
      모바일 화면으로 이동하고 있습니다.
    </main>
  );
}
