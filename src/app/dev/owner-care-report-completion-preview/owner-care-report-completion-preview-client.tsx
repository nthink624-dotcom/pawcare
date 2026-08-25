"use client";

import { Camera, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";

import { CalendarCareReportCompletionPanel } from "@/components/owner-web/calendar-care-report-completion-panel";
import { CalendarCareReportPhotoCard } from "@/components/owner-web/calendar-care-report-photo-card";
import {
  CalendarGroomingCompletionFields,
  type GroomingCompletionDetails,
} from "@/components/owner-web/calendar-grooming-completion-fields";
import { CARE_REPORT_TYPOGRAPHY } from "@/components/owner-web/owner-typography";

const initialDetails: GroomingCompletionDetails = {
  treatmentNotes: "전체미용",
  specialNotes: "",
  internalNotes: "다음 방문 때 귀 뒤쪽 엉킴 상태 확인",
  nextRecommendedVisitDate: "2026-09-23",
};

const previewServices = [
  {
    id: "preview-service-full",
    shop_id: "care-report-preview-shop",
    name: "전체미용",
    price: 80000,
    duration_minutes: 120,
    is_active: true,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  },
  {
    id: "preview-service-bath",
    shop_id: "care-report-preview-shop",
    name: "목욕 + 부분정리",
    price: 55000,
    duration_minutes: 90,
    is_active: true,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  },
  {
    id: "preview-service-bath-basic",
    shop_id: "care-report-preview-shop",
    name: "목욕",
    price: 35000,
    duration_minutes: 60,
    is_active: true,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  },
  {
    id: "preview-service-hygiene",
    shop_id: "care-report-preview-shop",
    name: "위생 미용",
    price: 25000,
    duration_minutes: 45,
    is_active: true,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  },
  {
    id: "preview-service-partial",
    shop_id: "care-report-preview-shop",
    name: "부분 미용",
    price: 30000,
    duration_minutes: 45,
    is_active: true,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  },
  {
    id: "preview-service-spa",
    shop_id: "care-report-preview-shop",
    name: "스파/약욕 케어",
    price: 40000,
    duration_minutes: 60,
    is_active: true,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  },
];

type OwnerCareReportCompletionPreviewClientProps = {
  readOnly?: boolean;
};

export function OwnerCareReportCompletionPreviewClient({
  readOnly = false,
}: OwnerCareReportCompletionPreviewClientProps) {
  const [details, setDetails] = useState(initialDetails);
  const [, setCareReportBusy] = useState(false);
  const [photoRegistrationEnabled, setPhotoRegistrationEnabled] = useState(true);
  const [activePhoto, setActivePhoto] = useState<"before" | "after">("after");
  const [previewServiceId, setPreviewServiceId] = useState("preview-service-full");
  const [currentWeightKg, setCurrentWeightKg] = useState("10.3");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startY: number; scrollTop: number } | null>(null);
  const previewServiceName =
    previewServices.find((service) => service.id === previewServiceId)?.name ?? "전체미용";

  return (
    <main className={readOnly ? "min-h-screen bg-white" : "min-h-screen bg-[#f3f5f7] px-2 py-2 sm:px-6 sm:py-3"}>
      <style jsx global>{`
        nextjs-portal { display: none !important; }
        ${readOnly ? `
          html, body {
            height: 100%;
            overflow: hidden !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none;
          }
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        ` : ""}
      `}</style>
      {!readOnly ? <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(#e1e5ea_1px,transparent_1px),linear-gradient(90deg,#e1e5ea_1px,transparent_1px)] [background-size:72px_72px]" /> : null}

      <div className={`relative mx-auto w-full max-w-[520px] ${readOnly ? "h-screen" : ""}`}>
        <section className={`relative flex flex-col overflow-hidden rounded-[22px] border border-[#d8dee6] bg-white ${readOnly ? "h-screen shadow-none" : "max-h-[calc(100vh-16px)] shadow-[0_24px_70px_rgba(20,39,63,0.13)]"}`}>
          <header className={`z-20 flex shrink-0 items-center justify-between gap-5 rounded-t-[22px] border-b border-[#e5e8ec] bg-white px-4 py-2.5 ${readOnly ? "pr-0" : ""}`}>
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#edf4ff] text-[#2f6fd6]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h1 className={`${CARE_REPORT_TYPOGRAPHY.modalTitle} tracking-[-0.03em] text-[#142033]`}>AI 케어리포트 작성</h1>
                <p className={`${CARE_REPORT_TYPOGRAPHY.body} mt-1 text-[#6b7785]`}>두부 · {previewServiceName} · 도윤 디자이너</p>
              </div>
            </div>
            <button type="button" aria-label="닫기" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#66717f] transition hover:bg-[#f2f4f6]">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollContainerRef} className={`no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-white p-3 ${readOnly ? "pr-0" : ""}`}>
            <section className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className={`${CARE_REPORT_TYPOGRAPHY.sectionTitle} flex shrink-0 items-center gap-2 text-[#1b2d43]`}>
                    <Camera className="h-[18px] w-[18px] text-[#526171]" /> 사진
                  </p>
                  <div className="flex rounded-[9px] bg-[#f0f2f4] p-0.5" role="tablist" aria-label="미용 사진 선택">
                    {([
                      ["before", "미용 전"],
                      ["after", "미용 후"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={activePhoto === key}
                        onClick={() => setActivePhoto(key)}
                        className={`${CARE_REPORT_TYPOGRAPHY.label} inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 transition ${
                          activePhoto === key ? "bg-[#edf4ff] font-semibold text-[#2f6fd6] shadow-sm" : "text-[#7a8490] hover:text-[#37485a]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className={`${CARE_REPORT_TYPOGRAPHY.label} ml-auto inline-flex items-center gap-2 text-[#526171]`}>
                    <input
                      type="checkbox"
                      checked={photoRegistrationEnabled}
                      onChange={(event) => setPhotoRegistrationEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[#2f6fd6]"
                    />
                    사진 등록
                  </label>
                </div>
                {photoRegistrationEnabled ? <div>
                  <CalendarCareReportPhotoCard
                    label={activePhoto === "before" ? "미용 전" : "미용 후"}
                    registered={activePhoto === "before"}
                    imageUrls={activePhoto === "before" ? ["/images/customer-booking-hero-original.jpg"] : []}
                  />
                </div> : null}
            </section>

            <CalendarGroomingCompletionFields
              value={details}
              onChange={setDetails}
              serviceId={previewServiceId}
              serviceName={previewServiceName}
              services={previewServices}
              onServiceChange={setPreviewServiceId}
              currentWeightKg={currentWeightKg}
              onWeightChange={setCurrentWeightKg}
            />

            <CalendarCareReportCompletionPanel
              shopId="care-report-preview-shop"
              appointmentId="care-report-preview-appointment"
              details={details}
              onDetailsChange={setDetails}
              currentWeightKg={currentWeightKg}
              hasRegisteredPhotos={photoRegistrationEnabled}
              serviceName={previewServiceName}
              onPendingChange={setCareReportBusy}
            />
          </div>
          {readOnly ? (
            <div
              className="absolute inset-0 z-50 cursor-grab touch-none active:cursor-grabbing"
              aria-label="케어리포트 작성 화면 미리보기. 위아래로 스크롤할 수 있습니다"
              onWheel={(event) => {
                event.preventDefault();
                scrollContainerRef.current?.scrollBy({ top: event.deltaY });
              }}
              onPointerDown={(event) => {
                dragStateRef.current = {
                  pointerId: event.pointerId,
                  startY: event.clientY,
                  scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const dragState = dragStateRef.current;
                if (!dragState || dragState.pointerId !== event.pointerId || !scrollContainerRef.current) return;
                scrollContainerRef.current.scrollTop = dragState.scrollTop + dragState.startY - event.clientY;
              }}
              onPointerUp={(event) => {
                if (dragStateRef.current?.pointerId === event.pointerId) dragStateRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                dragStateRef.current = null;
              }}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
