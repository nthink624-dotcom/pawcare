"use client";

import { type OwnerPlan, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { won } from "@/lib/utils";

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

  if (!selectedPlan) {
    return null;
  }

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-10 pt-7 text-[#111827]">
      <section className="rounded-[22px] border border-[#dbe2ea] bg-white px-5 pb-6 pt-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
        <p className="text-[13px] font-medium text-[#1f6b5b]">요금제 선택</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#111827]">
          매장 규모에 맞는 요금제를 선택해 주세요
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[#64748b]">
          예약 건수와 사진 수는 제한하지 않고, 직원 수와 알림톡 포함량을 기준으로 나눴습니다.
        </p>

        <div className="mt-5 space-y-3">
          {plans.map((plan) => {
            const selected = selectedPlan.code === plan.code;

            return (
              <button
                key={plan.code}
                type="button"
                onClick={() => onSelectPlanCode(plan.code)}
                className={`w-full rounded-[16px] border px-4 py-4 text-left transition ${
                  selected
                    ? "border-[#1f6b5b] bg-white shadow-[0_10px_24px_rgba(31,107,91,0.10)]"
                    : "border-[#dbe2ea] bg-white hover:border-[#b8c5d4]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[20px] font-semibold tracking-[-0.03em] text-[#111827]">{plan.title}</p>
                      {plan.badge ? (
                        <span className="rounded-full bg-[#eef7f4] px-2 py-1 text-[11px] font-medium text-[#1f6b5b]">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] leading-5 text-[#64748b]">{plan.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">{won(plan.monthlyPrice)}</p>
                    <p className="mt-1 text-[12px] text-[#64748b]">월 정기결제</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-[13px] text-[#334155]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#64748b]">직원</span>
                    <span>{plan.staffLimitLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#64748b]">알림톡</span>
                    <span>{plan.alimtalkIncludedLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#64748b]">초과</span>
                    <span>{plan.excessAlimtalkLabel}</span>
                  </div>
                </div>

                {plan.highlights.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {plan.highlights.map((highlight) => (
                      <span key={highlight} className="rounded-full border border-[#dbe2ea] px-2.5 py-1 text-[12px] text-[#475569]">
                        {highlight}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="flex h-[50px] w-full items-center justify-center rounded-[12px] bg-[#1f6b5b] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {loading ? "결제 진행 중..." : `${selectedPlan.title}로 시작하기`}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex h-[38px] w-full items-center justify-center text-[14px] font-normal text-[#64748b]"
          >
            이전으로 돌아가기
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-[12px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3 text-[14px] leading-[1.55] text-[#334155]">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
