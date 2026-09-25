"use client";

import { CalendarX2, ChevronLeft } from "lucide-react";

import {
  getOwnerPlanStaffAccountLabel,
  getOwnerPlanStaffLimitLabel,
  OWNER_SINGLE_MONTHLY_PLAN_CODE,
  type OwnerPlan,
  type OwnerPlanCode,
} from "@/lib/billing/owner-plans";
import { cn, won } from "@/lib/utils";

type OwnerBillingPlanPickerProps = {
  plans: OwnerPlan[];
  currentPlanCode: OwnerPlanCode;
  selectedPlanCode: OwnerPlanCode;
  totalShopCount: number;
  onSelectPlanCode: (code: OwnerPlanCode) => void;
  onContinue: () => void;
  onBack: () => void;
  canCancelRenewal: boolean;
  cancellingRenewal: boolean;
  onCancelRenewal: () => void;
  loading: boolean;
  message: string | null;
  variant?: "page" | "modal";
};

type PlanUi = {
  title: string;
};

const planUiByCode: Partial<Record<OwnerPlanCode, PlanUi>> = {
  [OWNER_SINGLE_MONTHLY_PLAN_CODE]: {
    title: "월 정기 이용",
  },
  monthly: {
    title: "1인 운영",
  },
  quarterly: {
    title: "2~4인 운영",
  },
  halfyearly: {
    title: "2~4인 운영",
  },
  yearly: {
    title: "5인 이상 운영",
  },
};

function getPlanUi(plan: OwnerPlan): PlanUi {
  return (
    planUiByCode[plan.code] ?? {
      title: plan.title,
    }
  );
}

function getRecommendedPlanCode(currentPlanCode: OwnerPlanCode): OwnerPlanCode {
  return currentPlanCode === OWNER_SINGLE_MONTHLY_PLAN_CODE ? currentPlanCode : OWNER_SINGLE_MONTHLY_PLAN_CODE;
}

function isCurrentVisiblePlan(currentPlanCode: OwnerPlanCode, planCode: OwnerPlanCode) {
  return currentPlanCode === planCode || (currentPlanCode === "halfyearly" && planCode === "quarterly");
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#eef2f6] py-2.5 last:border-b-0">
      <span className="text-[13px] text-[#64748b]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[#334155]">{value}</span>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  selected,
  recommended,
  loading,
  totalShopCount,
  onSelect,
  onContinue,
}: {
  plan: OwnerPlan;
  current: boolean;
  selected: boolean;
  recommended: boolean;
  loading: boolean;
  totalShopCount: number;
  onSelect: () => void;
  onContinue: () => void;
}) {
  const ui = getPlanUi(plan);
  const operatingLabel = getOwnerPlanStaffLimitLabel(plan, totalShopCount);
  const staffAccountLabel = getOwnerPlanStaffAccountLabel(plan, totalShopCount);
  const actionLabel = current ? "현재 이용 중" : selected ? "이 플랜으로 계속" : `${ui.title} 선택`;
  const badgeLabel = current ? "현재" : recommended ? "추천" : plan.code === "yearly" ? "대형" : null;

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
        "flex min-w-0 cursor-pointer flex-col rounded-[10px] border bg-white p-5 transition",
        selected
          ? "border-[#1677ff] bg-[#f8fbff] shadow-none"
          : "border-[#e8edf3] hover:border-[#bfd3ea]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold leading-tight text-[#0f172a]">{ui.title}</h2>
        </div>
        {badgeLabel ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium",
              current ? "bg-[#ecfdf3] text-[#1f9d55]" : selected || recommended ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#f1f5f9] text-[#64748b]",
            )}
          >
            {badgeLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-6 border-t border-[#e7edf3] pt-5">
        <p className="flex items-end gap-1.5 text-[#0f172a]">
          <span className="pb-1 text-[13px] text-[#64748b]">월</span>
          <span className={cn("text-[34px] font-semibold leading-none tracking-normal", selected ? "text-[#2563eb]" : "text-[#0f172a]")}>
            {won(plan.monthlyPrice).replace("원", "")}
          </span>
          <span className="pb-1 text-[14px] font-medium text-[#334155]">원</span>
        </p>
      </div>

      <div className="mt-4 grid gap-1.5">
        <PlanFact label="운영 기준" value={operatingLabel} />
        <PlanFact label="이용 기간" value={plan.code === "free" ? "14일 무료 체험" : "결제일부터 1개월"} />
        <PlanFact label="직원 계정·권한" value={staffAccountLabel} />
      </div>

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
        disabled={loading || current}
        className={cn(
          "mt-5 flex h-11 w-full items-center justify-center rounded-[8px] border text-[14px] font-medium transition disabled:cursor-default disabled:opacity-60",
          selected && !current ? "border-[#1677ff] bg-[#1677ff] text-white hover:bg-[#0e65d8]" : "border-[#e8edf3] bg-white text-[#334155] hover:bg-[#f8fbff]",
        )}
      >
        {loading && selected ? "처리 중..." : actionLabel}
      </button>
    </article>
  );
}

export function OwnerBillingPlanPicker({
  plans,
  currentPlanCode,
  selectedPlanCode,
  totalShopCount,
  onSelectPlanCode,
  onContinue,
  onBack,
  canCancelRenewal,
  cancellingRenewal,
  onCancelRenewal,
  loading,
  message,
  variant = "page",
}: OwnerBillingPlanPickerProps) {
  const visiblePlans = plans.filter((plan) => !plan.hidden);
  const selectedPlan = visiblePlans.find((plan) => plan.code === selectedPlanCode) ?? visiblePlans[0];
  const recommendedPlanCode = getRecommendedPlanCode(currentPlanCode);

  if (!selectedPlan) return null;

  return (
    <div
      className={cn(
        "owner-font pm-owner-web text-[var(--ink)]",
        variant === "page" ? "min-h-screen bg-[var(--bg)] px-4 py-6 lg:px-8 lg:py-8" : "bg-white",
      )}
    >
      <div className={cn("w-full", variant === "page" && "mx-auto max-w-[1180px]")}>
        <section
          className={cn(
            "bg-white px-4 py-4 shadow-none sm:px-5 sm:py-5 lg:px-7 lg:py-6",
            variant === "page" && "rounded-[14px] border border-[var(--bd)]",
          )}
        >
          <header className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e7edf3] pb-5", variant === "modal" && "pr-14")}>
            {variant === "page" ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-[9px] border border-[#e8edf3] bg-white px-3 text-[13px] font-medium text-[#475569] transition hover:border-[#cbd5e1] hover:bg-[#f8fbff]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                이전
              </button>
            ) : (
              <span className="w-11" aria-hidden="true" />
            )}

            <div className="min-w-0 text-center">
              <h1 id="owner-billing-plan-picker-title" className="text-[19px] font-semibold leading-7 text-[#0f172a] sm:text-[22px]">
                매장 운영 인원에 맞는 플랜을 선택하세요
              </h1>
            </div>

            {canCancelRenewal ? (
              <button
                type="button"
                onClick={onCancelRenewal}
                disabled={cancellingRenewal}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#e7cfd4] bg-white px-3 text-[13px] font-medium text-[#a04455] transition hover:border-[#d9b4bc] hover:bg-[#fffafb] disabled:opacity-60"
              >
                <CalendarX2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {cancellingRenewal ? "취소 처리 중..." : "정기결제 취소"}
                </span>
                <span className="sm:hidden">{cancellingRenewal ? "처리 중" : "결제 취소"}</span>
              </button>
            ) : (
              <span className="w-10" aria-hidden="true" />
            )}
          </header>

          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                current={isCurrentVisiblePlan(currentPlanCode, plan.code)}
                selected={selectedPlan.code === plan.code}
                recommended={recommendedPlanCode === plan.code}
                loading={loading}
                totalShopCount={totalShopCount}
                onSelect={() => onSelectPlanCode(plan.code)}
                onContinue={onContinue}
              />
            ))}
          </div>

          {message ? (
            <p className="mt-4 rounded-[8px] border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-[14px] leading-6 text-[#b91c1c]">{message}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
