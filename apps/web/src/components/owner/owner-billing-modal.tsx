"use client";

import { X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

export function OwnerBillingModal({
  labelledBy,
  closeLabel,
  onClose,
  children,
  maxWidthClassName = "max-w-[1040px]",
  dismissible = true,
  returnFocusRef,
}: {
  labelledBy: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  dismissible?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      lastFocusedRef.current = document.activeElement;
    }
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    closeButtonRef.current?.focus();
  }, [labelledBy, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 10);

    function handleKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
      if (openDialogs.at(-1) !== dialog) return;

      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(dialog);
      if (!focusable.length) return;
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      const focusTarget = returnFocusRef?.current ?? lastFocusedRef.current;
      window.requestAnimationFrame(() => focusTarget?.focus());
    };
  }, [dismissible, mounted, returnFocusRef]);

  if (!mounted) return null;

  return createPortal(
    <div className="pm-owner-web fixed inset-0 z-[60] flex items-center justify-center px-3 py-4 sm:px-5 sm:py-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#0f172a]/45 backdrop-blur-[2px]"
        onClick={() => {
          if (dismissible) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "relative z-[1] max-h-[calc(100dvh-32px)] w-full overflow-hidden rounded-[14px] border border-[#dbe2ea] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-48px)]",
          maxWidthClassName,
        )}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          disabled={!dismissible}
          className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe2ea] bg-white text-[#64748b] shadow-sm transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:right-4 sm:top-4"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div ref={scrollContainerRef} className="max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-48px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
