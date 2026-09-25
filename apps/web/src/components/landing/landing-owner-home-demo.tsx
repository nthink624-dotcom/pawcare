"use client";

import { useState } from "react";

import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import type { BootstrapPayload } from "@/types/domain";

export function LandingOwnerHomeDemo({ initialData }: { initialData: BootstrapPayload }) {
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  return (
    <main className="relative min-h-screen min-w-[1280px] overflow-hidden bg-white">
      <OwnerWebPreview initialData={initialData} />
      <div className="absolute inset-0 z-[90]" aria-label="오너 홈 체험 화면">
        <button
          type="button"
          className="absolute left-[30%] top-[24%] h-[10%] w-[10%] cursor-pointer bg-transparent"
          aria-label="예약 확인"
          onClick={() => setBookingConfirmed(true)}
        />
        {bookingConfirmed ? (
          <div className="absolute right-[4%] top-[9%] w-[260px] rounded-[10px] border border-[#b9e3d0] bg-white px-4 py-3 shadow-[0_16px_32px_rgba(15,23,42,0.16)]" role="status">
            <p className="text-[15px] font-semibold text-[#166534]">예약했습니다.</p>
            <p className="mt-1 text-[13px] leading-5 text-[#526071]">체험 화면에서는 예약 확인만 가능합니다.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
