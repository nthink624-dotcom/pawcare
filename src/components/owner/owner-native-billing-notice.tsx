"use client";

import { Monitor, RefreshCw } from "lucide-react";

import { AppButton } from "@/components/ui/app-button";
import { getOwnerPlanDisplayName } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";

function formatDate(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10).replace(/-/g, ".");
}

function getStatusLabel(status: OwnerSubscriptionSummary["status"]) {
  switch (status) {
    case "active":
      return "이용 중";
    case "trialing":
    case "trial_will_end":
      return "체험 중";
    case "past_due":
      return "결제 확인 필요";
    case "expired":
      return "이용 기간 종료";
    case "canceled":
      return "해지됨";
    default:
      return "확인 필요";
  }
}

export function OwnerNativeBillingNotice({
  summary,
  onRefresh,
  onBack,
}: {
  summary: OwnerSubscriptionSummary;
  onRefresh: () => void;
  onBack?: () => void;
}) {
  const periodEnd = summary.currentPeriodEndsAt ?? summary.trialEndsAt;

  return (
    <main className="owner-font mx-auto min-h-screen w-full max-w-[430px] break-keep bg-white px-5 pb-10 pt-8 text-[#171411]">
      <section className="border-b border-[#e8e5df] pb-6">
        <p className="text-[13px] font-semibold text-[#1f5b51]">현재 플랜</p>
        <h1 className="mt-2 text-[26px] font-bold leading-[1.3] tracking-[0]">
          {getOwnerPlanDisplayName(summary.currentPlanCode)}
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-3 text-[14px]">
          <div className="rounded-[8px] border border-[#e4e1da] bg-[#faf9f7] px-4 py-3">
            <p className="text-[#777168]">이용 상태</p>
            <p className="mt-1 font-semibold text-[#171411]">{getStatusLabel(summary.status)}</p>
          </div>
          <div className="rounded-[8px] border border-[#e4e1da] bg-[#faf9f7] px-4 py-3">
            <p className="text-[#777168]">이용 종료일</p>
            <p className="mt-1 font-semibold text-[#171411]">{formatDate(periodEnd)}</p>
          </div>
        </div>
      </section>

      <section className="py-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#edf4f1] text-[#1f5b51]">
            <Monitor className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[0]">플랜 결제는 PC에서 진행해 주세요</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#68635c]">
              플랜 추가·변경과 알림톡 충전은 PC 버전에서 가능합니다. PC에서 결제를 마친 뒤 아래 버튼으로 상태를 다시 확인해 주세요.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2.5">
          <AppButton fullWidth className="h-[52px] rounded-[8px] bg-[#1f5b51] text-[15px] font-semibold text-white" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            플랜 상태 다시 확인
          </AppButton>
          {onBack ? (
            <AppButton
              fullWidth
              variant="secondary"
              className="h-[52px] rounded-[8px] border-[#ddd9d1] bg-white text-[15px] font-medium text-[#171411]"
              onClick={onBack}
            >
              앱으로 돌아가기
            </AppButton>
          ) : null}
        </div>
      </section>
    </main>
  );
}
