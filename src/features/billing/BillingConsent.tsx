"use client";

import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";

import type { BillingConsentProps } from "./types";

function BillingSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:border-r md:border-[#e7edf3] md:last:border-r-0">
      <p className="min-w-0 whitespace-nowrap text-[13px] font-medium text-[#64748b]">{label}</p>
      <p className="min-w-0 whitespace-nowrap text-right text-[15px] font-medium text-[#0f172a]">{value}</p>
    </div>
  );
}

export function BillingConsent({
  eyebrow = "플랜 결제",
  title = "정기결제 확인",
  planLabel,
  billingCycleLabel,
  nextBillingDateLabel,
  consentLines,
  checkboxLabel = "정기결제 안내와 결제 조건을 확인했습니다.",
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
    <div className="owner-font min-h-full bg-[#f5f8fb] px-4 py-8 text-[#0f172a] lg:px-8 lg:py-10">
      <section className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
        <header className="border-b border-[#e7edf3] px-6 py-5 lg:px-8">
          <p className="text-[13px] font-medium text-[#2563eb]">{eyebrow}</p>
          <h1 className="mt-1 text-[24px] font-semibold leading-8 text-[#0f172a]">{title}</h1>
          <p className="mt-2 text-[14px] leading-5 text-[#64748b]">선택한 요금제와 결제 조건을 확인한 뒤 계속해 주세요.</p>
        </header>

        <div className="px-6 py-6 lg:px-8">
          <section className="grid overflow-hidden divide-y divide-[#e7edf3] rounded-[8px] border border-[#dbe2ea] bg-[#fbfdff] md:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(230px,1.1fr)] md:divide-x md:divide-y-0">
            <BillingSummaryItem label="선택 플랜" value={planLabel} />
            <BillingSummaryItem label="결제 주기" value={billingCycleLabel} />
            <BillingSummaryItem label="다음 결제 예정일" value={nextBillingDateLabel} />
          </section>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <h2 className="text-[15px] font-medium text-[#334155]">결제 안내</h2>
              <ul className="mt-3 space-y-2 text-[14px] leading-5 text-[#475569]">
                {consentLines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#94a3b8]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
              <ShieldCheck className="h-5 w-5 text-[#2563eb]" />
              <p className="mt-3 text-[14px] font-medium text-[#334155]">안전한 카드 등록</p>
              <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                넘친Day 펫매니저는 넘친 Day가 운영합니다. 카드 정보는 KCP와 포트원을 통해 처리되며, 넘친 Day는 카드번호 전체를 저장하지 않습니다.
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[#64748b]">
                카드 명세서와 결제대행 과정에는 운영사명인 넘친 Day로 표시될 수 있습니다.
              </p>
            </aside>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => onAgreeChange(event.target.checked)}
              className="h-4 w-4 rounded border-[#94a3b8] text-[#2563eb] focus:ring-[#93c5fd]"
            />
            <span className="text-[14px] font-medium text-[#334155]">{checkboxLabel}</span>
          </label>

          {message ? (
            <p className="mt-4 rounded-[8px] border border-[#f1d3a6] bg-[#fff9ef] px-3 py-2.5 text-[14px] leading-5 text-[#9a5b13]">
              {message}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] bg-[#fbfdff] px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[14px] font-medium text-[#475569] transition hover:bg-[#eef2f7]"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
          ) : <span />}
          <button
            ref={continueButtonRef}
            type="button"
            disabled={loading || !agreed}
            onClick={onContinue}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-5 text-[14px] font-medium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
          >
            <CreditCard className="h-4 w-4" />
            {continueLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default BillingConsent;
