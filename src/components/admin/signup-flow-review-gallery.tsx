"use client";

import { ArrowLeft, ArrowRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import type { SignupFlowReviewItem, SignupFlowReviewManifest } from "@/lib/admin/signup-flow-review-contract";

const statusLabel = {
  captured: "캡처 완료",
  not_captured: "미캡처",
  implementation_waiting: "구현 대기",
} as const;

export default function SignupFlowReviewGallery({ manifest }: { manifest: SignupFlowReviewManifest }) {
  const captured = useMemo(() => manifest.items.filter((item) => item.status === "captured"), [manifest.items]);
  const happyPath = useMemo(() => manifest.items.filter((item) => item.group === "happy_path"), [manifest.items]);
  const importantStates = useMemo(() => manifest.items.filter((item) => item.group === "important_state"), [manifest.items]);
  const [selectedId, setSelectedId] = useState(captured[0]?.id ?? manifest.items[0]?.id ?? "");
  const [loadedImageId, setLoadedImageId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const selected = manifest.items.find((item) => item.id === selectedId) ?? manifest.items[0];
  const selectedIndex = captured.findIndex((item) => item.id === selected?.id);
  const imageReady = Boolean(selected?.captureUrl && loadedImageId === selected.id);

  const selectItem = useCallback((id: string) => {
    setLoadedImageId("");
    setSelectedId(id);
  }, []);

  const closeExpanded = useCallback(() => {
    setExpanded(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!expanded) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeExpanded();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button,[href],[tabindex]:not([tabindex='-1'])") ?? []).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeExpanded, expanded]);

  const selectRelative = (delta: number) => {
    if (selectedIndex < 0 || captured.length === 0) return;
    selectItem(captured[(selectedIndex + delta + captured.length) % captured.length].id);
  };

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 pb-8 pt-24 text-[#111827] sm:px-6 sm:pt-20" data-type-system="ADMIN_TYPOGRAPHY">
      <div className="mx-auto max-w-[1320px]">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`${T.secondary} font-medium text-[#6b7280]`}>관리자 내부 검수 · 로컬 fixture</p>
            <h1 className={`${T.pageTitle} mt-1 font-bold`}>회원가입 흐름 검수</h1>
          </div>
          <div className={`${T.secondary} text-right text-[#6b7280]`}>
            <p>기본 단계 {manifest.capturedInventoryCount}/{manifest.inventoryCount}</p>
            <p>{manifest.generatedAt ? `마지막 캡처 ${formatCapturedAt(manifest.generatedAt)}` : "아직 캡처 없음"}</p>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden overflow-hidden rounded-[14px] border border-[#e5e7eb] bg-white sm:block" aria-label="회원가입 검수 목차">
            <ReviewGroup title="기본 가입 흐름" items={happyPath} selectedId={selected?.id} onSelect={selectItem} />
            <ReviewGroup title="중요 상태" items={importantStates} selectedId={selected?.id} onSelect={selectItem} />
          </aside>

          <div className="space-y-2 sm:hidden">
            <nav className="flex h-11 snap-x overflow-x-auto rounded-[10px] border border-[#e5e7eb] bg-white" aria-label="기본 가입 흐름">
              {happyPath.map((item) => <CompactTab key={item.id} item={item} selected={selected?.id === item.id} onSelect={selectItem} />)}
            </nav>
            <details className="rounded-[10px] border border-[#e5e7eb] bg-white">
              <summary className={`${T.body} flex min-h-11 cursor-pointer list-none items-center justify-between px-3 font-medium`}>중요 상태 <span className={`${T.badge} text-[#6b7280]`}>{importantStates.length}개</span></summary>
              <div className="max-h-[220px] divide-y divide-[#f0f1f3] overflow-y-auto border-t border-[#e5e7eb]">
                {importantStates.map((item) => <CompactState key={item.id} item={item} selected={selected?.id === item.id} onSelect={selectItem} />)}
              </div>
            </details>
          </div>

          {selected ? (
            <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#e5e7eb] bg-white" aria-live="polite" data-selected-id={selected.id} data-selected-title={selected.screenName}>
              <div className="border-b border-[#e5e7eb] px-4 py-2.5 sm:px-5 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={`${T.secondary} shrink-0 text-[#6b7280]`}>{selected.stepNumber ? `STEP ${String(selected.stepNumber).padStart(2, "0")}` : "중요 상태"}</p>
                      <h2 className={`${T.cardTitle} min-w-0 truncate font-semibold sm:hidden`}>{selected.screenName}</h2>
                    </div>
                    <h2 className={`${T.sectionTitle} mt-1 hidden font-semibold sm:block`}>{selected.screenName}</h2>
                    <p className={`${T.body} mt-1 hidden max-w-[760px] text-[#4b5563] sm:block`}>{selected.purpose}</p>
                  </div>
                  <span className={`${T.badge} rounded-full border border-[#d1d5db] px-3 py-1 text-[#4b5563]`}>{statusLabel[selected.status]}</span>
                </div>
              </div>

              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 border-b border-[#e5e7eb] p-4 xl:border-b-0 xl:border-r sm:p-5">
                  {selected.captureUrl ? (
                    <button ref={openerRef} type="button" disabled={!imageReady} aria-busy={!imageReady} onClick={(event) => { openerRef.current = event.currentTarget; setExpanded(true); }} className="group relative mx-auto block aspect-[390/844] w-full max-w-[390px] overflow-hidden rounded-[18px] border border-[#d1d5db] bg-[#f3f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black disabled:cursor-wait" aria-label={`${selected.screenName} 캡처 크게 보기`}>
                      {!imageReady ? <span className={`${T.secondary} absolute inset-0 grid place-items-center bg-[#f3f4f6] text-[#6b7280]`}>캡처 불러오는 중</span> : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={selected.id} src={selected.captureUrl} alt={`${selected.screenName} 390×844 actual local capture`} data-review-item-id={selected.id} onLoad={() => setLoadedImageId(selected.id)} className={`block h-full w-full object-contain object-top ${imageReady ? "opacity-100" : "opacity-0"}`} />
                      <span className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-black/75 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Expand className="h-4 w-4" /></span>
                    </button>
                  ) : (
                    <div className="mx-auto flex min-h-[420px] max-w-[390px] items-center justify-center rounded-[18px] border border-dashed border-[#d1d5db] bg-[#f9fafb] px-8 text-center">
                      <div><p className={`${T.body} font-medium`}>{statusLabel[selected.status]}</p><p className={`${T.secondary} mt-2 text-[#6b7280]`}>{selected.note ?? "검수 화면이 준비되지 않았습니다."}</p></div>
                    </div>
                  )}
                </div>
                <dl className="divide-y divide-[#e5e7eb]">
                  <Meta label="실제 경로" value={selected.route} />
                  <Meta label="주요 CTA" value={selected.primaryCta} />
                  <Meta label="다음 단계" value={selected.nextStep} />
                  <Meta label="source" value={selected.source} />
                  <Meta label="viewport" value={selected.viewport ?? "해당 없음"} />
                  <Meta label="PNG" value={selected.pixelDimensions ?? "해당 없음"} />
                  <Meta label="device scale" value={selected.deviceScaleFactor ? `${selected.deviceScaleFactor}×` : "해당 없음"} />
                  <Meta label="fixture" value={selected.fixture ? "synthetic fixture" : "아님"} />
                  {selected.note ? <Meta label="확인 사항" value={selected.note} /> : null}
                </dl>
              </div>

              {selected.captureUrl ? (
                <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 sm:px-5">
                  <button type="button" onClick={() => selectRelative(-1)} className={`${T.button} inline-flex items-center gap-2 rounded-[8px] border border-[#d1d5db] px-3`}><ArrowLeft className="h-4 w-4" />이전 화면</button>
                  <button type="button" onClick={() => selectRelative(1)} className={`${T.button} inline-flex items-center gap-2 rounded-[8px] bg-[#111827] px-3 text-white`}>다음 화면<ArrowRight className="h-4 w-4" /></button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {expanded && selected?.captureUrl ? (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${selected.screenName} 확대 보기`} className="fixed inset-0 z-[100] grid bg-black/70 p-3 sm:p-6">
          <button ref={closeButtonRef} type="button" onClick={closeExpanded} aria-label="확대 보기 닫기" className={`${T.button} absolute right-4 top-4 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white text-black`}><X className="h-5 w-5" /></button>
          <div className="m-auto flex max-h-full max-w-[1180px] items-center justify-center overflow-auto rounded-[14px] bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.captureUrl} alt={`${selected.screenName} 확대 캡처`} className="max-h-[calc(100dvh-48px)] w-auto max-w-full object-contain object-top" />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ReviewGroup({ title, items, selectedId, onSelect }: { title: string; items: SignupFlowReviewItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  return <section className="border-b border-[#e5e7eb] last:border-b-0"><h2 className={`${T.secondary} px-4 py-3 font-semibold text-[#4b5563]`}>{title}</h2><div className="divide-y divide-[#f0f1f3]">{items.map((item) => <button key={item.id} type="button" data-review-item-id={item.id} onClick={() => onSelect(item.id)} className={`flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left ${selectedId === item.id ? "bg-[#111827] text-white" : "bg-white hover:bg-[#f9fafb]"}`}><span className={`${T.badge} w-7 shrink-0 ${selectedId === item.id ? "text-[#d1d5db]" : "text-[#9ca3af]"}`}>{item.stepNumber ? String(item.stepNumber).padStart(2, "0") : "상태"}</span><span className={`${T.body} min-w-0 flex-1 truncate font-medium`}>{item.screenName}</span><span className={`${T.badge} shrink-0 ${selectedId === item.id ? "text-[#d1d5db]" : "text-[#6b7280]"}`}>{item.status === "captured" ? "완료" : "대기"}</span></button>)}</div></section>;
}

function CompactTab({ item, selected, onSelect }: { item: SignupFlowReviewItem; selected: boolean; onSelect: (id: string) => void }) {
  return <button type="button" data-review-item-id={item.id} onClick={() => onSelect(item.id)} aria-current={selected ? "step" : undefined} className={`${T.badge} min-h-11 min-w-[112px] snap-start whitespace-nowrap px-3 font-medium ${selected ? "bg-[#111827] text-white" : "bg-white text-[#4b5563]"}`}>{item.stepNumber}. {item.screenName}</button>;
}

function CompactState({ item, selected, onSelect }: { item: SignupFlowReviewItem; selected: boolean; onSelect: (id: string) => void }) {
  return <button type="button" data-review-item-id={item.id} onClick={() => onSelect(item.id)} className={`${T.secondary} flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left ${selected ? "bg-[#111827] text-white" : "bg-white text-[#4b5563]"}`}><span className="min-w-0 flex-1 truncate">{item.screenName}</span><span className={`${T.badge} shrink-0`}>{item.status === "captured" ? "완료" : "대기"}</span></button>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="px-4 py-3 sm:px-5"><dt className={`${T.badge} text-[#6b7280]`}>{label}</dt><dd className={`${T.body} mt-1 break-words text-[#111827]`}>{value}</dd></div>;
}

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
