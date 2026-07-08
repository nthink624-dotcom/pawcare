"use client";

import { BellRing, CalendarCheck, ChevronLeft, Clock3, Database, MessagesSquare, Sparkles } from "lucide-react";

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

type PlanUi = {
  title: string;
  subtitle: string;
  operatingLabel: string;
  staffAccountLabel: string;
  badge?: string;
};

const planUiByCode: Partial<Record<OwnerPlanCode, PlanUi>> = {
  monthly: {
    title: "1인 운영",
    subtitle: "혼자 운영하는 1인샵 기준",
    operatingLabel: "1인샵",
    staffAccountLabel: "없음",
  },
  quarterly: {
    title: "2~4인 운영",
    subtitle: "직원·파트타임과 함께 운영",
    operatingLabel: "2~4인",
    staffAccountLabel: "포함",
    badge: "추천",
  },
  halfyearly: {
    title: "2~4인 운영",
    subtitle: "직원·파트타임과 함께 운영",
    operatingLabel: "2~4인",
    staffAccountLabel: "포함",
    badge: "추천",
  },
  yearly: {
    title: "5인 이상 운영",
    subtitle: "직원 수·예약량이 많은 매장 기준",
    operatingLabel: "5인 이상",
    staffAccountLabel: "포함",
    badge: "대형",
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
      badge: plan.badge,
    }
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-9 items-center justify-between rounded-[8px] border border-[#e2e8f0] bg-[#fbfdff] px-3">
      <span className="text-[12px] font-medium text-[#64748b]">{label}</span>
      <span className="text-[13px] font-semibold text-[#111827]">{value}</span>
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
  const ui = getPlanUi(plan);
  const actionLabel = current ? "현재 이용 중" : selected ? "이 플랜으로 계속" : `${ui.title} 선택`;

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
          ? "border-[var(--pm-brand-blue)] shadow-[0_16px_34px_var(--pm-brand-blue-shadow)]"
          : "border-[#dde7f2] shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:border-[var(--pm-brand-blue-border)]",
      )}
    >
      <div className={cn("-m-5 mb-0 rounded-t-[8px] px-5 py-5", selected ? "bg-[image:var(--pm-brand-blue-soft-gradient)]" : "bg-white")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[23px] font-semibold leading-tight text-[#0f172a]">{ui.title}</h2>
            <p className="mt-1 text-[13px] font-medium text-[#64748b]">{ui.subtitle}</p>
          </div>
          {ui.badge ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold",
                selected ? "bg-[var(--pm-brand-blue)] text-white" : "bg-[#eef2f7] text-[#64748b]",
              )}
            >
              {ui.badge}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 border-t border-[#e5edf5] pt-5">
        <p className="flex items-end gap-2 text-[#0f172a]">
          <span className="pb-1 text-[14px] font-semibold text-[#334155]">월</span>
          <span className={cn("text-[40px] font-semibold leading-none tracking-normal", selected ? "text-[var(--pm-brand-blue)]" : "text-[#0f172a]")}>
            {won(plan.monthlyPrice).replace("원", "")}
          </span>
          <span className="pb-1 text-[14px] font-semibold text-[#334155]">원</span>
        </p>
      </div>

      <div className="mt-5 grid gap-2">
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
          "mt-4 flex h-11 w-full items-center justify-center rounded-[8px] text-[14px] font-semibold transition disabled:cursor-default disabled:opacity-60",
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
  loading,
  message,
}: OwnerBillingPlanPickerProps) {
  const visiblePlans = plans.filter((plan) => !plan.hidden);
  const selectedPlan = visiblePlans.find((plan) => plan.code === selectedPlanCode) ?? visiblePlans[0];

  if (!selectedPlan) return null;

  return (
    <div className="owner-font min-h-screen bg-[image:var(--pm-brand-blue-page-gradient)] px-4 py-5 text-[#0f172a] lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex h-9 items-center gap-1 rounded-[8px] border border-[#dbe6f2] bg-white px-3 text-[14px] font-semibold text-[#475569] shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:bg-[#f8fafc]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          이전
        </button>

        <section className="rounded-[8px] border border-[#dbe6f2] bg-white px-5 py-6 shadow-[0_18px_48px_rgba(37,99,235,0.08)] lg:px-7">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[26px] font-semibold leading-tight text-[#0f172a] lg:text-[28px]">운영 인원에 맞는 플랜을 선택하세요</h1>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {["기본 기능 동일", "알림톡 포함", "인원 기준 선택"].map((label) => (
                <span key={label} className="rounded-full border border-[var(--pm-brand-blue-border)] bg-[var(--pm-brand-blue-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--pm-brand-blue)]">
                  {label}
                </span>
              ))}
            </div>
          </header>

          <section className="mt-5 rounded-[8px] border border-[#cfe0f5] bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_46%,#f9fdff_100%)] p-4 shadow-[0_12px_30px_rgba(37,99,235,0.07)]">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[var(--pm-brand-blue)]">모든 플랜 포함</p>
                <h2 className="mt-1 text-[18px] font-semibold leading-tight text-[#0f172a]">인원이 달라도 핵심 운영 자동화는 그대로 제공합니다</h2>
              </div>
              <p className="text-[12px] font-medium leading-5 text-[#64748b]">가격 차이는 운영 인원, 포함 알림톡, 직원 계정 기준입니다.</p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {commonFeatures.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex min-h-[78px] gap-3 rounded-[8px] border border-white/80 bg-white/85 px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pm-brand-blue-soft)] text-[var(--pm-brand-blue)]">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[#0f172a]">{title}</span>
                    <span className="mt-0.5 block text-[12px] font-medium leading-5 text-[#64748b]">{description}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                current={currentPlanCode === plan.code}
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
