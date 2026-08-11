"use client";

import { CheckCircle2, X } from "lucide-react";

import { AppButton } from "@/components/ui/app-button";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { getOwnerPlanDisplayName, getOwnerPlanStaffLimitLabel, type OwnerPlan } from "@/lib/billing/owner-plans";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const datePart = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? `${datePart.slice(2, 4)}.${datePart.slice(5, 7)}.${datePart.slice(8, 10)}` : datePart.replace(/-/g, ".");
}

function getPlanSummaryLine(plan: OwnerPlan, totalShopCount: number) {
  if (plan.code === "free") {
    return "무료체험";
  }

  return `${getOwnerPlanStaffLimitLabel(plan, totalShopCount)} · ${plan.alimtalkIncludedLabel}`;
}

export function OwnerBillingSuccessCard({
  plan,
  endAt,
  paymentMethodLabel,
  totalShopCount = 1,
  message,
  onConfirm,
  onClose,
}: {
  plan: OwnerPlan;
  endAt: string | null;
  paymentMethodLabel?: string | null;
  totalShopCount?: number;
  message: string;
  onConfirm?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="owner-font pm-owner-web min-h-screen w-full bg-[var(--bg)] px-4 py-6 text-[var(--ink)] sm:px-6 lg:px-8 lg:py-8">
      <section className="mx-auto w-full max-w-[860px] rounded-[14px] border border-[var(--bd)] bg-white px-6 pb-6 pt-5 shadow-none">
        {onClose ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--mid)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <div className="mx-auto -mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#eff6ff] text-[#1677ff] shadow-none">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
        </div>

        <p className="mt-5 text-center text-[12px] font-semibold tracking-[0.08em] text-[var(--acc)]">PAYMENT COMPLETE</p>
        <h1 className="mt-3 text-center text-[31px] font-extrabold leading-[1.16] tracking-[-0.04em] text-[var(--ink)]">
          결제가 완료되었습니다
        </h1>
        <p className="mt-4 text-center text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          {PETMANAGER_SERVICE_NAME}를 선택해주셔서 감사합니다.
        </p>
        <p className="mx-auto mt-5 max-w-[296px] whitespace-pre-line text-center text-[14px] leading-[1.58] tracking-[-0.02em] text-[var(--mid)]">
          {"선택하신 플랜이 적용되어 지금 바로\n서비스를 이용하실 수 있어요."}
        </p>

        <div className="mt-8 rounded-[12px] border border-[#e8edf3] bg-[#f8fbff] px-4 py-4 text-left">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[var(--pm-ui-border)] pb-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--mid)]">적용 플랜</p>
              <p className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-[var(--ink)]">
                {getOwnerPlanDisplayName(plan.code)}
              </p>
              <p className="mt-1 text-[13px] text-[var(--mid)]">{getPlanSummaryLine(plan, totalShopCount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[var(--mid)]">
                {plan.billingType === "one_time" ? "결제 금액" : "월 요금"}
              </p>
              <p className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-[var(--ink)]">
                {plan.billingType === "one_time" ? won(plan.totalPrice) : `월 ${won(plan.monthlyPrice)}`}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-medium text-[var(--mid)]">다음 결제 기준일</p>
              <p className="text-[15px] font-semibold text-[var(--ink)]">{formatDate(endAt)}</p>
            </div>
            {paymentMethodLabel ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-[var(--mid)]">결제수단</p>
                <p className="text-[15px] font-semibold text-[var(--ink)]">{paymentMethodLabel}</p>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] leading-[1.5] tracking-[-0.02em] text-[var(--mid)]">{message}</p>

        <AppButton
          fullWidth
          className="mt-8 h-[48px] rounded-[9px] bg-[#1677ff] text-[15px] font-semibold text-white shadow-none hover:bg-[#0e65d8]"
          onClick={onConfirm}
        >
          확인
        </AppButton>
      </section>
    </div>
  );
}
