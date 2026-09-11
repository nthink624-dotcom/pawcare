"use client";

import { ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function CalendarCareReportChoiceDialog({
  petName,
  serviceName,
  saving,
  error,
  onOpenReport,
  onPublishBasic,
  onClose,
}: {
  petName: string;
  serviceName: string;
  saving: boolean;
  error: string;
  onOpenReport: () => void;
  onPublishBasic: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    primaryActionRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (!saving) onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
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
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/30 px-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-report-choice-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[390px] rounded-[20px] border border-[#d8dee6] bg-white p-5 shadow-[0_24px_80px_rgba(20,39,63,0.2)]"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#edf4ff] text-[#2f6fd6]">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id="care-report-choice-title" className="text-[20px] font-semibold tracking-[-0.035em] text-[#142033]">
              미용 완료 기록을 남겨주세요
            </h3>
            <p className="mt-1 text-[14px] text-[#6b7785]">
              {petName} · {serviceName || "예약 서비스"}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <button
            ref={primaryActionRef}
            type="button"
            onClick={onOpenReport}
            disabled={saving}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[11px] bg-[#2f6fd6] text-[16px] font-semibold text-white transition hover:bg-[#245fbd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
          >
            <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
            AI 케어리포트 작성하기
          </button>
          <button
            type="button"
            onClick={onPublishBasic}
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[#d5dbe2] bg-white text-[15px] font-medium text-[#526171] transition hover:bg-[#f6f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            기본 기록만 보내기
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-[9px] border border-[#f1b9c1] bg-[#fff8f8] px-3 py-2 text-[13px] leading-5 text-[#a04455]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
