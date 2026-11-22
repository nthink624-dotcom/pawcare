"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconX as X } from "@tabler/icons-react";
import SetupModal from "@/components/ui/setup-modal";
import type { SetupStep } from "@/lib/owner-initial-setup-flow";
import styles from "./initial-setup-layout.module.css";

export function SetupStepNavigation({ onPrevious, onNext, busy = false, nextDisabled = false, nextLabel = "다음", priceReview = false }: {
  onPrevious?: () => void;
  onNext: () => void;
  busy?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  priceReview?: boolean;
}) {
  return <footer data-setup-navigation data-price-guide-review-footer={priceReview || undefined} className="border-t border-[#e5e7eb] px-[21px] py-[14px]">
    <div className={`grid gap-2 ${onPrevious ? "grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]" : "grid-cols-1"}`}>
      {onPrevious && <button data-setup-previous type="button" disabled={busy} onClick={onPrevious} className="inline-flex min-h-[50px] min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-[#dbe2ea] bg-white px-2 text-[16px] font-normal leading-6 text-[#526b84] outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-default disabled:border-[#edf0f4] disabled:bg-[#f8fafc] disabled:text-[#b5bdc8]">
        <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />이전
      </button>}
      <button data-setup-next type="button" disabled={busy || nextDisabled} onClick={onNext} className="inline-flex min-h-[50px] min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] bg-[#111a30] px-2 text-[16px] font-normal leading-6 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-default disabled:opacity-50">
        {nextLabel}<ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
      </button>
    </div>
  </footer>;
}

export default function OwnerInitialSetupFrame({ step, children, footer, footerRef, navigationDisabled = false, onClose }: {
  step: SetupStep;
  children: ReactNode;
  footer?: ReactNode;
  footerRef?: (element: HTMLDivElement | null) => void;
  navigationDisabled?: boolean;
  onClose: () => void;
}) {
  const title = { hours: "영업시간 설정", staff: "담당자 등록", pricing: "요금표 등록", complete: "초기 설정을 완료했어요" }[step];
  const stepNumber = { hours: 1, staff: 2, pricing: 3, complete: 3 }[step];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  return <SetupModal contained reference label={`매장 초기 설정 · ${title}`} onCancel={onClose}>
    <div className={`${styles.referenceFrame} flex max-h-[inherit] min-h-0 flex-col bg-white`} data-owner-setup-frame>
      <div data-setup-header className="shrink-0 bg-white px-[21px] pt-2 max-[359px]:px-4 max-[319px]:px-3">
        <div className="flex min-h-11 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 ref={headingRef} tabIndex={-1} data-setup-heading className="min-w-0 break-keep text-[20px] font-semibold leading-7 tracking-[-0.3px] text-[#15213b] outline-none">{title}</h1>
            {step !== "complete" && <span data-setup-progress aria-label={`총 3단계 중 ${stepNumber}단계`} className="shrink-0 text-[14px] font-normal leading-5 tabular-nums text-[#64748b]">{stepNumber}/3</span>}
          </div>
          <button type="button" data-setup-close aria-label="설정 닫기" disabled={navigationDisabled} onClick={onClose} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] outline-none hover:bg-[#f1f5f9] focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40"><X aria-hidden="true" size={18} /></button>
        </div>
      </div>
      <div ref={bodyRef} className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${step === "pricing" ? "p-0" : "px-[21px] pb-1 max-[359px]:px-4 max-[319px]:px-3"}`} data-owner-setup-body data-setup-content={step}>{children}</div>
      <div ref={footerRef} className="shrink-0 bg-white empty:hidden" data-owner-setup-actions>{footer}</div>
    </div>
  </SetupModal>;
}
