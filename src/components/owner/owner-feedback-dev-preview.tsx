"use client";

import { useMemo, useRef, useState } from "react";

import OwnerContextActionMenu from "@/components/owner/owner-context-action-menu";
import OwnerTesterFeedbackSheet from "@/components/owner/owner-tester-feedback-sheet";
import type { OwnerFeedbackAdapter } from "@/lib/owner-feedback-adapter";
import type { TesterFeedbackCategory, TesterFeedbackScreenKey } from "@/lib/tester-feedback";

const previewScreens = [
  { key: "home", label: "오늘", screenKey: "home" },
  { key: "schedule", label: "예약 조회", screenKey: "schedule" },
  { key: "customers", label: "고객 관리", screenKey: "customers" },
  { key: "settings", label: "설정", screenKey: "shop_settings" },
] as const satisfies ReadonlyArray<{ key: string; label: string; screenKey: TesterFeedbackScreenKey }>;

export default function OwnerFeedbackDevPreview({ submitResult = "success" }: { submitResult?: "success" | "failure" }) {
  const [isTester, setIsTester] = useState(false);
  const [activeScreen, setActiveScreen] = useState<(typeof previewScreens)[number]["key"]>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<TesterFeedbackCategory>("inquiry");
  const [reservationOpenCount, setReservationOpenCount] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const adapter = useMemo<OwnerFeedbackAdapter>(() => ({
    async submit(submission) {
      if (submitResult === "failure") throw new Error("fixture failure");
      return {
        id: `fixture-${submission.requestId}`,
        category: submission.category,
        screenKey: submission.screenKey,
        appVersion: submission.appVersion,
        status: "accepted",
        createdAt: "2026-09-09T00:00:00.000Z",
        replayed: false,
      };
    },
  }), [submitResult]);
  const screen = previewScreens.find((item) => item.key === activeScreen) ?? previewScreens[0];

  return (
    <main className="mx-auto min-h-screen max-w-[430px] overflow-x-hidden bg-[#f4f6f9] pb-24 text-[#111a30]">
      <header className="sticky top-0 border-b border-[#dce3eb] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[20px] font-semibold leading-7">{screen.label}</h1>
          <button type="button" onClick={() => setIsTester((current) => !current)} className="min-h-11 rounded-[10px] border border-[#d7e4f2] bg-white px-3 text-[14px] font-medium leading-5 text-[#40566f]">{isTester ? "테스터" : "일반 오너"}</button>
        </div>
      </header>
      <section className="space-y-3 p-4" data-testid={`preview-screen-${screen.key}`}>
        <div className="min-h-28 rounded-[14px] border border-[#dce3eb] bg-white p-4 text-[14px] leading-5 text-[#526176]">{screen.label} 화면의 중요한 내용 영역</div>
        <div className="min-h-44 rounded-[14px] border border-[#dce3eb] bg-white p-4 text-[14px] leading-5 text-[#526176]">이동형 메뉴가 화면 가장자리와 하단 메뉴 안쪽에 유지되는지 확인합니다.</div>
        <output data-testid="reservation-open-count" className="block text-[13px] leading-5 text-[#526176]">예약 열기 {reservationOpenCount}회</output>
      </section>
      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-[#dce3eb] bg-white px-1 pb-[calc(env(safe-area-inset-bottom)+2px)] pt-1">
        {previewScreens.map((item) => <button key={item.key} type="button" onClick={() => setActiveScreen(item.key)} className="min-h-11 px-1 text-[12px] font-medium leading-4">{item.label}</button>)}
      </nav>
      <OwnerContextActionMenu
        ref={triggerRef}
        isOpen={menuOpen}
        isSuppressed={feedbackOpen}
        isTester={isTester}
        onOpenChange={setMenuOpen}
        onAddReservation={() => setReservationOpenCount((count) => count + 1)}
        onOpenFeedback={(category) => {
          setFeedbackCategory(category);
          setFeedbackOpen(true);
        }}
      />
      {feedbackOpen ? (
        <OwnerTesterFeedbackSheet
          shopId="dev-feedback-shop"
          screenKey={screen.screenKey}
          appVersion="dev-fixture"
          isTester={isTester}
          initialCategory={feedbackCategory}
          adapter={adapter}
          onClose={() => setFeedbackOpen(false)}
          returnFocusRef={triggerRef}
        />
      ) : null}
    </main>
  );
}
