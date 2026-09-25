"use client";

import type React from "react";
import { Info, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { SectionHeader as AppSectionHeader } from "@/components/ui/section-header";
import { Switch } from "@/components/ui/switch";

export function Panel({
  title,
  action,
  titleAccessory,
  children,
  titleClassName = "",
  titleTextClassName = "",
  className = "",
  contentClassName = "",
}: {
  title: string;
  action?: React.ReactNode;
  titleAccessory?: React.ReactNode;
  children: React.ReactNode;
  titleClassName?: string;
  titleTextClassName?: string;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={`rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-soft)] ${className}`.trim()}>
      <AppSectionHeader title={title} titleAccessory={titleAccessory} action={action} className={`mb-3 ${titleClassName}`.trim()} titleClassName={titleTextClassName} />
      <div className={`space-y-2.5 ${contentClassName}`.trim()}>{children}</div>
    </section>
  );
}

export function InfoTip({
  ariaLabel,
  children,
  tone = "neutral",
  size = "default",
  className = "",
  popoverClassName = "",
}: {
  ariaLabel: string;
  children: React.ReactNode;
  tone?: "neutral" | "warm";
  size?: "default" | "small";
  className?: string;
  popoverClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const iconSizeClassName = "h-4 w-4";
  const buttonSizeClassName = "absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2";
  const colorClassName =
    tone === "warm"
      ? "text-[#9b806f] hover:text-[#c99273]"
      : "text-[#8f877d] hover:text-[var(--accent)]";
  const popoverColorClassName =
    tone === "warm"
      ? "border-[#ead9cf] text-[#725f53] shadow-[0_10px_24px_rgba(64,45,32,0.12)]"
      : "border-[#e2d8ce] text-[#6a6259] shadow-[0_12px_28px_rgba(35,35,31,0.12)]";

  return (
    <span className="relative inline-flex h-5 w-5 items-center justify-center align-middle">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        className={`inline-flex ${buttonSizeClassName} items-center justify-center bg-transparent p-0 leading-none transition ${colorClassName}`.trim()}
      >
        <Info className={`block ${iconSizeClassName}`} strokeWidth={2} />
      </button>
      {open ? (
        <span className={`absolute left-0 top-[22px] z-30 w-[218px] rounded-[12px] border bg-white px-3 py-2 text-left text-[12px] font-medium leading-5 tracking-[-0.01em] ${popoverColorClassName} ${popoverClassName}`.trim()}>
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function SwipeCancelInfoButton() {
  return (
    <InfoTip ariaLabel="예약 취소 안내" className="relative top-[3px]">
      예약 카드를 왼쪽으로 밀면 예약 취소가 가능해요.
    </InfoTip>
  );
}

export function ApprovalModeInfoButton() {
  return (
    <InfoTip
      ariaLabel="승인 방식 안내"
      tone="warm"
      size="small"
      popoverClassName="w-[208px] rounded-[11px] text-[12px] leading-[18px]"
    >
      고객 예약은 신청 단계 없이 바로 확정돼요.
    </InfoTip>
  );
}

export function HorizontalDragScroll({ children }: { children: React.ReactNode }) {
  return <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">{children}</div>;
}

export function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 ${disabled ? "opacity-50" : ""}`}>
      <div>
        <p className="text-[14px] font-semibold text-[var(--text)]">{label}</p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} aria-label={label} onCheckedChange={onChange} />
    </label>
  );
}

export function Overlay({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function Sheet({
  title,
  children,
  onClose,
  footer,
  headerAction,
  prominentTitle = false,
  dialogLabel,
  initialFocusRef,
  restoreFocusRef,
  focusKey,
  safeAreaPadding = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  prominentTitle?: boolean;
  dialogLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  focusKey?: string;
  safeAreaPadding?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!initialFocusRef?.current) return;
    const frame = window.requestAnimationFrame(() => initialFocusRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [focusKey, initialFocusRef]);

  useEffect(
    () => () => {
      restoreFocusRef?.current?.focus();
    },
    [restoreFocusRef],
  );

  useEffect(() => {
    if (!dialogLabel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [dialogLabel, onClose]);

  function keepFocusInDialog(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogLabel) return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
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
    <div className="pm-mobile-sheet-scrim fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        ref={dialogRef}
        role={dialogLabel ? "dialog" : undefined}
        aria-modal={dialogLabel ? true : undefined}
        aria-label={dialogLabel}
        onKeyDown={keepFocusInDialog}
        className={`pm-mobile-sheet flex max-h-[92vh] min-h-0 w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-white px-4 pt-4 shadow-[0_-18px_44px_rgba(15,23,42,0.16)] ${safeAreaPadding ? "pb-[calc(env(safe-area-inset-bottom)+20px)]" : "pb-5"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#cbd5e1]" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`${prominentTitle ? "text-[20px] leading-7 tracking-[-0.015em]" : "text-[18px] leading-[26px] tracking-[-0.01em]"} font-semibold text-[var(--text)]`}>{title}</h3>
          <div className="flex items-center gap-3">
            {headerAction}
            <button
              type="button"
              aria-label="닫기"
              className="inline-flex size-11 items-center justify-center rounded-full border border-[rgba(47,49,46,0.12)] bg-white text-[var(--muted)] transition hover:bg-[#fcfaf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
              onClick={onClose}
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[13px] text-[var(--text)]">
      <span className="mb-1.5 block text-[12px] font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export type OwnerActionButtonVariant = "primary" | "secondary" | "ghost" | "highlight" | "warm" | "accentSoft" | "ready" | "complete";

type OwnerActionButtonProps = {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: OwnerActionButtonVariant;
  className?: string;
};

export function ActionButton({ children, disabled, onClick, variant = "primary", className = "" }: OwnerActionButtonProps) {
  const variantClassName =
    variant === "primary"
      ? "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(47,111,216,0.14)]"
      : variant === "secondary"
        ? "border border-[var(--border)] bg-white text-[var(--text)]"
        : variant === "highlight"
          ? "border border-[#d9e5fb] bg-[var(--accent-soft)] text-[var(--accent)]"
          : variant === "warm"
            ? "border border-[#dce4ef] bg-[#f8fafc] text-[#334155]"
            : variant === "accentSoft"
              ? "border border-[#d9e5fb] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(47,111,216,0.14)]"
              : variant === "ready"
                ? "border border-[#dce4ef] bg-[#f8fafc] text-[#334155]"
                : variant === "complete"
                  ? "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(47,111,216,0.14)]"
                  : "border border-[var(--border)] bg-white text-[var(--muted)]";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[46px] w-full items-center justify-center rounded-[12px] px-4 py-2.5 text-[16px] font-medium leading-6 tracking-[-0.005em] transition hover:bg-opacity-95 disabled:opacity-50 ${variantClassName} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  className = "",
  compact = false,
  titleClassName = "",
}: {
  title: string;
  className?: string;
  compact?: boolean;
  titleClassName?: string;
}) {
  if (compact) {
    return (
      <div className={`flex items-center justify-center rounded-[12px] border border-[var(--border)] bg-[#f8fafc] text-center ${className}`.trim()}>
        <p className={`relative top-px text-[14px] font-medium leading-[20px] tracking-[-0.02em] text-[var(--muted)] ${titleClassName}`.trim()}>{title}</p>
      </div>
    );
  }

  return (
    <AppEmptyState
      title={title}
      titleClassName={titleClassName}
      className={`min-h-[64px] rounded-[12px] bg-[#f8fafc] px-3.5 py-4 ${className}`.trim()}
    />
  );
}
