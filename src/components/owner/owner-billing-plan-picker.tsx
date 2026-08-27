"use client";

import { CalendarX2, ChevronLeft } from "lucide-react";

import {
  OWNER_SINGLE_PLAN_INCLUDED_COPY,
  OWNER_SINGLE_PLAN_LIMIT_COPY,
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
};

function isCurrentVisiblePlan(currentPlanCode: OwnerPlanCode, planCode: OwnerPlanCode) {
  return currentPlanCode === planCode;
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
  loading,
  onSelect,
  onContinue,
}: {
  plan: OwnerPlan;
  current: boolean;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
  onContinue: () => void;
}) {
  const actionLabel = current ? "현재 이용 중" : "이 요금제로 이용하기";

  return (
    <article
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex min-w-0 flex-col rounded-[10px] border bg-white p-5 transition",
        selected
          ? "border-[#1677ff] bg-[#f8fbff] shadow-none"
          : "border-[#e8edf3] hover:border-[#bfd3ea]",
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold leading-tight text-[#0f172a]">{plan.title}</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#475569]">카드 없이 14일 체험</p>
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
        <PlanFact label="체험" value="카드 없이 14일" />
        <PlanFact label="기능" value="핵심 운영 기능 포함" />
        <PlanFact label="알림톡" value="포함 · 별도 충전 없음" />
      </div>

      <p className="mt-4 text-[14px] leading-6 text-[#475569]">{OWNER_SINGLE_PLAN_INCLUDED_COPY}</p>
      <p className="mt-2 text-[13px] leading-5 text-[#64748b]">{OWNER_SINGLE_PLAN_LIMIT_COPY}</p>

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
          "mt-5 flex min-h-11 w-full items-center justify-center rounded-[8px] border text-[14px] font-medium transition disabled:cursor-default disabled:opacity-60",
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
  totalShopCount: _totalShopCount,
  onSelectPlanCode,
  onContinue,
  onBack,
  canCancelRenewal,
  cancellingRenewal,
  onCancelRenewal,
  loading,
  message,
}: OwnerBillingPlanPickerProps) {
  const visiblePlans = plans.filter((plan) => !plan.hidden);
  const selectedPlan = visiblePlans.find((plan) => plan.code === selectedPlanCode) ?? visiblePlans[0];

  if (!selectedPlan) return null;

  return (
    <div className="owner-font pm-owner-web min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--ink)] lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <section className="rounded-[14px] border border-[var(--bd)] bg-white px-5 py-5 shadow-none lg:px-7 lg:py-6">
          <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e7edf3] pb-5">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[9px] border border-[#e8edf3] bg-white px-3 text-[13px] font-medium text-[#475569] transition hover:border-[#cbd5e1] hover:bg-[#f8fbff]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              이전
            </button>

            <div className="min-w-0 text-center">
              <h1 className="text-[19px] font-semibold leading-7 text-[#0f172a] sm:text-[22px]">
                펫매니저 단일 요금제
              </h1>
            </div>

            {canCancelRenewal ? (
              <button
                type="button"
                onClick={onCancelRenewal}
                disabled={cancellingRenewal}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#e7cfd4] bg-white px-3 text-[13px] font-medium text-[#a04455] transition hover:border-[#d9b4bc] hover:bg-[#fffafb] disabled:opacity-60"
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

          <section className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[10px] border border-[#e8edf3] bg-[#f8fbff] px-4 py-3">
            <p className="text-[14px] font-medium text-[#334155]">월 29,000원 · 알림톡 포함 · 별도 충전 없음</p>
          </section>

          <div className="mx-auto mt-5 grid max-w-[560px] gap-4">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                current={isCurrentVisiblePlan(currentPlanCode, plan.code)}
                selected={selectedPlan.code === plan.code}
                loading={loading}
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
