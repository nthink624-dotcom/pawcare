"use client";

import { ChevronLeft, MessageSquareText } from "lucide-react";

import {
  getOwnerPlanStaffAccountLabel,
  getOwnerPlanStaffLimitLabel,
  ownerPlanUsesMultiShopStaffAllowance,
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
  onOpenSupport: () => void;
  canCancelRenewal: boolean;
  cancellingRenewal: boolean;
  onCancelRenewal: () => void;
  loading: boolean;
  message: string | null;
};

type PlanUi = {
  title: string;
  subtitle: string;
};

const planUiByCode: Partial<Record<OwnerPlanCode, PlanUi>> = {
  monthly: {
    title: "1인 운영",
    subtitle: "혼자 운영하는 단일 매장 기준",
  },
  quarterly: {
    title: "2~4인 운영",
    subtitle: "직원·파트타임과 함께 일하는 단일 매장 기준",
  },
  halfyearly: {
    title: "2~4인 운영",
    subtitle: "직원·파트타임과 함께 일하는 단일 매장 기준",
  },
  yearly: {
    title: "5인 이상 운영",
    subtitle: "담당자가 많은 단일 대형 매장 기준",
  },
};

function getPlanUi(plan: OwnerPlan): PlanUi {
  return (
    planUiByCode[plan.code] ?? {
      title: plan.title,
      subtitle: plan.targetLabel,
    }
  );
}

function getRecommendedPlanCode(currentPlanCode: OwnerPlanCode): OwnerPlanCode {
  if (currentPlanCode === "monthly" || currentPlanCode === "free") return "quarterly";
  if (currentPlanCode === "halfyearly") return "quarterly";
  return currentPlanCode;
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
  const usesMultiShopStaffAllowance = ownerPlanUsesMultiShopStaffAllowance(totalShopCount);
  const subtitle = usesMultiShopStaffAllowance ? "다점포 기본 직원 1명 추가 기준" : ui.subtitle;
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
        "flex min-w-0 cursor-pointer flex-col rounded-[8px] border bg-white p-5 transition",
        selected
          ? "border-[#2563eb] shadow-[0_10px_26px_rgba(37,99,235,0.12)]"
          : "border-[#dbe2ea] hover:border-[#94a3b8]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold leading-tight text-[#0f172a]">{ui.title}</h2>
          <p className="mt-1 text-[13px] leading-5 text-[#64748b]">{subtitle}</p>
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
        <PlanFact label="포함 알림톡" value={plan.alimtalkIncludedLabel} />
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
          "mt-5 flex h-10 w-full items-center justify-center rounded-[8px] border text-[14px] font-medium transition disabled:cursor-default disabled:opacity-60",
          selected && !current ? "border-[#2563eb] bg-[#2563eb] text-white hover:bg-[#1d4ed8]" : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
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
  onOpenSupport,
  canCancelRenewal,
  cancellingRenewal,
  onCancelRenewal,
  loading,
  message,
}: OwnerBillingPlanPickerProps) {
  const visiblePlans = plans.filter((plan) => !plan.hidden);
  const selectedPlan = visiblePlans.find((plan) => plan.code === selectedPlanCode) ?? visiblePlans[0];
  const recommendedPlanCode = getRecommendedPlanCode(currentPlanCode);

  if (!selectedPlan) return null;

  return (
    <div className="owner-font min-h-screen bg-[#f6f8fb] px-4 py-6 text-[#0f172a] lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <section className="rounded-[8px] border border-[#dbe2ea] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:px-7 lg:py-6">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e7edf3] pb-5">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[13px] font-medium text-[#475569] transition hover:bg-[#f8fafc]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                이전
              </button>
              <div>
                <p className="text-[13px] font-medium text-[#64748b]">이용 플랜</p>
                <h1 className="mt-1 text-[22px] font-semibold leading-tight text-[#0f172a]">매장 운영 인원에 맞는 플랜을 선택하세요</h1>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onOpenSupport}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#475569] transition hover:bg-[#f8fafc]"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                1:1 문의
              </button>
              {canCancelRenewal ? (
                <button
                  type="button"
                  onClick={onCancelRenewal}
                  disabled={cancellingRenewal}
                  className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#ead3d8] bg-white px-3 text-[13px] font-medium text-[#a04455] transition hover:bg-[#fff7f8] disabled:opacity-60"
                >
                  {cancellingRenewal ? "취소 처리 중..." : "정기결제 취소"}
                </button>
              ) : null}
            </div>
          </header>

          <section className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
            <p className="text-[14px] font-medium text-[#334155]">모든 플랜에 기본 제공</p>
            <p className="text-[13px] text-[#64748b]">간편 예약 · 고객 관리 · 예약 스케줄 · 자동 알림톡 · 직원 관리</p>
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
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

          <div className="mt-5 grid gap-4 border-t border-[#e7edf3] pt-4 lg:grid-cols-2">
            <section>
              <p className="text-[13px] font-medium text-[#334155]">이용 기준</p>
              <p className="mt-1 text-[12px] leading-5 text-[#64748b]">모든 플랜은 1개 사업자/1개 매장 기준입니다. 동일 브랜드라도 지점이 다르거나, 타 업체 예약·고객·직원 관리를 함께 사용하는 경우에는 별도 문의가 필요합니다.</p>
            </section>
            <section>
              <p className="text-[13px] font-medium text-[#334155]">다점포 할인</p>
              <p className="mt-1 text-[12px] leading-5 text-[#64748b]">선택한 플랜의 매장당 월 금액을 기준으로 2개 매장부터 10%, 3개 매장부터 20% 할인이 적용됩니다. 변경분은 다음 결제일부터 반영됩니다.</p>
            </section>
          </div>

          {message ? (
            <p className="mt-4 rounded-[8px] border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-[14px] leading-6 text-[#b91c1c]">{message}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
