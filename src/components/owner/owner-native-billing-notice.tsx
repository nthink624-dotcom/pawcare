"use client";

import { RefreshCw } from "lucide-react";

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
      return "이용 상태 확인 필요";
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
        <h1 className="mt-2 text-[24px] font-semibold leading-[1.3] tracking-[0]">
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
        <div>
          <h2 className="text-[18px] font-semibold tracking-[0]">현재 이용 상태</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#68635c]">
            앱에서는 현재 적용된 플랜과 이용 기간을 확인할 수 있습니다.
          </p>
        </div>

        <div className="mt-5 grid gap-2.5">
          <AppButton fullWidth className="h-[52px] rounded-[8px] bg-[#1f5b51] text-[16px] font-semibold text-white" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            이용 상태 다시 확인
          </AppButton>
          {onBack ? (
            <AppButton
              fullWidth
              variant="secondary"
              className="h-[52px] rounded-[8px] border-[#ddd9d1] bg-white text-[16px] font-medium text-[#171411]"
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
