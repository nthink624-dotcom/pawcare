"use client";

import { Camera, CheckCircle2, ImagePlus, PawPrint, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { CalendarCareReportCompletionPanel } from "@/components/owner-web/calendar-care-report-completion-panel";
import {
  CalendarGroomingCompletionFields,
  type GroomingCompletionDetails,
} from "@/components/owner-web/calendar-grooming-completion-fields";
import { OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";

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
];

function PhotoCard({ label, registered }: { label: string; registered?: boolean }) {
  return (
    <button
      type="button"
      className={`group relative flex min-h-[152px] flex-col items-center justify-center overflow-hidden rounded-[14px] border text-center transition ${
        registered
          ? "border-[#bfd4ec] bg-[linear-gradient(145deg,#edf5fd,#dceaf8)]"
          : "border-dashed border-[#c9d7e6] bg-[#f9fbfd] hover:border-[#8fb4dc] hover:bg-[#f4f8fd]"
      }`}
    >
      {registered ? (
        <>
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/80 text-[#4c78a8] shadow-sm">
            <PawPrint className="h-7 w-7" />
          </span>
          <span className={`${OWNER_TYPOGRAPHY.bodyStrong} mt-3 text-[#274a70]`}>{label} 등록됨</span>
          <span className={`${OWNER_TYPOGRAPHY.label} mt-1 text-[#7189a3]`}>클릭해서 교체</span>
          <span className={`${OWNER_TYPOGRAPHY.badge} absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[#27715a]`}>
            <CheckCircle2 className="h-3 w-3" /> 등록
          </span>
        </>
      ) : (
        <>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eaf2fb] text-[#3978b5]">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className={`${OWNER_TYPOGRAPHY.bodyStrong} mt-3 text-[#314b67]`}>{label} 추가</span>
          <span className={`${OWNER_TYPOGRAPHY.label} mt-1 text-[#899aab]`}>선택 사항</span>
        </>
      )}
    </button>
  );
}

export function OwnerCareReportCompletionPreviewClient() {
  const [details, setDetails] = useState(initialDetails);
  const [, setCareReportBusy] = useState(false);
  const [photoRegistrationEnabled, setPhotoRegistrationEnabled] = useState(true);
  const [previewServiceId, setPreviewServiceId] = useState("preview-service-full");
  const previewServiceName =
    previewServices.find((service) => service.id === previewServiceId)?.name ?? "전체미용";

  return (
    <main className="min-h-screen bg-[#eaf0f6] px-6 py-8">
      <style jsx global>{`nextjs-portal { display: none !important; }`}</style>
      <div className="pointer-events-none fixed inset-0 opacity-35 [background-image:linear-gradient(#d9e3ed_1px,transparent_1px),linear-gradient(90deg,#d9e3ed_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto w-full max-w-[760px]">
        <section className="overflow-hidden rounded-[20px] border border-[#cfdae6] bg-white shadow-[0_28px_80px_rgba(28,48,72,0.16)]">
          <header className="flex items-center justify-between gap-5 border-b border-[#e2e9f0] bg-white px-6 py-[18px]">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#eaf3fe] text-[#2f6fd6]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-[26px] font-semibold leading-[1.25] tracking-[-0.03em] text-[#15243a]">AI 케어리포트 작성</h1>
                <p className="mt-1 text-[16px] leading-6 text-[#60758c]">두부 · {previewServiceName} · 도윤 디자이너</p>
              </div>
            </div>
            <button type="button" aria-label="닫기" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6b7c8e] transition hover:bg-[#f1f5f8]">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-4 bg-[#f5f8fb] p-5">
            <section className="rounded-[14px] border border-[#d7e2ed] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className={`${OWNER_TYPOGRAPHY.sectionTitle} flex items-center gap-2 text-[#172c46]`}>
                    <Camera className="h-[18px] w-[18px] text-[#3978b5]" /> 미용 전·후 사진
                  </p>
                  <label className={`${OWNER_TYPOGRAPHY.label} inline-flex items-center gap-2 text-[#536f8e]`}>
                    <input
                      type="checkbox"
                      checked={photoRegistrationEnabled}
                      onChange={(event) => setPhotoRegistrationEnabled(event.target.checked)}
                      className="h-4 w-4 accent-[#2f6fd6]"
                    />
                    사진 등록
                  </label>
                </div>
                {photoRegistrationEnabled ? <div className="mt-3 grid grid-cols-2 gap-3">
                  <PhotoCard label="미용 전 사진" registered />
                  <PhotoCard label="미용 후 사진" />
                </div> : null}
            </section>

            <CalendarGroomingCompletionFields
              value={details}
              onChange={setDetails}
              serviceId={previewServiceId}
              serviceName={previewServiceName}
              services={previewServices}
              onServiceChange={setPreviewServiceId}
            />

            <CalendarCareReportCompletionPanel
              shopId="care-report-preview-shop"
              appointmentId="care-report-preview-appointment"
              details={details}
              onDetailsChange={setDetails}
              hasRegisteredPhotos={photoRegistrationEnabled}
              serviceName={previewServiceName}
              onPendingChange={setCareReportBusy}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
