"use client";

import { AppButton } from "@/components/ui/app-button";
import { PUBLIC_LEGAL_URLS } from "@/lib/legal/public-legal-links";

import type { BillingConsentProps } from "./types";

function BillingSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <p className="text-[13px] text-[#637890]">{label}</p>
      <p className="text-right text-[14px] font-semibold tracking-[-0.02em] text-[#20344c]">{value}</p>
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
    <div className="owner-font mx-auto w-full max-w-[430px] break-keep bg-[#f4f8fc] px-4 pb-6 pt-4 text-[#14213a]">
      <section className="rounded-[20px] border border-[#d7e4f2] bg-white px-4 pb-4 pt-4">
        <p className="text-[12px] font-semibold tracking-[-0.02em] text-[#2868b4]">{eyebrow}</p>
        <h1 className="mt-1 text-[24px] font-semibold leading-[1.15] tracking-[-0.05em] text-[#14213a]">{title}</h1>

        <div className="mt-3 rounded-[14px] border border-[#d7e4f2] bg-white px-3.5 py-2">
          <BillingSummaryRow label="선택 플랜" value={planLabel} />
          <div className="border-t border-[#e1ebf5]" />
          <BillingSummaryRow label="결제 주기" value={billingCycleLabel} />
          <div className="border-t border-[#e1ebf5]" />
          <BillingSummaryRow label="다음 결제 예정일" value={nextBillingDateLabel} />
        </div>

        <div className="mt-2.5 rounded-[14px] border border-[#d7e4f2] bg-white px-3.5 py-3">
          <div className="space-y-1.5 text-[14px] leading-[1.42] tracking-[-0.02em] text-[#526b84]">
            {consentLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-3 rounded-[11px] border border-[#cfe0f2] bg-[#f8fbfe] px-3 py-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => onAgreeChange(event.target.checked)}
              className="h-[18px] w-[18px] rounded border-[#b7cde5] text-[#2868b4] focus:ring-[#2868b4]"
            />
            <span className="relative -top-[1px] text-[16px] tracking-[-0.02em] text-[#20344c]">{checkboxLabel}</span>
          </label>
        </div>

        <div className="mt-3 grid gap-2">
          <AppButton
            ref={continueButtonRef}
            fullWidth
            disabled={loading || !agreed}
            className="h-[46px] rounded-[12px] bg-[#2868b4] text-[16px] font-semibold tracking-[-0.03em] text-white disabled:bg-[#b8cce3] disabled:text-white disabled:opacity-100"
            onClick={onContinue}
          >
            {continueLabel}
          </AppButton>

          {onBack ? (
            <AppButton
              fullWidth
              variant="secondary"
              className="h-[46px] rounded-[12px] border-[#d7e4f2] bg-white text-[16px] font-medium tracking-[-0.02em] text-[#20344c]"
              onClick={onBack}
            >
              {backLabel}
            </AppButton>
          ) : null}
        </div>

        {message ? (
          <p className="mt-3 rounded-[12px] border border-[#d7e4f2] bg-white px-3.5 py-2.5 text-[14px] leading-[1.5] text-[#526b84]">
            {message}
          </p>
        ) : null}

        <div className="mt-3 text-center">
          <a href={PUBLIC_LEGAL_URLS.refund} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[13px] font-medium text-[#526b84] underline underline-offset-4">
            환불 및 이용 안내
          </a>
        </div>
      </section>
    </div>
  );
}

export default BillingConsent;
