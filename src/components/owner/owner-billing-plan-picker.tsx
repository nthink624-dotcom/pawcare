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
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] break-keep bg-[#f8f6f2] px-5 pb-10 pt-7 text-[#171411]">
      <section className="rounded-[24px] border border-[#e1dacd] bg-[#fffdf8] px-5 pb-6 pt-5 shadow-[0_10px_30px_rgba(41,41,38,0.04)]">
        <p className="text-[13px] font-medium tracking-[-0.02em] text-[#1f5b51]">플랜 선택</p>
        <h1 className="mt-2 text-[24px] font-semibold leading-[1.3] tracking-[0] text-[#171411] max-[359px]:text-[21px]">
          <span className="block whitespace-nowrap">매장 운영 인원에 맞는</span>
          <span className="block whitespace-nowrap">플랜을 선택해 주세요</span>
        </h1>

        <div className="mt-5 rounded-[18px] bg-[#f1ede6] p-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {plans.map((plan) => {
              const selected = selectedPlan.code === plan.code;

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => onSelectPlanCode(plan.code)}
                  className={`relative min-w-0 rounded-[12px] px-2 py-3 text-center transition ${
                    selected ? "bg-white shadow-[0_6px_16px_rgba(32,31,27,0.12)]" : "text-[#7d756b]"
                  }`}
                >
                  {plan.featured ? (
                    <span className="absolute -top-2 right-2 rounded-full bg-[#1f5b51] px-2 py-[3px] text-[10px] font-medium leading-none text-white">
                      추천
                    </span>
                  ) : null}
                  <p className={`text-[12.5px] leading-tight tracking-[-0.02em] ${selected ? "font-semibold text-[#171411]" : "font-medium"}`}>
                    {plan.shortTitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-[20px] border border-[#ded7cb] bg-white px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium tracking-[-0.02em] text-[#8b8278]">
                {getPlanBillingLabel(selectedPlan)}
              </p>
              <p className="mt-2 text-[25px] font-semibold leading-none tracking-[-0.04em] text-[#171411]">
                {selectedPlan.title}
              </p>
              <p className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.04em] text-[#171411]">
                {won(selectedPlan.monthlyPrice)}
                <span className="ml-1.5 text-[15px] font-normal tracking-[-0.02em] text-[#5e5750]">/ 월</span>
              </p>
              <p className="mt-3 text-[14px] leading-[1.55] tracking-[-0.02em] text-[#4f4942]">
                {selectedPlan.description}
              </p>
            </div>

            {selectedPlan.badge ? (
              <div className="inline-flex h-[32px] shrink-0 items-center rounded-[10px] bg-[#eef7f4] px-2.5 text-[#1f5b51]">
                <p className="whitespace-nowrap text-[13px] font-semibold leading-none tracking-[-0.02em]">{selectedPlan.badge}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2">
            {selectedPlan.highlights.map((highlight) => (
              <div key={highlight} className="rounded-[12px] bg-[#f8f5ef] px-3 py-2 text-[13px] leading-5 text-[#5f574f]">
                {highlight}
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[#ece6dc] pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-normal tracking-[-0.02em] text-[#6a645d]">월 요금</p>
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">{won(selectedPlan.monthlyPrice)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[15px] font-normal tracking-[-0.02em] text-[#6a645d]">알림톡 포함</p>
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">{selectedPlan.alimtalkIncludedLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#e1dacd] bg-[#fbf8f3] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#504941]">단일 매장 기준 안내</p>
          <p className="mt-1.5 text-[12.5px] leading-5 text-[#6a645d]">{OWNER_PLAN_SINGLE_SHOP_NOTICE}</p>
          <p className="mt-1.5 text-[12.5px] leading-5 text-[#6a645d]">{OWNER_PLAN_SHARED_USE_NOTICE}</p>
        </div>

        <div className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-[#1f5b51] px-4 text-[15px] font-semibold tracking-[-0.03em] text-white disabled:opacity-60"
          >
            {loading ? "결제 진행 중..." : `${selectedPlan.shortTitle} 플랜으로 시작하기`}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex h-[36px] w-full items-center justify-center text-[14px] font-normal tracking-[-0.02em] text-[#8a8177]"
          >
            이전으로 돌아가기
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-[14px] border border-[#d8d1c5] bg-white px-4 py-3 text-[14px] leading-[1.55] text-[#4a4640]">
            {message}
          </p>
        ) : null}

        <div className="mt-4 text-center">
          <a href={PUBLIC_LEGAL_URLS.refund} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-[#6f675d] underline underline-offset-4">
            환불 및 이용 안내
          </a>
        </div>
      </section>
    </div>
  );
}
