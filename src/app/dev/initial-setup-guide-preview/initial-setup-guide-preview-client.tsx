"use client";

import { useState } from "react";

import OwnerInitialSetupGuide from "@/components/owner-web/owner-initial-setup-guide";
import type { BootstrapPayload } from "@/types/domain";

const PREVIEW_DATA = {
  mode: "mock",
  shop: {
    id: "initial-setup-guide-preview-shop",
    name: "펫매니저 미용실",
    business_hours: {
      0: { open: "10:00", close: "19:00", enabled: false },
      1: { open: "10:00", close: "19:00", enabled: true },
      2: { open: "10:00", close: "19:00", enabled: true },
      3: { open: "10:00", close: "19:00", enabled: true },
      4: { open: "10:00", close: "19:00", enabled: true },
      5: { open: "10:00", close: "19:00", enabled: true },
      6: { open: "10:00", close: "18:00", enabled: true },
    },
    booking_slot_interval_minutes: 15,
    customer_page_settings: {
      customer_service_overrides: {
        "preview-service-full": { visible: true },
        "preview-service-bath": { visible: true },
        "preview-service-partial": { visible: true },
      },
    },
  },
  services: [
    { id: "preview-service-full", name: "전체미용", is_active: true },
    { id: "preview-service-bath", name: "목욕 + 부분정리", is_active: true },
    { id: "preview-service-partial", name: "부분미용", is_active: true },
  ],
  staffMembers: [
    { id: "preview-owner", name: "원장", role: "원장" },
  ],
} as unknown as BootstrapPayload;

export default function InitialSetupGuidePreviewClient() {
  const [open, setOpen] = useState(true);
  const [lastAction, setLastAction] = useState("현재 화면을 직접 눌러보며 확인할 수 있습니다.");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f7] p-6">
      <div className="rounded-[18px] border border-[#d8e1ec] bg-white px-8 py-7 text-center shadow-sm">
        <p className="text-[13px] font-bold tracking-[0.08em] text-[#316fe8]">OWNER QUICK START</p>
        <h1 className="mt-2 text-[25px] font-bold tracking-[-0.035em] text-[#172033]">오너 초기 설정 가이드 확인</h1>
        <p className="mt-2 text-[14px] text-[#64748b]">{lastAction}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 h-11 rounded-[11px] bg-[#172033] px-5 text-[14px] font-bold text-white"
        >
          가이드 다시 열기
        </button>
      </div>

      <OwnerInitialSetupGuide
        open={open}
        data={PREVIEW_DATA}
        onClose={() => setOpen(false)}
        onNavigate={(screen) => {
          setLastAction(`‘${screen}’ 설정 화면으로 이동하는 버튼입니다.`);
          setOpen(false);
        }}
      />
    </main>
  );
}
