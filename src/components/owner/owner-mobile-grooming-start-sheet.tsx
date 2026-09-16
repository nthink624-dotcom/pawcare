"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

type Phase = "start" | "completion";
type Stage = "early-confirm" | "choices";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function OwnerMobileGroomingStartSheet({
  phase,
  stage,
  busy,
  onClose,
  onConfirmEarly,
  onPhotoAction,
  onDirectAction,
}: {
  phase: Phase;
  stage: Stage;
  busy: boolean;
  onClose: () => void;
  onConfirmEarly: () => void;
  onPhotoAction: () => void;
  onDirectAction: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isEarlyConfirm = stage === "early-confirm";
  const isCompletion = phase === "completion";
  const actionColor = isCompletion ? "#5B3A8C" : "#286bd1";
  const title = isEarlyConfirm
    ? "예약 시간 전입니다. 시작할까요?"
    : isCompletion
      ? "미용을 완료할까요?"
      : "미용을 시작할까요?";

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => returnFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [stage]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (!busy) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === firstElement || !dialogRef.current.contains(activeElement))) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && (activeElement === lastElement || !dialogRef.current.contains(activeElement))) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0d1726]/45 pt-12" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEarlyConfirm ? "이른 미용 시작 확인" : isCompletion ? "미용 완료 방법 선택" : "미용 시작 방법 선택"}
        tabIndex={-1}
        className="w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#fbfcfe] shadow-[0_-18px_48px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d6deea]" />
        <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
          <h2 className="min-w-0 pt-2 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#14213a] [overflow-wrap:anywhere]">
            {title}
          </h2>
          <button
            ref={initialFocusRef}
            type="button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-[#526276] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {isEarlyConfirm ? (
          <div className="grid grid-cols-2 gap-2 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-[52px] rounded-[14px] border border-[#d7e0eb] bg-white px-3 text-[16px] font-medium leading-6 text-[#526276] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              아니요
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmEarly}
              className="h-[52px] rounded-[14px] bg-[#286bd1] px-3 text-[16px] font-medium leading-6 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-55"
            >
              예, 시작할게요
            </button>
          </div>
        ) : (
          <div className="space-y-2 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <button
              type="button"
              disabled={busy}
              onClick={onPhotoAction}
              className="h-[52px] w-full rounded-[14px] px-4 text-[16px] font-medium leading-6 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-55"
              style={{ backgroundColor: actionColor }}
            >
              {isCompletion ? "촬영 후 완료" : "촬영 후 시작"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDirectAction}
              className="h-[52px] w-full rounded-[14px] border bg-white px-4 text-[16px] font-medium leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-55"
              style={{ borderColor: actionColor, color: actionColor }}
            >
              {isCompletion ? "바로 완료" : "바로 시작"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
