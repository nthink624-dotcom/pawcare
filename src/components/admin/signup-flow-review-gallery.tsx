"use client";

import { ArrowLeft, ArrowRight, Expand, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { SignupFlowReviewItem, SignupFlowReviewManifest } from "@/lib/admin/signup-flow-review-contract";

const statusLabel = {
  captured: "캡처 완료",
  not_captured: "미캡처",
  implementation_waiting: "구현 대기",
} as const;

export default function SignupFlowReviewGallery({ manifest }: { manifest: SignupFlowReviewManifest }) {
  const captured = useMemo(() => manifest.items.filter((item) => item.status === "captured"), [manifest.items]);
  const [selectedId, setSelectedId] = useState(captured[0]?.id ?? manifest.items[0]?.id ?? "");
  const [expanded, setExpanded] = useState(false);
  const selected = manifest.items.find((item) => item.id === selectedId) ?? manifest.items[0];
  const selectedIndex = captured.findIndex((item) => item.id === selected?.id);

  const selectRelative = (delta: number) => {
    if (selectedIndex < 0 || captured.length === 0) return;
    const next = captured[(selectedIndex + delta + captured.length) % captured.length];
    setSelectedId(next.id);
  };

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 pb-8 pt-24 text-[#111827] sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-[1320px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#6b7280]">관리자 내부 검수 · 로컬 fixture</p>
            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em]">회원가입 흐름 검수</h1>
          </div>
          <div className="text-right text-[13px] leading-5 text-[#6b7280]">
            <p>기본 단계 {manifest.capturedInventoryCount}/{manifest.inventoryCount}</p>
            <p>{manifest.generatedAt ? `마지막 캡처 ${formatCapturedAt(manifest.generatedAt)}` : "아직 캡처 없음"}</p>
          </div>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white" aria-label="회원가입 검수 목차">
            <ReviewGroup title="기본 가입 흐름" items={manifest.items.filter((item) => item.group === "happy_path")} selectedId={selected?.id} onSelect={setSelectedId} />
            <ReviewGroup title="중요 상태" items={manifest.items.filter((item) => item.group === "important_state")} selectedId={selected?.id} onSelect={setSelectedId} />
          </aside>

          {selected ? (
            <section className="min-w-0 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white" aria-live="polite">
              <div className="border-b border-[#e5e7eb] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-[#6b7280]">{selected.stepNumber ? `STEP ${String(selected.stepNumber).padStart(2, "0")}` : "중요 상태"}</p>
                    <h2 className="mt-1 text-[20px] font-semibold">{selected.screenName}</h2>
                    <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#4b5563]">{selected.purpose}</p>
                  </div>
                  <span className="rounded-full border border-[#d1d5db] px-3 py-1 text-[12px] text-[#4b5563]">{statusLabel[selected.status]}</span>
                </div>
              </div>

              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 border-b border-[#e5e7eb] p-4 xl:border-b-0 xl:border-r sm:p-5">
                  {selected.captureUrl ? (
                    <button type="button" onClick={() => setExpanded(true)} className="group relative mx-auto block max-w-[390px] overflow-hidden rounded-[24px] border border-[#d1d5db] bg-[#f3f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black" aria-label={`${selected.screenName} 캡처 크게 보기`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selected.captureUrl} alt={`${selected.screenName} 390×844 actual local capture`} className="block h-auto w-full" />
                      <span className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-black/75 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Expand className="h-4 w-4" /></span>
                    </button>
                  ) : (
                    <div className="mx-auto flex min-h-[420px] max-w-[390px] items-center justify-center rounded-[24px] border border-dashed border-[#d1d5db] bg-[#f9fafb] px-8 text-center">
                      <div><p className="text-[16px] font-medium">{statusLabel[selected.status]}</p><p className="mt-2 text-[13px] leading-5 text-[#6b7280]">{selected.note ?? "검수 화면이 준비되지 않았습니다."}</p></div>
                    </div>
                  )}
                </div>
                <dl className="divide-y divide-[#e5e7eb] text-[14px]">
                  <Meta label="실제 경로" value={selected.route} />
                  <Meta label="주요 CTA" value={selected.primaryCta} />
                  <Meta label="다음 단계" value={selected.nextStep} />
                  <Meta label="source" value={selected.source} />
                  <Meta label="viewport" value={selected.viewport ?? "해당 없음"} />
                  <Meta label="fixture" value={selected.fixture ? "synthetic fixture" : "아님"} />
                  {selected.note ? <Meta label="확인 사항" value={selected.note} /> : null}
                </dl>
              </div>

              {selected.captureUrl ? (
                <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 sm:px-5">
                  <button type="button" onClick={() => selectRelative(-1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d1d5db] px-3 text-[14px]"><ArrowLeft className="h-4 w-4" />이전 화면</button>
                  <button type="button" onClick={() => selectRelative(1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#111827] px-3 text-[14px] text-white">다음 화면<ArrowRight className="h-4 w-4" /></button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {expanded && selected?.captureUrl ? (
        <div role="dialog" aria-modal="true" aria-label={`${selected.screenName} 확대 보기`} className="fixed inset-0 z-[100] grid bg-black/70 p-3 sm:p-6">
          <button type="button" onClick={() => setExpanded(false)} aria-label="확대 보기 닫기" className="absolute right-4 top-4 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white text-black"><X className="h-5 w-5" /></button>
          <div className="m-auto flex max-h-full max-w-[1180px] items-center justify-center overflow-auto rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.captureUrl} alt={`${selected.screenName} 확대 캡처`} className="max-h-[calc(100dvh-48px)] w-auto max-w-full" />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ReviewGroup({ title, items, selectedId, onSelect }: { title: string; items: SignupFlowReviewItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  return <section className="border-b border-[#e5e7eb] last:border-b-0"><h2 className="px-4 py-3 text-[13px] font-semibold text-[#4b5563]">{title}</h2><div className="divide-y divide-[#f0f1f3]">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left ${selectedId === item.id ? "bg-[#111827] text-white" : "bg-white hover:bg-[#f9fafb]"}`}><span className={`w-7 shrink-0 text-[12px] ${selectedId === item.id ? "text-[#d1d5db]" : "text-[#9ca3af]"}`}>{item.stepNumber ? String(item.stepNumber).padStart(2, "0") : "상태"}</span><span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.screenName}</span><span className={`shrink-0 text-[11px] ${selectedId === item.id ? "text-[#d1d5db]" : "text-[#6b7280]"}`}>{item.status === "captured" ? "완료" : "대기"}</span></button>)}</div></section>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="px-4 py-3 sm:px-5"><dt className="text-[12px] text-[#6b7280]">{label}</dt><dd className="mt-1 break-words leading-5 text-[#111827]">{value}</dd></div>;
}

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
