"use client";

import { BellRing, CalendarCheck, ChevronLeft, ChevronRight, Clock3, Database, MessagesSquare, Sparkles } from "lucide-react";
import { useState } from "react";

import { type OwnerPlan, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { cn, won } from "@/lib/utils";

type OwnerBillingPlanPickerProps = {
  plans: OwnerPlan[];
  currentPlanCode: OwnerPlanCode;
  selectedPlanCode: OwnerPlanCode;
  onSelectPlanCode: (code: OwnerPlanCode) => void;
  onContinue: () => void;
  onBack: () => void;
  canCancelRenewal: boolean;
  cancellingRenewal: boolean;
  onCancelRenewal: () => void;
  loading: boolean;
  message: string | null;
};

type PlanUi = {
  title: string;
  subtitle: string;
  operatingLabel: string;
  staffAccountLabel: string;
};

const planUiByCode: Partial<Record<OwnerPlanCode, PlanUi>> = {
  monthly: {
    title: "1인 운영",
    subtitle: "혼자 운영하는 단일 매장 기준",
    operatingLabel: "1인 단일 매장",
    staffAccountLabel: "없음",
  },
  quarterly: {
    title: "2~4인 운영",
    subtitle: "직원·파트타임과 함께 일하는 단일 매장 기준",
    operatingLabel: "2~4인 단일 매장",
    staffAccountLabel: "포함",
  },
  halfyearly: {
    title: "2~4인 운영",
    subtitle: "직원·파트타임과 함께 일하는 단일 매장 기준",
    operatingLabel: "2~4인 단일 매장",
    staffAccountLabel: "포함",
  },
  yearly: {
    title: "5인 이상 운영",
    subtitle: "담당자가 많은 단일 대형 매장 기준",
    operatingLabel: "5인 이상 단일 매장",
    staffAccountLabel: "포함",
  },
};

const commonFeatures = [
  {
    icon: CalendarCheck,
    title: "간편 예약",
    description: "고객이 직접 예약하고 필요한 정보를 남깁니다.",
  },
  {
    icon: MessagesSquare,
    title: "예약 수집",
    description: "전화·문자·DM 예약까지 한곳에서 관리합니다.",
  },
  {
    icon: Clock3,
    title: "추천시간",
    description: "예약 공백을 줄이도록 가능한 시간을 안내합니다.",
  },
  {
    icon: Database,
    title: "고객 DB",
    description: "고객과 반려견 정보가 자연스럽게 쌓입니다.",
  },
  {
    icon: BellRing,
    title: "자동 알림톡",
    description: "예약부터 미용 완료까지 고객 안내를 보냅니다.",
  },
  {
    icon: Sparkles,
    title: "예약 현황",
    description: "오늘 예약과 직원별 스케줄을 한눈에 봅니다.",
  },
];

function getPlanUi(plan: OwnerPlan): PlanUi {
  return (
    planUiByCode[plan.code] ?? {
      title: plan.title,
      subtitle: plan.targetLabel,
      operatingLabel: plan.staffLimitLabel,
      staffAccountLabel: "-",
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
    <div className="flex h-8 items-center justify-between rounded-[8px] border border-[#e2e8f0] bg-[#fbfdff] px-3">
      <span className="text-[12px] font-medium text-[#64748b]">{label}</span>
      <span className="text-[13px] font-semibold text-[#111827]">{value}</span>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  selected,
  recommended,
  loading,
  onSelect,
  onContinue,
}: {
  plan: OwnerPlan;
  current: boolean;
  selected: boolean;
  recommended: boolean;
  loading: boolean;
  onSelect: () => void;
  onContinue: () => void;
}) {
  const ui = getPlanUi(plan);
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
        "flex min-w-0 cursor-pointer flex-col rounded-[8px] border bg-white p-4 transition",
        selected
          ? "border-[var(--pm-brand-blue)] shadow-[0_16px_34px_var(--pm-brand-blue-shadow)]"
          : "border-[#dde7f2] shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:border-[var(--pm-brand-blue-border)]",
      )}
    >
      <div className={cn("-m-4 mb-0 rounded-t-[8px] px-4 py-4", selected ? "bg-[image:var(--pm-brand-blue-soft-gradient)]" : "bg-white")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[21px] font-semibold leading-tight text-[#0f172a]">{ui.title}</h2>
            <p className="mt-1 text-[13px] font-medium text-[#64748b]">{ui.subtitle}</p>
          </div>
          {badgeLabel ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                current
                  ? "bg-[#e8f7ef] text-[#1f9d55]"
                  : selected || recommended
                    ? "bg-[var(--pm-brand-blue)] text-white"
                    : "bg-[#eef2f7] text-[#64748b]",
              )}
            >
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-[#e5edf5] pt-4">
        <p className="flex items-end gap-2 text-[#0f172a]">
          <span className="pb-1 text-[14px] font-semibold text-[#334155]">월</span>
          <span className={cn("text-[34px] font-semibold leading-none tracking-normal", selected ? "text-[var(--pm-brand-blue)]" : "text-[#0f172a]")}>
            {won(plan.monthlyPrice).replace("원", "")}
          </span>
          <span className="pb-1 text-[14px] font-semibold text-[#334155]">원</span>
        </p>
      </div>

      <div className="mt-4 grid gap-1.5">
        <PlanFact label="운영 기준" value={ui.operatingLabel} />
        <PlanFact label="포함 알림톡" value={plan.alimtalkIncludedLabel} />
        <PlanFact label="직원 계정·권한" value={ui.staffAccountLabel} />
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
          "mt-3 flex h-10 w-full items-center justify-center rounded-[8px] text-[14px] font-semibold transition disabled:cursor-default disabled:opacity-60",
          selected && !current ? "bg-[image:var(--pm-brand-blue-button-gradient)] text-white hover:bg-[var(--pm-brand-blue-hover)]" : "bg-[#eef3f9] text-[#334155] hover:bg-[#e2e8f0]",
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
  const recommendedPlanCode = getRecommendedPlanCode(currentPlanCode);
  const [featureIndex, setFeatureIndex] = useState(0);
  const activeFeature = commonFeatures[featureIndex] ?? commonFeatures[0];
  const ActiveFeatureIcon = activeFeature.icon;
  const goPreviousFeature = () => setFeatureIndex((current) => (current - 1 + commonFeatures.length) % commonFeatures.length);
  const goNextFeature = () => setFeatureIndex((current) => (current + 1) % commonFeatures.length);

  if (!selectedPlan) return null;

  return (
    <div className="owner-font min-h-screen bg-[image:var(--pm-brand-blue-page-gradient)] px-4 py-3 text-[#0f172a] lg:px-6 lg:py-4">
      <div className="mx-auto w-full max-w-[1320px]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#dbe6f2] bg-white px-2.5 text-[13px] font-semibold text-[#475569] shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:bg-[#f8fafc]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            이전
          </button>
          {canCancelRenewal ? (
            <button
              type="button"
              onClick={onCancelRenewal}
              disabled={cancellingRenewal}
              className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#e5d4d7] bg-white px-3 text-[13px] font-semibold text-[#a04455] shadow-[0_8px_18px_rgba(160,68,85,0.06)] transition hover:bg-[#fff7f8] disabled:opacity-60"
            >
              {cancellingRenewal ? "취소 처리 중..." : "정기결제 취소"}
            </button>
          ) : null}
        </div>

        <section className="rounded-[8px] border border-[#dbe6f2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(37,99,235,0.08)] lg:px-6">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[22px] font-semibold leading-tight text-[#0f172a] lg:text-[24px]">단일 매장 운영 인원에 맞는 플랜을 선택하세요</h1>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {["기본 기능 동일", "알림톡 포함", "1개 매장 기준"].map((label) => (
                <span key={label} className="rounded-full border border-[var(--pm-brand-blue-border)] bg-[var(--pm-brand-blue-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--pm-brand-blue)]">
                  {label}
                </span>
              ))}
            </div>
          </header>

          <section className="mt-3 rounded-[8px] border border-[#cfe0f5] bg-[#f8fbff] px-3 py-2.5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[12px] font-semibold text-[var(--pm-brand-blue)]">모든 플랜 포함</p>
                <h2 className="mt-0.5 text-[15px] font-semibold leading-tight text-[#0f172a]">인원이 달라도 핵심 운영 자동화는 그대로 제공합니다</h2>
              </div>
              <p className="text-[11.5px] font-medium leading-[18px] text-[#64748b]">가격 차이는 단일 매장의 운영 인원, 포함 알림톡, 직원 계정 기준입니다.</p>
            </div>
            <div className="mt-2 rounded-[8px] border border-[#e3edf8] bg-white px-3 py-2.5">
              <div className="grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <button
                  type="button"
                  onClick={goPreviousFeature}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe6f2] bg-[#f8fbff] text-[#475569] transition hover:border-[var(--pm-brand-blue-border)] hover:text-[var(--pm-brand-blue)]"
                  aria-label="이전 포함 기능"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pm-brand-blue-soft)] text-[var(--pm-brand-blue)]">
                    <ActiveFeatureIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-[#0f172a]">{activeFeature.title}</p>
                      <span className="text-[11px] font-semibold text-[#94a3b8]">
                        {featureIndex + 1}/{commonFeatures.length}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] font-medium leading-[18px] text-[#64748b]">{activeFeature.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={goNextFeature}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe6f2] bg-[#f8fbff] text-[#475569] transition hover:border-[var(--pm-brand-blue-border)] hover:text-[var(--pm-brand-blue)]"
                  aria-label="다음 포함 기능"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                {commonFeatures.map((feature, index) => (
                  <button
                    key={feature.title}
                    type="button"
                    onClick={() => setFeatureIndex(index)}
                    className={cn(
                      "h-1.5 rounded-full transition",
                      index === featureIndex ? "w-5 bg-[var(--pm-brand-blue)]" : "w-1.5 bg-[#cbd5e1] hover:bg-[#94a3b8]",
                    )}
                    aria-label={`${feature.title} 보기`}
                    aria-current={index === featureIndex ? "true" : undefined}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                current={isCurrentVisiblePlan(currentPlanCode, plan.code)}
                selected={selectedPlan.code === plan.code}
                recommended={recommendedPlanCode === plan.code}
                loading={loading}
                onSelect={() => onSelectPlanCode(plan.code)}
                onContinue={onContinue}
              />
            ))}
          </div>

          <section className="mt-4 rounded-[8px] border border-[#dbe6f2] bg-[#f8fbff] px-3 py-2.5">
            <p className="text-[12px] font-semibold text-[#0f172a]">모든 플랜은 1개 사업자/1개 매장 기준입니다.</p>
            <p className="mt-0.5 text-[11.5px] font-medium leading-[18px] text-[#64748b]">
              동일 브랜드라도 지점이 다르거나, 타 업체 예약·고객·직원 관리를 함께 사용하는 경우에는 별도 문의가 필요합니다.
              서비스명, 직원명, 안내 문구로 타 업체나 지점을 구분해 운영하는 것도 공동 사용으로 봅니다. 외부 프리랜서는 해당 매장에서 실제 예약을 수행하는 담당자만 등록할 수 있습니다.
            </p>
          </section>

          {message ? (
            <p className="mt-4 rounded-[8px] border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-[14px] leading-6 text-[#b91c1c]">{message}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
