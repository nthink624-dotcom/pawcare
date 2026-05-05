"use client";

import { CreditCard, Plus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AppButton } from "@/components/ui/app-button";

import type { PaymentMethodOption, PaymentMethodSheetProps } from "./types";

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

function PaymentOptionIcon({
  id,
  selected,
}: {
  id: PaymentMethodOption["id"];
  selected: boolean;
}) {
  if (id === "saved") {
    return <CreditCard className={`h-[18px] w-[18px] ${selected ? "text-[#1f6b5b]" : "text-[#736c63]"}`} strokeWidth={1.9} />;
  }

  return <Plus className={`h-[18px] w-[18px] ${selected ? "text-[#1f6b5b]" : "text-[#736c63]"}`} strokeWidth={2.1} />;
}

function PaymentOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: PaymentMethodOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={option.disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-[14px] border px-[14px] py-[13px] text-left transition ${
        selected ? "border-[#1f6b5b] bg-[#eef7f3]" : "border-[#e5ddd1] bg-white"
      } ${option.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[#fbf8f3]"}`}
    >
      <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center">
        <PaymentOptionIcon id={option.id} selected={selected} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] tracking-[-0.02em] text-[#171411]">{option.title}</p>
        <p className="mt-1 text-[12.5px] leading-[1.45] text-[#6b6a64]">{option.description}</p>
      </div>

      <span
        className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          selected ? "border-[#1f6b5b]" : "border-[#c9c4bc]"
        }`}
      >
        <span className={`h-[8px] w-[8px] rounded-full ${selected ? "bg-[#1f6b5b]" : "bg-transparent"}`} />
      </span>
    </button>
  );
}

export function PaymentMethodSheet({
  open,
  eyebrow = "PAYMENT",
  title = "결제수단 선택",
  description = "등록된 카드로 바로 결제하거나, 새 카드를 등록해 계속 이용할 수 있어요.",
  closeLabel = "닫기",
  planLabel,
  amountLabel,
  nextBillingDateLabel,
  options,
  selectedOption,
  loading = false,
  continueLabel,
  returnFocusRef,
  onSelectOption,
  onClose,
  onContinue,
}: PaymentMethodSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(open);

  const selected = useMemo(
    () => options.find((option) => option.id === selectedOption) ?? options[0] ?? null,
    [options, selectedOption],
  );

  useEffect(() => {
    if (open) {
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        lastFocusedRef.current = document.activeElement;
      }
      setMounted(true);
      requestAnimationFrame(() => setActive(true));
      return;
    }

    setActive(false);
    const timer = window.setTimeout(() => setMounted(false), 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !mounted || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || !open) return;

    const container = sheetRef.current;
    if (!container) return;

    const timer = window.setTimeout(() => {
      const [firstFocusable] = getFocusableElements(container);
      (firstFocusable ?? closeButtonRef.current ?? container).focus();
    }, 10);

    function handleKeyDown(event: KeyboardEvent) {
      const activeContainer = sheetRef.current;
      if (!activeContainer) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(activeContainer);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose, open]);

  useEffect(() => {
    if (mounted) return;
    const focusTarget = returnFocusRef?.current ?? lastFocusedRef.current;
    focusTarget?.focus();
  }, [mounted, returnFocusRef]);

  if (!mounted || typeof document === "undefined" || !selected) return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[250ms] ease-out ${active ? "opacity-40" : "opacity-0"}`}
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`pointer-events-auto w-full max-w-[430px] rounded-t-[26px] bg-white px-4 pb-4 pt-3 shadow-[0_-18px_40px_rgba(31,27,22,0.16)] transition-transform duration-[250ms] ease-out ${
            active ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mt-0.5 h-[4px] w-10 rounded-full bg-[#dfd7cc]" />

          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9b9286]">{eyebrow}</p>
              <h2 id={titleId} className="mt-[5px] text-[18px] font-semibold tracking-[-0.04em] text-[#171411]">
                {title}
              </h2>
              <p className="mt-2 text-[13px] leading-[1.55] text-[#6b6a64]">{description}</p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border border-[#e5ddd1] bg-white text-[#726b63]"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>
          </div>

          <div className="mt-4 rounded-[16px] border border-[#e5ddd1] bg-[#fcfaf6] px-[14px] py-[12px]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] text-[#9b9286]">선택 플랜</p>
                <p className="mt-1 text-[14px] tracking-[-0.02em] text-[#171411]">{planLabel}</p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-[#171411]">{amountLabel}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[12px] text-[#9b9286]">다음 결제 예정일</p>
                <p className="mt-1 text-[14px] tracking-[-0.02em] text-[#171411]">{nextBillingDateLabel}</p>
              </div>
            </div>
          </div>

          <div role="radiogroup" className="mt-3 space-y-2">
            {options.map((option) => (
              <PaymentOptionCard
                key={option.id}
                option={option}
                selected={selected.id === option.id}
                onSelect={() => {
                  if (!option.disabled) {
                    onSelectOption(option.id);
                  }
                }}
              />
            ))}
          </div>

          <div className="mt-4">
            <AppButton
              fullWidth
              disabled={loading}
              className="h-[54px] rounded-[14px] bg-[#1f6b5b] text-[15px] font-semibold tracking-[-0.02em] text-white"
              onClick={onContinue}
            >
              {continueLabel}
            </AppButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default PaymentMethodSheet;
