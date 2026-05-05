"use client";

import { AppButton } from "@/components/ui/app-button";

import type { BillingConsentProps } from "./types";

function BillingSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-[13px] text-[#6e665c]">{label}</p>
      <p className="text-right text-[14px] font-medium tracking-[-0.02em] text-[#171411]">{value}</p>
    </div>
  );
}

export function BillingConsent({
  eyebrow = "플랜 이용 안내",
  title = "정기결제 안내",
  planLabel,
  billingCycleLabel,
  nextBillingDateLabel,
  consentLines,
  checkboxLabel = "위 정기결제 안내에 동의합니다.",
  agreed,
  loading = false,
  message = null,
  continueLabel,
  backLabel = "이전 단계로",
  onAgreeChange,
  onContinue,
  onBack,
  continueButtonRef,
}: BillingConsentProps) {
  return (
    <div className="owner-font mx-auto w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-8 pt-6 text-[#171411]">
      <section className="rounded-[22px] border border-[#e1dacd] bg-[#fffdf8] px-4.5 pb-5 pt-4.5 shadow-[0_10px_30px_rgba(41,41,38,0.04)]">
        <p className="text-[12px] font-medium tracking-[-0.02em] text-[#1f6b5b]">{eyebrow}</p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.05em] text-[#171411]">{title}</h1>

        <div className="mt-4 rounded-[16px] border border-[#e4dccf] bg-white px-3.5 py-2.5">
          <BillingSummaryRow label="선택 플랜" value={planLabel} />
          <div className="border-t border-[#efe8dc]" />
          <BillingSummaryRow label="결제 주기" value={billingCycleLabel} />
          <div className="border-t border-[#efe8dc]" />
          <BillingSummaryRow label="다음 결제 예정일" value={nextBillingDateLabel} />
        </div>

        <div className="mt-3 rounded-[16px] border border-[#e4dccf] bg-white px-3.5 py-3.5">
          <div className="space-y-2 text-[14px] leading-[1.45] tracking-[-0.02em] text-[#5f5951]">
            {consentLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <label className="mt-3.5 flex items-center gap-3 rounded-[12px] border border-[#e4dccf] bg-white px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => onAgreeChange(event.target.checked)}
              className="h-[18px] w-[18px] rounded border-[#cdc4b7] text-[#1f6b5b] focus:ring-[#1f6b5b]"
            />
            <span className="relative -top-[1px] text-[15px] tracking-[-0.02em] text-[#171411]">{checkboxLabel}</span>
          </label>
        </div>

        <div className="mt-4 grid gap-2.5">
          <AppButton
            ref={continueButtonRef}
            fullWidth
            disabled={loading || !agreed}
            className="h-[48px] rounded-[12px] bg-[#8fb1a7] text-[15px] font-semibold tracking-[-0.03em] text-white disabled:bg-[#9ebbb2] disabled:text-white"
            onClick={onContinue}
          >
            {continueLabel}
          </AppButton>

          {onBack ? (
            <AppButton
              fullWidth
              variant="secondary"
              className="h-[48px] rounded-[12px] border-[#ddd5c8] bg-white text-[15px] font-medium tracking-[-0.02em] text-[#171411]"
              onClick={onBack}
            >
              {backLabel}
            </AppButton>
          ) : null}
        </div>

        {message ? (
          <p className="mt-3.5 rounded-[12px] border border-[#ddd5c8] bg-white px-3.5 py-2.5 text-[14px] leading-[1.5] text-[#4a4640]">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default BillingConsent;
