"use client";

import { ArrowRight, Check, ChevronLeft, Sparkles, Store, UserRound, UsersRound, Zap } from "lucide-react";

import { type OwnerPlan, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { cn, won } from "@/lib/utils";

type OwnerBillingPlanPickerProps = {
  plans: OwnerPlan[];
  currentPlanCode: OwnerPlanCode;
  selectedPlanCode: OwnerPlanCode;
  onSelectPlanCode: (code: OwnerPlanCode) => void;
  onContinue: () => void;
  onBack: () => void;
  loading: boolean;
  message: string | null;
};

const planIcons = [UserRound, UsersRound, Zap] as const;

const planFeatureRows: Array<{
  label: string;
  included?: OwnerPlanCode[];
  value?: (plan: OwnerPlan) => string;
}> = [
  { label: "직원 수", value: (plan) => plan.staffLimitLabel },
  { label: "포함 알림톡", value: (plan) => plan.alimtalkIncludedLabel },
  { label: "예약·고객·미용 기록", included: ["monthly", "quarterly", "yearly"] },
  { label: "고객 예약 링크", included: ["monthly", "quarterly", "yearly"] },
  { label: "직원별 예약 관리", included: ["quarterly", "yearly"] },
  { label: "미용 완료 사진 링크", included: ["quarterly", "yearly"] },
  { label: "직원 계정·권한", included: ["yearly"] },
  { label: "운영 리포트", included: ["yearly"] },
];

function PlanIcon({ index }: { index: number }) {
  const iconProps = { className: "h-[18px] w-[18px]", strokeWidth: 1.9, "aria-hidden": true } as const;

  switch (planIcons[index % planIcons.length]) {
    case UsersRound:
      return <UsersRound {...iconProps} />;
    case Zap:
      return <Zap {...iconProps} />;
    case UserRound:
    default:
      return <UserRound {...iconProps} />;
  }
}

function PlanFeatureValue({ plan, row }: { plan: OwnerPlan; row: (typeof planFeatureRows)[number] }) {
  const value = row.value?.(plan);
  const included = row.included?.includes(plan.code) ?? false;

  if (value) {
    return <span className="text-[14px] font-semibold text-[#111827]">{value}</span>;
  }

  if (included) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#222222] text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
      </span>
    );
  }

  return <span className="text-[14px] font-medium text-[#b7bec8]">-</span>;
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[13px] border border-[#e6e9ef] bg-[#fbfcfd] px-3 py-3">
      <p className="text-[12px] font-medium text-[#6b7280]">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function BillingPlanColumn({
  plan,
  index,
  current,
  selected,
  loading,
  onSelect,
  onContinue,
}: {
  plan: OwnerPlan;
  index: number;
  current: boolean;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
  onContinue: () => void;
}) {
  const actionLabel = selected ? "이 플랜으로 계속" : `${plan.title} 선택`;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-current={current ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col rounded-[20px] border bg-white p-4 transition",
        selected
          ? "border-[#222222] shadow-[0_20px_42px_rgba(17,24,39,0.13)]"
          : "border-[#dfe4ec] hover:border-[#bfc8d4] hover:shadow-[0_12px_30px_rgba(17,24,39,0.07)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#e2e7ef] bg-[#f8fafc] text-[#242424]">
            <PlanIcon index={index} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-semibold text-[#111827]">{plan.title}</h2>
              {plan.badge ? (
                <span className="rounded-full bg-[#eef2f7] px-2 py-1 text-[12px] font-semibold text-[#475569]">
                  {plan.badge}
                </span>
              ) : null}
              {current ? (
                <span className="rounded-full bg-[#222222] px-2 py-1 text-[12px] font-semibold text-white">
                  현재 이용 중
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[14px] leading-6 text-[#566170]">{plan.targetLabel}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 min-h-[48px] text-[14px] leading-6 text-[#4b5563]">{plan.description}</p>

      <div className="mt-4 rounded-[16px] border border-[#e2e7ef] bg-[#fbfcfd] p-4">
        <p className="flex items-end gap-1 text-[#111827]">
          <span className="pb-1 text-[15px] font-medium">월</span>
          <span className="text-[38px] font-semibold leading-none">{won(plan.monthlyPrice).replace("원", "")}</span>
          <span className="pb-1 text-[15px] font-medium">원</span>
        </p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (selected) {
              onContinue();
              return;
            }
            onSelect();
          }}
          disabled={loading}
          className={cn(
            "mt-4 flex h-11 w-full items-center justify-center rounded-[12px] text-[15px] font-semibold transition disabled:opacity-60",
            selected ? "bg-[#222222] text-white hover:bg-[#111111]" : "bg-[#eef1f5] text-[#222222] hover:bg-[#e4e8ee]",
          )}
        >
          {loading && selected ? "결제 진행 중..." : actionLabel}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <PlanMetric label="운영 규모" value={plan.staffLimitLabel} />
        <PlanMetric label="월 알림톡" value={plan.alimtalkIncludedLabel.replace(" 포함", "")} />
      </div>

      <ul className="mt-4 space-y-2">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2 text-[14px] leading-6 text-[#263241]">
            <Check className="mt-1 h-4 w-4 shrink-0 text-[#222222]" strokeWidth={2.2} aria-hidden="true" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 divide-y divide-[#edf0f4] rounded-[15px] border border-[#e7ebf1]">
        {planFeatureRows.map((row) => (
          <div key={row.label} className="grid min-h-[42px] grid-cols-[1fr_auto] items-center gap-3 px-3 py-2">
            <span className="text-[13px] font-medium text-[#5d6877]">{row.label}</span>
            <PlanFeatureValue plan={plan} row={row} />
          </div>
        ))}
      </div>
    </article>
  );
}

export function OwnerBillingPlanPicker({
  plans,
  currentPlanCode,
  selectedPlanCode,
  onSelectPlanCode,
  onContinue,
  onBack,
  loading,
  message,
}: OwnerBillingPlanPickerProps) {
  const visiblePlans = plans.filter((plan) => !plan.hidden);
  const selectedPlan = visiblePlans.find((plan) => plan.code === selectedPlanCode) ?? visiblePlans[0];
  const currentPlan = visiblePlans.find((plan) => plan.code === currentPlanCode) ?? null;

  if (!selectedPlan) {
    return null;
  }

  return (
    <div className="owner-font min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#111827] lg:px-10 lg:py-8">
      <section className="mx-auto w-full max-w-[1180px] rounded-[28px] border border-[#e2e7ef] bg-white px-5 pb-7 pt-7 shadow-[0_28px_80px_rgba(17,24,39,0.09)] lg:px-8 lg:pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight text-[#111827] lg:text-[38px]">플랜 선택</h1>
            <p className="mt-2 text-[16px] leading-7 text-[#596170]">
              실제 미용실 운영 규모에 맞춰 1인샵, 팀샵, 확장 매장 기준으로 나눴습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[14px] font-medium text-[#4b5563]">
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dfe4ec] bg-[#f8fafc] px-3">
              <Store className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              매장 1곳 기준
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dfe4ec] bg-[#f8fafc] px-3">
              <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              9명 이상 별도 상담
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-[20px] border border-[#e4e9f0] bg-[#f8fafc] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
          <div className="rounded-[15px] bg-white px-4 py-3">
            <p className="text-[12px] font-semibold text-[#718096]">현재 플랜</p>
            <p className="mt-1 text-[17px] font-semibold text-[#111827]">
              {currentPlan ? `${currentPlan.title} · ${currentPlan.staffLimitLabel}` : "결제 전 선택 필요"}
            </p>
          </div>
          <div className="rounded-[15px] bg-white px-4 py-3">
            <p className="text-[12px] font-semibold text-[#718096]">선택한 플랜</p>
            <p className="mt-1 text-[17px] font-semibold text-[#111827]">
              {selectedPlan.title} · {selectedPlan.staffLimitLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#222222] px-5 text-[15px] font-semibold text-white transition hover:bg-[#111111] disabled:opacity-60"
          >
            {loading ? "결제 진행 중..." : "선택한 플랜으로 계속"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {visiblePlans.map((plan, index) => (
            <BillingPlanColumn
              key={plan.code}
              plan={plan}
              index={index}
              current={currentPlanCode === plan.code}
              selected={selectedPlan.code === plan.code}
              loading={loading}
              onSelect={() => onSelectPlanCode(plan.code)}
              onContinue={onContinue}
            />
          ))}
        </div>

        <div className="mt-5 rounded-[16px] border border-[#e4e9f0] bg-[#f8fafc] px-4 py-4 text-[15px] leading-7 text-[#4b5563]">
          <p>
            직원 수는 해당 매장에서 실제 예약을 배정받는 스태프 기준입니다. 9명 이상 또는 여러 지점을 한 번에 운영하는 경우는
            일반 요금제보다 별도 상담 기준으로 두는 편이 현실적입니다.
          </p>
        </div>

        {message ? (
          <p className="mx-auto mt-5 max-w-[560px] rounded-[14px] border border-[#dedede] bg-white px-4 py-3 text-center text-[15px] leading-6 text-[#333333]">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          className="mx-auto mt-6 flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#dfe4ec] bg-white px-4 text-[15px] font-medium text-[#596170]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          이전으로 돌아가기
        </button>
      </section>
    </div>
  );
}
