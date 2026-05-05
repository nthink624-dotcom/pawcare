"use client";

import { CheckCircle2, X } from "lucide-react";

import { AppButton } from "@/components/ui/app-button";
import { getOwnerPlanDisplayName, type OwnerPlan } from "@/lib/billing/owner-plans";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function getPlanSummaryLine(plan: OwnerPlan) {
  if (plan.code === "monthly") {
    return "총 12,900원";
  }

  return plan.totalLabel ?? `총 ${won(plan.totalPrice)}`;
}

export function OwnerBillingSuccessCard({
  plan,
  endAt,
  paymentMethodLabel,
  message,
  onConfirm,
  onClose,
}: {
  plan: OwnerPlan;
  endAt: string | null;
  paymentMethodLabel?: string | null;
  message: string;
  onConfirm?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="owner-font mx-auto w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#171411]">
      <section className="rounded-[28px] border border-[#ded6cb] bg-white px-6 pb-6 pt-5 shadow-[0_18px_48px_rgba(33,30,26,0.12)]">
        {onClose ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#7f776d]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <div className="mx-auto -mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#eef7f3] text-[#1f6b5b] shadow-[0_12px_28px_rgba(31,91,81,0.12)]">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
        </div>

        <p className="mt-5 text-center text-[12px] font-semibold tracking-[0.08em] text-[#5a8d82]">PAYMENT COMPLETE</p>
        <h1 className="mt-3 text-center text-[31px] font-extrabold leading-[1.16] tracking-[-0.04em] text-[#171411]">
          결제가 완료되었습니다
        </h1>
        <p className="mt-4 text-center text-[18px] font-semibold tracking-[-0.03em] text-[#173b33]">
          펫매니저를 선택해주셔서 감사합니다.
        </p>
        <p className="mx-auto mt-5 max-w-[296px] whitespace-pre-line text-center text-[14px] leading-[1.58] tracking-[-0.02em] text-[#666056]">
          {"선택하신 플랜이 적용되어 지금 바로\n서비스를 이용하실 수 있어요."}
        </p>

        <div className="mt-8 rounded-[24px] border border-[#e5ddd2] bg-[#fcfaf6] px-4 py-4 text-left">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#ece4d8] pb-3">
            <div>
              <p className="text-[13px] font-semibold text-[#7b7369]">적용 플랜</p>
              <p className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-[#173b33]">
                {getOwnerPlanDisplayName(plan.code)}
              </p>
              <p className="mt-1 text-[13px] text-[#7b7369]">{getPlanSummaryLine(plan)}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[#7b7369]">
                {plan.billingType === "one_time" ? "결제 금액" : "월 요금"}
              </p>
              <p className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-[#171411]">
                {plan.billingType === "one_time" ? won(plan.totalPrice) : `월 ${won(plan.monthlyPrice)}`}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-medium text-[#7b7369]">서비스 종료일</p>
              <p className="text-[15px] font-semibold text-[#171411]">{formatDate(endAt)}</p>
            </div>
            {paymentMethodLabel ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-[#7b7369]">결제수단</p>
                <p className="text-[15px] font-semibold text-[#171411]">{paymentMethodLabel}</p>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] leading-[1.5] tracking-[-0.02em] text-[#7a736b]">{message}</p>

        <AppButton
          fullWidth
          className="mt-8 h-[58px] rounded-[18px] bg-[#1f5b51] text-[17px] font-semibold text-white shadow-[0_12px_28px_rgba(31,91,81,0.18)]"
          onClick={onConfirm}
        >
          확인
        </AppButton>
      </section>
    </div>
  );
}
