"use client";

import { useEffect } from "react";

export default function OwnerMobileEmbedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (window.parent !== window) window.parent.postMessage({ source: "petmanager-owner-mobile-embed", version: 1, status: "error", message: "모바일 화면을 불러오지 못했습니다." }, "*");
  }, []);

  return (
    <main className="owner-font flex min-h-screen w-full max-w-[430px] items-center justify-center overflow-x-hidden bg-[#f7f8fa] px-5" data-petmanager-embed="owner-mobile" data-petmanager-embed-state="error">
      <div className="w-full rounded-[14px] border border-[#e1e7ef] bg-white p-5 text-center">
        <h1 className="text-[16px] font-semibold text-[#1f2937]">화면을 불러오지 못했어요</h1>
        <p className="mt-2 text-[13px] leading-5 text-[#64748b]">잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={reset} className="mt-4 min-h-11 w-full rounded-[10px] bg-[#2563eb] px-4 text-[14px] font-medium text-white">다시 불러오기</button>
      </div>
    </main>
  );
}
