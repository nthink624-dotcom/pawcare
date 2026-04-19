"use client";

import { CreditCard } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  issueOwnerBillingKey,
  requestOwnerOneTimePayment,
  retryOwnerSubscriptionPayment,
} from "@/lib/billing/owner-billing-client";
import { billableOwnerPlans, getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { env } from "@/lib/env";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function statusCopy(summary: OwnerSubscriptionSummary) {
  if (summary.status === "past_due") {
    return {
      title: "결제가 완료되지 않았습니다",
      body: "카드 정보를 다시 확인하고 결제를 진행하면 바로 다시 사용할 수 있어요.",
    };
  }

  if (summary.status === "expired") {
    return {
      title: "무료체험이 종료되었습니다",
      body: "자동결제는 되지 않습니다. 계속 사용하려면 플랜을 확인하고 결제를 진행해 주세요.",
    };
  }

  if (summary.noticeLevel === "1day") {
    return {
      title: "내일 무료체험이 종료됩니다",
      body: "종료 후 계속 사용하려면 플랜을 확인하고 결제를 준비해 두세요.",
    };
  }

  if (summary.noticeLevel === "3days") {
    return {
      title: `무료체험이 ${summary.daysUntilTrialEnds}일 후 종료됩니다`,
      body: "카드 등록 없이 시작했고, 종료 후 계속 사용하려면 그때 결제하면 됩니다.",
    };
  }

  if (summary.status === "active") {
    return {
      title: "현재 플랜을 이용 중입니다",
      body: "지금 사용 중인 플랜, 이용 종료일, 결제수단을 여기서 확인할 수 있어요.",
    };
  }

  return {
    title: "무료체험이 진행 중입니다",
    body: "무료체험이 진행 중입니다.",
  };
}

export default function OwnerBillingScreen({
  initialSummary,
  preferredPlanCode,
}: {
  initialSummary: OwnerSubscriptionSummary;
  preferredPlanCode?: OwnerPlanCode | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [selectedPlanCode, setSelectedPlanCode] = useState<OwnerPlanCode>(preferredPlanCode ?? initialSummary.currentPlanCode);
  const [isSelectingPlan, setIsSelectingPlan] = useState(!preferredPlanCode);
  const [registeringCard, setRegisteringCard] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const copy = statusCopy(summary);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = useMemo(() => getOwnerPlanByCode(selectedPlanCode) ?? initialSummary.currentPlan, [initialSummary.currentPlan, selectedPlanCode]);
  const isFreePlan = selectedPlan.code === "free";
  const usesOneTimePayment = selectedPlan.billingType === "one_time";

  async function handleRegisterCard() {
    if (registeringCard || retryingPayment) return;
    if (!env.portoneBillingChannelKey) {
      setMessage("PortOne 정기결제 채널 설정을 먼저 확인해 주세요.");
      return;
    }

    setRegisteringCard(true);
    setRetryingPayment(true);
    setMessage(null);

    try {
      const registeredSummary = await issueOwnerBillingKey({
        customerId: `owner_${summary.userId}`,
        customerName: summary.ownerName || "펫매니저 사장님",
        phoneNumber: summary.ownerPhoneNumber,
        email: summary.ownerEmail,
        planCode: selectedPlanCode,
      });

      setSummary(registeredSummary);
      setSelectedPlanCode(registeredSummary.currentPlanCode);

      const paidSummary = await retryOwnerSubscriptionPayment();
      setSummary(paidSummary);
      setSelectedPlanCode(paidSummary.currentPlanCode);
      setMessage(
        paidSummary.lastPaymentStatus === "paid"
          ? "카드 등록 후 결제가 완료되어 바로 사용할 수 있어요."
          : "카드 등록은 완료됐지만 결제를 완료하지 못했습니다. 다시 확인해 주세요.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "카드 등록 또는 결제를 완료하지 못했습니다.");
    } finally {
      setRegisteringCard(false);
      setRetryingPayment(false);
    }
  }

  async function handlePayNow() {
    if (retryingPayment) return;
    setRetryingPayment(true);
    setMessage(null);
    try {
      const nextSummary = await retryOwnerSubscriptionPayment();
      setSummary(nextSummary);
      setSelectedPlanCode(nextSummary.currentPlanCode);
      setMessage(nextSummary.lastPaymentStatus === "paid" ? "결제가 완료되어 바로 사용할 수 있어요." : "결제를 완료하지 못했습니다. 카드 정보를 다시 확인해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "결제를 처리하지 못했습니다.");
    } finally {
      setRetryingPayment(false);
    }
  }

  async function handleOneTimePayment() {
    if (retryingPayment) return;

    setRetryingPayment(true);
    setMessage(null);

    try {
      const nextSummary = await requestOwnerOneTimePayment({
        customerId: `owner_${summary.userId}`,
        customerName: summary.ownerName || "펫매니저 사장님",
        phoneNumber: summary.ownerPhoneNumber,
        email: summary.ownerEmail,
        planCode: selectedPlanCode,
        amount: selectedPlan.totalPrice,
        orderName: `${selectedPlan.title} 펫매니저 이용권`,
      });

      setSummary(nextSummary);
      setSelectedPlanCode(nextSummary.currentPlanCode);
      setMessage("결제가 완료되어 바로 사용할 수 있어요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "결제를 완료하지 못했습니다.");
    } finally {
      setRetryingPayment(false);
    }
  }

  const primaryAction = isFreePlan
    ? {
        label: "무료플랜 이용 중",
        onClick: () => undefined,
        disabled: true,
      }
    : usesOneTimePayment
    ? {
        label: retryingPayment ? "처리 중..." : "계속하기",
        onClick: handleOneTimePayment,
        disabled: retryingPayment,
      }
    : summary.paymentMethodExists
    ? {
        label: retryingPayment ? "처리 중..." : "계속하기",
        onClick: handlePayNow,
        disabled: retryingPayment,
      }
    : {
        label: registeringCard ? "처리 중..." : "계속하기",
        onClick: handleRegisterCard,
        disabled: registeringCard,
      };

  if (isSelectingPlan) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#111111]">
        <section className="rounded-[28px] border border-[#dfd8cc] bg-[#fffdf8] px-5 py-6 shadow-[0_10px_30px_rgba(41,41,38,0.05)]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">펫매니저 플랜 선택</p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#173b33]">사용할 플랜을 골라주세요</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#615d56]">
            무료체험이 끝난 뒤 계속 사용하려면 먼저 플랜을 선택해 주세요.
          </p>

          <div className="mt-5 space-y-3">
            {billableOwnerPlans.map((plan) => {
              const selected = selectedPlanCode === plan.code;

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                    selected
                      ? "border-[#1f5b51] bg-[#f4faf7] shadow-[0_10px_24px_rgba(31,107,91,0.08)]"
                      : "border-[#d9d2c7] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[22px] font-extrabold tracking-[-0.03em] text-[#173b33]">{plan.shortTitle} 플랜</p>
                      <p className="mt-2 text-[14px] leading-6 text-[#6e6a61]">{plan.billingLabel}</p>
                      <p className="mt-2 text-[13px] leading-5 text-[#6e6a61]">{plan.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[24px] font-extrabold tracking-[-0.04em] text-[#18211f]">월 {won(plan.monthlyPrice)}</p>
                      <p className="mt-1 text-[12px] font-medium text-[#1f5b51]">{plan.shortTitle} 이용</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-2.5">
            <button
              type="button"
              onClick={() => setIsSelectingPlan(false)}
              className="flex h-[56px] w-full items-center justify-center rounded-[18px] bg-[#1f5b51] px-4 text-[16px] font-semibold text-white"
            >
              선택한 플랜 확인하기
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push("/owner");
              }}
              className="flex h-[56px] w-full items-center justify-center rounded-[18px] border border-[#ddd6ca] bg-white px-4 text-[15px] font-semibold text-[#1f5b51]"
            >
              이전으로 돌아가기
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#111111]">
      <section className="rounded-[28px] border border-[#dfd8cc] bg-[#fffdf8] px-5 py-6 shadow-[0_10px_30px_rgba(41,41,38,0.05)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">펫매니저 플랜 및 결제</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#173b33]">선택한 플랜을 확인해 주세요</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#615d56]">{copy.body}</p>

        <div className="mt-5 rounded-[22px] border border-[#d9d2c7] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#111111]">현재 선택된 플랜</p>
          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-[#173b33]">{selectedPlan.shortTitle} 플랜</p>
          <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[#18211f]">월 {won(selectedPlan.monthlyPrice)}</p>
          <p className="mt-1 text-sm leading-6 text-[#6e6a61]">
            무료체험 종료일 {formatDate(summary.trialEndsAt)}
            {summary.currentPeriodEndsAt ? ` · 현재 이용 종료일 ${formatDate(summary.currentPeriodEndsAt)}` : ""}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-[#6e6a61]">
            {isFreePlan
              ? "무료플랜은 관리자 배정용 플랜입니다. 유료 결제로 전환하려면 플랜을 변경해 주세요."
              : usesOneTimePayment
              ? "1개월 플랜은 한 번 결제하고 바로 시작할 수 있습니다."
              : `${selectedPlan.months}개월 플랜은 카드 등록 후 이용 기간 동안 계속 사용할 수 있습니다.`}
          </p>
        </div>

        <div className="mt-4 rounded-[22px] border border-[#d9d2c7] bg-white px-4 py-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#d8d1c5] bg-[#fffdf8] text-[#1f5b51]">
              <CreditCard className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[#173b33]">신용/체크카드</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6e6a61]">
                {isFreePlan
                  ? "무료플랜은 결제가 필요하지 않습니다."
                  : usesOneTimePayment
                  ? "1개월 플랜은 일반결제로 한 번 결제하고 바로 시작합니다."
                  : "약정 플랜은 카드 등록 후 매달 자동 청구로 이어집니다."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="flex h-[56px] w-full items-center justify-center rounded-[18px] bg-[#1f5b51] px-4 text-[16px] font-semibold text-white disabled:opacity-60"
          >
            {primaryAction.label}
          </button>
          <button
            type="button"
            onClick={() => setIsSelectingPlan(true)}
            className="flex h-[56px] w-full items-center justify-center rounded-[18px] border border-[#ddd6ca] bg-white px-4 text-[15px] font-semibold text-[#1f5b51]"
          >
            플랜 다시 선택하기
          </button>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-[18px] border border-[#d8d1c5] bg-white px-4 py-3 text-sm text-[#4a4640]">{message}</p> : null}
    </div>
  );
}





