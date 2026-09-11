"use client";

import {
  OWNER_PLAN_SHARED_USE_NOTICE,
  OWNER_PLAN_SINGLE_SHOP_NOTICE,
  type OwnerPlan,
  type OwnerPlanCode,
} from "@/lib/billing/owner-plans";
import { PUBLIC_LEGAL_URLS } from "@/lib/legal/public-legal-links";
import { won } from "@/lib/utils";

function getPlanBillingLabel(plan: OwnerPlan) {
  return plan.billingType === "one_time" ? "일반 결제" : "월 정기결제";
}

type OwnerBillingPlanPickerProps = {
  plans: OwnerPlan[];
  selectedPlanCode: OwnerPlanCode;
  onSelectPlanCode: (code: OwnerPlanCode) => void;
  onContinue: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
};

export function OwnerBillingPlanPicker({
  plans,
  selectedPlanCode,
  onSelectPlanCode,
  onContinue,
  onBack,
  loading,
  message,
}: OwnerBillingPlanPickerProps) {
  const selectedPlan = plans.find((plan) => plan.code === selectedPlanCode) ?? plans[0];

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] break-keep bg-[#f4f8fc] px-4 pb-6 pt-4 text-[#14213a]">
      <section className="rounded-[20px] border border-[#d7e4f2] bg-white px-4 pb-4 pt-4">
        <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#2868b4]">플랜 선택</p>
        <h1 className="mt-1.5 text-[20px] font-semibold leading-[1.28] tracking-[0] text-[#14213a] max-[359px]:text-[20px]">
          <span className="block whitespace-nowrap">매장 운영 인원에 맞는</span>
          <span className="block whitespace-nowrap">플랜을 선택해 주세요</span>
        </h1>

        <div className="mt-4 rounded-[15px] bg-[#eaf3ff] p-1">
          <div className="grid grid-cols-3 gap-1.5">
            {plans.map((plan) => {
              const selected = selectedPlan.code === plan.code;

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => onSelectPlanCode(plan.code)}
                  className={`relative min-h-11 min-w-0 rounded-[11px] px-2 py-2.5 text-center transition ${
                    selected ? "bg-white ring-1 ring-[#bcd6f3] shadow-[0_4px_12px_rgba(63,127,198,0.12)]" : "text-[#526b84]"
                  }`}
                >
                  {plan.featured ? (
                    <span className="absolute -top-2 right-2 rounded-full bg-[#2868b4] px-2 py-[3px] text-[12px] font-semibold leading-none text-white">
                      추천
                    </span>
                  ) : null}
                  <p className={`text-[13px] leading-tight tracking-[-0.02em] ${selected ? "font-semibold text-[#2868b4]" : "font-medium"}`}>
                    {plan.shortTitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-[17px] border border-[#cfe0f2] bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium tracking-[-0.02em] text-[#526b84]">
                {getPlanBillingLabel(selectedPlan)}
              </p>
              <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.04em] text-[#14213a]">
                {selectedPlan.title}
              </p>
              <p className="mt-2.5 text-[20px] font-semibold leading-none tracking-[-0.04em] text-[#14213a]">
                {won(selectedPlan.monthlyPrice)}
                <span className="ml-1.5 text-[16px] font-normal tracking-[-0.02em] text-[#526b84]">/ 월</span>
              </p>
              <p className="mt-2.5 text-[14px] leading-[1.45] tracking-[-0.02em] text-[#526b84]">
                {selectedPlan.description}
              </p>
            </div>

            {selectedPlan.badge ? (
              <div className="inline-flex h-[32px] shrink-0 items-center rounded-[10px] bg-[#eaf3ff] px-2.5 text-[#2868b4]">
                <p className="whitespace-nowrap text-[13px] font-semibold leading-none tracking-[-0.02em]">{selectedPlan.badge}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-1.5">
            {selectedPlan.highlights.map((highlight) => (
              <div key={highlight} className="rounded-[11px] bg-[#f4f8fc] px-3 py-1.5 text-[13px] leading-5 text-[#526b84]">
                {highlight}
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[#e1ebf5] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[16px] font-normal tracking-[-0.02em] text-[#637890]">월 요금</p>
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-[#20344c]">{won(selectedPlan.monthlyPrice)}</p>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <p className="text-[16px] font-normal tracking-[-0.02em] text-[#637890]">알림톡 포함</p>
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-[#20344c]">{selectedPlan.alimtalkIncludedLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[14px] border border-[#d7e4f2] bg-[#f4f8fc] px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-[#365b83]">단일 매장 기준 안내</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-[#526b84]">{OWNER_PLAN_SINGLE_SHOP_NOTICE}</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-[#526b84]">{OWNER_PLAN_SHARED_USE_NOTICE}</p>
        </div>

        <div className="mt-4 grid gap-1.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-[#2868b4] px-4 text-[16px] font-semibold tracking-[-0.03em] text-white disabled:opacity-60"
          >
            {loading ? "결제 진행 중..." : `${selectedPlan.shortTitle} 플랜으로 시작하기`}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex min-h-11 w-full items-center justify-center text-[14px] font-medium tracking-[-0.005em] text-[#526b84]"
          >
            이전으로 돌아가기
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-[14px] border border-[#d7e4f2] bg-white px-4 py-3 text-[14px] leading-[1.55] text-[#526b84]">
            {message}
          </p>
        ) : null}

        <div className="mt-4 text-center">
          <a href={PUBLIC_LEGAL_URLS.refund} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[13px] font-medium text-[#526b84] underline underline-offset-4">
            환불 및 이용 안내
          </a>
        </div>
      </section>
    </div>
  );
}
