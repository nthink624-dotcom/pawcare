"use client";

import { ArrowRight, ChevronLeft, UserRound, UsersRound, Zap } from "lucide-react";

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

const planRank: Record<OwnerPlanCode, number> = {
  free: 0,
  monthly: 1,
  quarterly: 2,
  halfyearly: 2,
  yearly: 3,
};

function getPlanAssignableStaffLabel(plan: OwnerPlan) {
  return plan.staffLimitLabel.replace(/^직원\s*/, "");
}

function getPlanStaffPermissionLabel(plan: OwnerPlan) {
  return plan.code === "monthly" ? "없음" : "포함";
}

function getPlanSummaryLabel(plan: OwnerPlan) {
  return `${plan.title} · 예약 배정 스태프 ${getPlanAssignableStaffLabel(plan)}`;
}

function getPlanChangeDirection(currentCode: OwnerPlanCode, selectedCode: OwnerPlanCode) {
  const currentRank = planRank[currentCode] ?? 0;
  const selectedRank = planRank[selectedCode] ?? 0;
  if (selectedRank < currentRank) return "lower";
  if (selectedRank > currentRank) return "higher";
  return "same";
}

function getPlanActionLabel({
  current,
  selected,
  direction,
  plan,
}: {
  current: boolean;
  selected: boolean;
  direction: "lower" | "higher" | "same";
  plan: OwnerPlan;
}) {
  if (!selected) return current ? "현재 이용 중" : `${plan.title} 선택`;
  if (direction === "lower") return "다음 결제일부터 변경";
  if (direction === "higher") return "이 플랜으로 변경";
  return "현재 플랜 유지";
}

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

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#e6e9ef] bg-[#fbfcfd] px-3 py-3">
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
  changeDirection,
  loading,
  onSelect,
  onContinue,
}: {
  plan: OwnerPlan;
  index: number;
  current: boolean;
  selected: boolean;
  changeDirection: "lower" | "higher" | "same";
  loading: boolean;
  onSelect: () => void;
  onContinue: () => void;
}) {
  const actionLabel = getPlanActionLabel({ current, selected, direction: changeDirection, plan });

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
          : plan.featured
            ? "border-[#c9d8d2] shadow-[0_12px_30px_rgba(47,125,104,0.07)] hover:border-[#9bbcaf]"
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

      <div className="mt-5 rounded-[16px] border border-[#e2e7ef] bg-[#fbfcfd] p-4">
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
            current
              ? "bg-[#eef1f5] text-[#64748b]"
              : selected
                ? "bg-[#222222] text-white hover:bg-[#111111]"
                : "bg-[#eef1f5] text-[#222222] hover:bg-[#e4e8ee]",
          )}
        >
          {loading && selected ? "결제 진행 중..." : actionLabel}
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        <PlanMetric label="운영 규모" value={plan.targetLabel} />
        <PlanMetric label="예약 배정 스태프" value={getPlanAssignableStaffLabel(plan)} />
        <PlanMetric label="포함 알림톡" value={plan.alimtalkIncludedLabel} />
        <PlanMetric label="직원 계정·권한" value={getPlanStaffPermissionLabel(plan)} />
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
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode) ?? null;
  const selectedDirection = getPlanChangeDirection(currentPlanCode, selectedPlan?.code ?? selectedPlanCode);
  const selectedActionLabel = selectedPlan
    ? getPlanActionLabel({
        current: currentPlanCode === selectedPlan.code,
        selected: true,
        direction: selectedDirection,
        plan: selectedPlan,
      })
    : "선택한 플랜으로 계속";

  if (!selectedPlan) {
    return null;
  }

  return (
    <div className="owner-font min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#111827] lg:px-10 lg:py-8">
      <section className="mx-auto w-full max-w-[1180px] rounded-[28px] border border-[#e2e7ef] bg-white px-5 pb-7 pt-7 shadow-[0_28px_80px_rgba(17,24,39,0.09)] lg:px-8 lg:pb-8">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight text-[#111827] lg:text-[38px]">플랜 선택</h1>
        </div>

        <div className="mt-6 grid gap-3 rounded-[20px] border border-[#e4e9f0] bg-[#f8fafc] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
          <div className="rounded-[15px] bg-white px-4 py-3">
            <p className="text-[12px] font-semibold text-[#718096]">현재 플랜</p>
            <p className="mt-1 text-[17px] font-semibold text-[#111827]">
              {currentPlan ? getPlanSummaryLabel(currentPlan) : "결제 전 선택 필요"}
            </p>
          </div>
          <div className="rounded-[15px] bg-white px-4 py-3">
            <p className="text-[12px] font-semibold text-[#718096]">선택한 플랜</p>
            <p className="mt-1 text-[17px] font-semibold text-[#111827]">
              {getPlanSummaryLabel(selectedPlan)}
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#222222] px-5 text-[15px] font-semibold text-white transition hover:bg-[#111111] disabled:opacity-60"
          >
            {loading ? "결제 진행 중..." : selectedActionLabel}
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
              changeDirection={getPlanChangeDirection(currentPlanCode, plan.code)}
              loading={loading}
              onSelect={() => onSelectPlanCode(plan.code)}
              onContinue={onContinue}
            />
          ))}
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
