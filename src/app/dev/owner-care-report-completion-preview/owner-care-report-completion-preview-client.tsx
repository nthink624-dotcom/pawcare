"use client";

import { ArrowRight, Camera, CheckCircle2, Eye, ImagePlus, PawPrint, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { CalendarCareReportCompletionPanel } from "@/components/owner-web/calendar-care-report-completion-panel";
import {
  CalendarGroomingCompletionFields,
  type GroomingCompletionDetails,
} from "@/components/owner-web/calendar-grooming-completion-fields";

const initialDetails: GroomingCompletionDetails = {
  treatmentNotes: "전체미용",
  specialNotes: "피부 상태 양호\n귀 뒤쪽 엉킴이 있어 빗질 관리가 필요해요.\n미용 중에는 편안한 반응을 보였어요.",
  internalNotes: "다음 방문 때 귀 뒤쪽 엉킴 상태 확인",
  nextRecommendedVisitDate: "2026-09-23",
};

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
          <span className="mt-3 text-[13px] font-semibold text-[#274a70]">{label} 등록됨</span>
          <span className="mt-1 text-[11px] text-[#7189a3]">클릭해서 교체</span>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#27715a]">
            <CheckCircle2 className="h-3 w-3" /> 등록
          </span>
        </>
      ) : (
        <>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eaf2fb] text-[#3978b5]">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="mt-3 text-[13px] font-semibold text-[#314b67]">{label} 추가</span>
          <span className="mt-1 text-[11px] text-[#899aab]">선택 사항</span>
        </>
      )}
    </button>
  );
}

export function OwnerCareReportCompletionPreviewClient() {
  const [details, setDetails] = useState(initialDetails);
  const [careReportBusy, setCareReportBusy] = useState(false);

  return (
    <main className="min-h-screen bg-[#eaf0f6] px-6 py-8">
      <style jsx global>{`nextjs-portal { display: none !important; }`}</style>
      <div className="pointer-events-none fixed inset-0 opacity-35 [background-image:linear-gradient(#d9e3ed_1px,transparent_1px),linear-gradient(90deg,#d9e3ed_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto w-full max-w-[1180px]">
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[#3978b5]">OWNER PC · AFTER COMPLETION</p>
            <h1 className="mt-1 text-[25px] font-semibold tracking-[-0.04em] text-[#162235]">미용 완료 후 케어리포트 작성</h1>
          </div>
          <p className="text-[12px] text-[#6e8195]">완료 상태와 실제 소요 시간은 이미 저장된 상태입니다.</p>
        </div>

        <section className="overflow-hidden rounded-[20px] border border-[#cfdae6] bg-white shadow-[0_28px_80px_rgba(28,48,72,0.16)]">
          <header className="flex items-center justify-between gap-5 border-b border-[#e2e9f0] bg-white px-6 py-[18px]">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e8f4ef] text-[#27715a]">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-[#15243a]">두부 미용 완료</h2>
                  <span className="rounded-full bg-[#edf7f3] px-2.5 py-1 text-[11px] font-semibold text-[#27715a]">오후 12:08 완료 처리</span>
                </div>
                <p className="mt-1 text-[12px] text-[#6f8194]">전체미용 · 도윤 담당 · 케어리포트는 지금 작성하거나 나중에 이어서 작성할 수 있어요.</p>
              </div>
            </div>
            <button type="button" aria-label="닫기" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6b7c8e] transition hover:bg-[#f1f5f8]">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="grid grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-5 bg-[#f5f8fb] p-5">
            <div className="min-w-0">
              <section className="rounded-[14px] border border-[#d7e2ed] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[#172c46]">
                      <Camera className="h-4 w-4 text-[#3978b5]" /> 미용 전·후 사진
                    </p>
                    <p className="mt-1 text-[12px] text-[#75879a]">사진이 없어도 케어리포트를 작성할 수 있습니다.</p>
                  </div>
                  <span className="rounded-full bg-[#f2f5f8] px-2.5 py-1 text-[10px] font-semibold text-[#718092]">선택</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <PhotoCard label="미용 전 사진" registered />
                  <PhotoCard label="미용 후 사진" />
                </div>
              </section>

              <CalendarGroomingCompletionFields
                value={details}
                onChange={setDetails}
                serviceName="전체미용"
                draftStatus="saved"
                lastSavedAt={new Date().toISOString()}
              />
            </div>

            <div className="min-w-0 -mt-4">
              <CalendarCareReportCompletionPanel
                shopId="care-report-preview-shop"
                appointmentId="care-report-preview-appointment"
                details={details}
                serviceName="전체미용"
                onPendingChange={setCareReportBusy}
              />

              <section className="mt-4 overflow-hidden rounded-[14px] border border-[#d7e2ed] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#e4ebf2] px-4 py-3.5">
                  <div>
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[#172c46]">
                      <Eye className="h-4 w-4 text-[#3978b5]" /> 고객에게 보이는 결과
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8191a2]">AI 초안을 만들면 아래 형식으로 바로 정리됩니다.</p>
                  </div>
                  <span className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-[10px] font-semibold text-[#4c6f95]">미리보기</span>
                </div>

                <div className="p-4">
                  <div className="rounded-[12px] border border-[#dbe7f3] bg-[#f5f9fe] px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2f6fd6]">
                      <Sparkles className="h-3.5 w-3.5" /> 오늘의 한 줄
                    </p>
                    <p className="mt-1.5 text-[15px] font-semibold leading-6 text-[#203b59]">두부는 오늘도 편안하게 전체미용을 마쳤어요.</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <div className="rounded-[11px] border border-[#e1e8ef] px-3.5 py-3">
                      <p className="text-[11px] font-semibold text-[#71859a]">오늘 확인한 상태</p>
                      <p className="mt-1.5 text-[13px] leading-5 text-[#304861]">피부 상태는 양호하고, 귀 뒤쪽에 가벼운 엉킴이 있었어요.</p>
                    </div>
                    <div className="rounded-[11px] border border-[#e1e8ef] px-3.5 py-3">
                      <p className="text-[11px] font-semibold text-[#71859a]">집에서 관리하기</p>
                      <p className="mt-1.5 text-[13px] leading-5 text-[#304861]">귀 뒤쪽은 일주일에 2~3회 가볍게 빗질해 주세요.</p>
                    </div>
                  </div>

                  <button type="button" className="mt-3 flex h-10 w-full items-center justify-between rounded-[10px] bg-[#172c46] px-4 text-[12px] font-semibold text-white">
                    <span>고객 결과 화면 전체 보기</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            </div>
          </div>

          <footer className="flex items-center justify-between gap-4 border-t border-[#e1e8ef] bg-white px-6 py-4">
            <div>
              <p className="text-[13px] font-semibold text-[#334a63]">입력 내용은 자동 저장됩니다.</p>
              <p className="mt-0.5 text-[11px] text-[#8392a2]">PC에서 닫고 휴대폰에서 사진을 추가해도 이어서 작성할 수 있어요.</p>
            </div>
            <button
              type="button"
              disabled={careReportBusy}
              className="h-10 rounded-[10px] border border-[#cfd9e4] bg-white px-5 text-[13px] font-semibold text-[#40566d] transition hover:bg-[#f5f8fb] disabled:opacity-50"
            >
              닫기
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
