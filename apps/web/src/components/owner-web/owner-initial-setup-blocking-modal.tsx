"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BLOCKING_ACTION_SELECTOR = "[data-owner-setup-blocking-action]";

export default function OwnerInitialSetupBlockingModal({
  open,
  onResume,
}: {
  open: boolean;
  onResume: () => void;
  onFeedback: () => void;
  onHelp: () => void;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPortalTarget(document.body));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open || !portalTarget) return;

    const focusFrame = window.requestAnimationFrame(() => primaryActionRef.current?.focus());
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const actions = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(BLOCKING_ACTION_SELECTOR),
      ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (actions.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = actions[0];
      const last = actions[actions.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open, portalTarget]);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100]" data-testid="owner-initial-setup-blocking-layer">
      <div
        className="pointer-events-auto absolute inset-0 bg-[#0f172a]/35"
        data-testid="owner-initial-setup-blocking-backdrop"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-initial-setup-blocking-title"
          tabIndex={-1}
          className="pointer-events-auto w-full max-w-[440px] rounded-[18px] border border-[#e8edf3] bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.20)] outline-none sm:p-6"
          data-testid="owner-initial-setup-blocking-dialog"
        >
          <p className="inline-flex rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1 text-[12px] font-medium leading-[18px] text-[#b91c1c]">
            중요
          </p>
          <h2
            id="owner-initial-setup-blocking-title"
            className="mt-3 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#15213b] [overflow-wrap:anywhere] [word-break:keep-all]"
          >
            매장 준비를 먼저 완료해 주세요
          </h2>

          <button
            ref={primaryActionRef}
            type="button"
            onClick={onResume}
            data-owner-setup-blocking-action
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 text-white transition hover:bg-[#1d2942] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            초기 설정 이어하기
          </button>

        </div>
      </div>
    </div>,
    portalTarget,
  );
}
