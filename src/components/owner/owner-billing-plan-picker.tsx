"use client";

import { type OwnerPlan, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { won } from "@/lib/utils";

function getPlanTermLabel(plan: OwnerPlan) {
  if (plan.months === 12) return "1년";
  return `${plan.months}개월`;
}

function getPlanBillingLabel(plan: OwnerPlan) {
  return plan.billingType === "one_time" ? "일반 결제" : "약정 결제";
}

function getPlanDescription(plan: OwnerPlan) {
  switch (plan.code) {
    case "monthly":
      return "부담 없이 다시 시작하기 좋아요.";
    case "quarterly":
      return "재이용 흐름을 천천히 되찾기 좋아요.";
    case "halfyearly":
      return "운영 리듬을 안정적으로 이어가기 좋아요.";
    case "yearly":
      return "가장 낮은 월 요금으로 오래 쓸수록 더 이득이에요.";
    default:
      return "가볍게 시작하고 필요에 맞게 이어갈 수 있어요.";
  }
}

function getPlanSavingsLabel(plan: OwnerPlan, plans: OwnerPlan[]) {
  const monthlyPlan = plans.find((item) => item.code === "monthly");
  if (!monthlyPlan || plan.months <= 1) return null;

  const savings = monthlyPlan.totalPrice * plan.months - plan.totalPrice;
  if (savings <= 0) return null;

  return `1개월 대비 ${won(savings)} 절약`;
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
  const selectedPlanTerm = getPlanTermLabel(selectedPlan);
  const selectedPlanSavings = getPlanSavingsLabel(selectedPlan, plans);

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-7 text-[#171411]">
      <section className="rounded-[24px] border border-[#e1dacd] bg-[#fffdf8] px-5 pb-6 pt-5 shadow-[0_10px_30px_rgba(41,41,38,0.04)]">
        <p className="text-[13px] font-medium tracking-[-0.02em] text-[#1f5b51]">플랜 선택</p>
        <h1 className="mt-2 whitespace-nowrap text-[29px] font-semibold leading-none tracking-[-0.05em] text-[#171411]">
          플랜을 선택해 주세요
        </h1>

        <div className="mt-5 rounded-[18px] bg-[#f1ede6] p-1.5">
          <div className="grid grid-cols-4 gap-1.5">
            {plans.map((plan) => {
              const selected = selectedPlan.code === plan.code;

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => onSelectPlanCode(plan.code)}
                  className={`relative min-w-0 rounded-[12px] px-2 py-3 text-center transition ${
                    selected
                      ? "bg-white shadow-[0_6px_16px_rgba(32,31,27,0.12)]"
                      : "text-[#7d756b]"
                  }`}
                >
                  {plan.featured ? (
                    <span className="absolute -top-2 right-2 rounded-full bg-[#1f5b51] px-2 py-[3px] text-[10px] font-medium leading-none text-white">
                      추천
                    </span>
                  ) : null}
                  <p
                    className={`text-[13px] leading-none tracking-[-0.02em] ${
                      selected ? "font-medium text-[#171411]" : "font-normal"
                    }`}
                  >
                    {getPlanTermLabel(plan)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-[20px] border border-[#ded7cb] bg-white px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-normal tracking-[-0.02em] text-[#8b8278]">
                {getPlanBillingLabel(selectedPlan)}
              </p>
              <p className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.05em] text-[#171411]">
                {won(selectedPlan.monthlyPrice)}
                <span className="ml-1.5 text-[18px] font-normal tracking-[-0.03em] text-[#5e5750]">/ 월</span>
              </p>
              <p className="mt-3 text-[14px] font-normal tracking-[-0.02em] text-[#8b8278]">
                총 {won(selectedPlan.totalPrice)} 청구
              </p>
              <p
                className={`mt-4 tracking-[-0.02em] text-[#4f4942] ${
                  selectedPlan.code === "yearly" || selectedPlan.code === "halfyearly"
                    ? "whitespace-nowrap text-[12px] leading-none"
                    : "text-[14px] leading-[1.55]"
                }`}
              >
                {getPlanDescription(selectedPlan)}
              </p>
            </div>

            {selectedPlan.discountPercent > 0 ? (
              <div className="inline-flex h-[38px] shrink-0 items-center rounded-[10px] bg-[#eef7f4] px-2.5 text-[#1f5b51]">
                <p className="relative -top-[1px] whitespace-nowrap text-[15px] font-medium leading-none tracking-[-0.03em]">
                  {selectedPlan.discountPercent}% 할인
                </p>
              </div>
            ) : null}
          </div>

          {selectedPlanSavings ? (
            <div className="mt-5 rounded-[12px] bg-[#f3faf7] px-4 py-3">
              <p className="text-[15px] font-normal tracking-[-0.02em] text-[#245e55]">
                <span className="mr-2 text-[#1f7a68]">•</span>
                {selectedPlanSavings}
              </p>
            </div>
          ) : null}

          <div className="mt-6 border-t border-[#ece6dc] pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-normal tracking-[-0.02em] text-[#6a645d]">월 요금</p>
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">{won(selectedPlan.monthlyPrice)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[15px] font-normal tracking-[-0.02em] text-[#6a645d]">총 결제</p>
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171411]">{won(selectedPlan.totalPrice)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-[#1f5b51] px-4 text-[15px] font-semibold tracking-[-0.03em] text-white disabled:opacity-60"
          >
            {loading ? "결제 진행 중..." : `${selectedPlanTerm} 플랜으로 시작하기`}
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
      </section>
    </div>
  );
}
