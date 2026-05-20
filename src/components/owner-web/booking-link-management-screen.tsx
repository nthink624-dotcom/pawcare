"use client";

import { Copy, ExternalLink, Link2, QrCode } from "lucide-react";
import { useMemo, useState } from "react";

import type { BootstrapPayload } from "@/types/domain";

function buildPublicBookingUrl(shopId: string) {
  if (typeof window === "undefined") {
    return `/s/${shopId}`;
  }

  return `${window.location.origin}/s/${shopId}`;
}

export default function BookingLinkManagementScreen({
  initialData,
}: {
  initialData: BootstrapPayload;
}) {
  const [copied, setCopied] = useState(false);
  const bookingUrl = useMemo(() => buildPublicBookingUrl(initialData.shop.id), [initialData.shop.id]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white text-[#0f172a]">
      <main className="w-full px-8 py-7">
        <div className="mb-6">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0f172a]">예약 링크</h1>
          <p className="mt-2 text-[15px] leading-6 text-[#64748b]">
            고객에게 공유할 예약 페이지 주소를 관리합니다.
          </p>
        </div>

        <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-6 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#1f6b5b]">
                  <Link2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0f172a]">
                    {initialData.shop.name}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#64748b]">공개 예약 페이지</p>
                </div>
              </div>

              <div className="mt-5 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
                <p className="break-all font-mono text-[14px] leading-6 text-[#0f172a]">{bookingUrl}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1f6b5b] px-4 text-[13px] font-semibold text-white"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "복사됨" : "링크 복사"}
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[#dbe2ea] bg-white px-4 text-[13px] font-semibold text-[#334155]"
                >
                  <ExternalLink className="h-4 w-4" />
                  새 창에서 열기
                </a>
              </div>
            </div>

            <div className="hidden w-[180px] shrink-0 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-5 text-center lg:block">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b]">
                <QrCode className="h-12 w-12" />
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[#64748b]">QR 출력 기능은 예약 링크 검증 후 연결합니다.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
