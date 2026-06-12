"use client";

import type React from "react";
import { Info, X } from "lucide-react";
import { useState } from "react";

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
  const buttonSizeClassName = "h-5 w-5";
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
      popoverClassName="w-[208px] rounded-[11px] text-[11px] leading-[18px]"
    >
      직접 승인은 예약마다 승인 여부를 선택해요. 바로 승인은 고객 예약이 자동 확정돼요.
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
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex max-h-[92vh] min-h-0 w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-white px-4 pb-5 pt-4 shadow-[0_-18px_44px_rgba(15,23,42,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#cbd5e1]" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[18px] font-semibold leading-6 tracking-[-0.02em] text-[var(--text)]">{title}</h3>
          <div className="flex items-center gap-3">
            {headerAction}
            <button
              type="button"
              aria-label="닫기"
              className="inline-flex size-8 items-center justify-center rounded-full border border-[rgba(47,49,46,0.12)] bg-white text-[var(--muted)] transition hover:bg-[#fcfaf7]"
              onClick={onClose}
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[13px] text-[var(--text)]">
      <span className="mb-1.5 block text-[11px] font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</span>
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
      ? "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]"
      : variant === "secondary"
        ? "border border-[var(--border)] bg-white text-[var(--text)]"
        : variant === "highlight"
          ? "border border-[#d7e7e1] bg-[var(--accent-soft)] text-[var(--accent)]"
          : variant === "warm"
            ? "border border-[#c99273] bg-[#c99273] text-white shadow-[0_8px_18px_rgba(201,146,115,0.15)]"
            : variant === "accentSoft"
              ? "border border-[#d7e7e1] bg-[#2f7866] text-white shadow-[0_8px_18px_rgba(47,120,102,0.14)]"
              : variant === "ready"
                ? "border border-[#cf9b8d] bg-[#cf9b8d] text-white shadow-[0_8px_18px_rgba(207,155,141,0.16)]"
                : variant === "complete"
                  ? "border border-[#2a8a72] bg-[#2a8a72] text-white shadow-[0_10px_20px_rgba(42,138,114,0.18)]"
                  : "border border-[var(--border)] bg-white text-[var(--muted)]";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[46px] w-full items-center justify-center rounded-[12px] px-4 text-[14px] font-semibold tracking-[-0.01em] transition hover:bg-opacity-95 disabled:opacity-50 ${variantClassName} ${className}`.trim()}
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
