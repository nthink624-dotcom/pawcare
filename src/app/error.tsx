"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getAppErrorEscapeContext } from "@/lib/app-error-context";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() || "/";
  const escapeContext = getAppErrorEscapeContext(pathname);

  useEffect(() => {
    console.error("[petmanager-ui] recovered from a route error", {
      message: error.message,
      digest: error.digest,
      path: pathname,
    });
  }, [error, pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-10">
      <section className="w-full max-w-[420px] rounded-[14px] border border-[#e5eaf0] bg-white p-7 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <p className="text-[20px] font-semibold text-[#111827]">화면을 불러오지 못했습니다</p>
        <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
          입력한 내용은 그대로 두고 화면만 다시 불러옵니다. 문제가 계속되면 안전한 시작 화면으로 이동해 주세요.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <a
            href={escapeContext.href}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]"
          >
            {escapeContext.label}
          </a>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-[8px] bg-[#111827] text-[14px] font-semibold text-white hover:bg-[#1f2937]"
          >
            다시 불러오기
          </button>
        </div>
      </section>
    </main>
  );
}
