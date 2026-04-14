"use client";

import { CheckCircle2, ChevronLeft, CreditCard, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  issueOwnerBillingKey,
  requestOwnerOneTimePayment,
  retryOwnerSubscriptionPayment,
} from "@/lib/billing/owner-billing-client";
import { getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";
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

function PlanCard({
  planCode,
  selected,
  current,
  featured,
  onSelect,
}: {
  planCode: OwnerPlanCode;
  selected: boolean;
  current: boolean;
  featured?: boolean;
  onSelect: (code: OwnerPlanCode) => void;
}) {
  const plan = getOwnerPlanByCode(planCode);
  if (!plan) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.code)}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
        selected ? "border-[#0b4d3f] bg-[#f7fcfa]" : "border-[#ddd5c7] bg-[#fffdfa]"
      } ${featured ? "shadow-[0_10px_24px_rgba(11,77,63,0.08)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[17px] font-bold text-[#111111]">{plan.name}</p>
            {featured ? (
              <span className="rounded-full border border-[#0b4d3f] bg-[#eef8f3] px-2.5 py-1 text-[11px] font-semibold text-[#0b4d3f]">
                가장 많이 선택
              </span>
            ) : null}
            {current ? (
              <span className="rounded-full border border-[#d6d0c5] bg-[#f7f3ed] px-2.5 py-1 text-[11px] font-semibold text-[#665e54]">
                현재 선택됨
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            <span className="rounded-full border border-[#d8d1c5] bg-white px-3 py-1 text-[#575149]">{plan.billingLabel}</span>
            {plan.dailyPriceText ? (
              <span className="rounded-full border border-[#d8d1c5] bg-white px-3 py-1 text-[#575149]">{plan.dailyPriceText}</span>
            ) : null}
            <span className="rounded-full border border-[#d8d1c5] bg-white px-3 py-1 text-[#575149]">
              {plan.discountPercent > 0 ? `${plan.discountPercent}% 할인` : "기본 요금"}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[22px] font-extrabold tracking-[-0.03em] text-[#173b33]">월 {won(plan.monthlyPrice)}</p>
          <p className="mt-1 text-[12px] font-semibold text-[#6a6259]">{plan.totalLabel ?? "일반결제"}</p>
        </div>
      </div>
    </button>
  );
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
  const [registeringCard, setRegisteringCard] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const copy = statusCopy(summary);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = useMemo(() => getOwnerPlanByCode(selectedPlanCode) ?? initialSummary.currentPlan, [initialSummary.currentPlan, selectedPlanCode]);
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
        customerName: summary.ownerName || "멍매니저 사장님",
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
        customerName: summary.ownerName || "멍매니저 사장님",
        phoneNumber: summary.ownerPhoneNumber,
        email: summary.ownerEmail,
        planCode: selectedPlanCode,
        amount: selectedPlan.totalPrice,
        orderName: `${selectedPlan.title} 멍매니저 이용권`,
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

  const primaryAction = usesOneTimePayment
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

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#111111]">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/owner");
        }}
        className="mb-5 inline-flex items-center gap-1 rounded-full border border-[#d8d1c5] bg-white px-3 py-2 text-sm font-semibold text-[#335a50]"
      >
        <ChevronLeft className="h-4 w-4" />
        이전
      </button>

      <section className="rounded-[28px] border border-[#dfd8cc] bg-[#fffdf8] px-5 py-5 shadow-[0_14px_32px_rgba(41,41,38,0.06)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">멍매니저 플랜 및 결제</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#173b33]">선택한 플랜을 확인해 주세요</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#615d56]">{copy.body}</p>

        <div className="relative mt-5 rounded-[22px] border border-[#1f5b51] bg-[#fffdf9] px-4 py-3.5 shadow-[0_8px_18px_rgba(23,59,51,0.05)]">
          {selectedPlan.discountPercent > 0 ? (
            <span className="absolute -top-[13px] right-4 rounded-[10px] border border-[#0b4d3f] bg-[#1f5b51] px-3 py-1 text-[10px] font-semibold tracking-[0.01em] text-white shadow-sm">
              {selectedPlan.badge ?? `약 ${selectedPlan.discountPercent}% 할인`}
            </span>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <p className="text-[22px] font-extrabold tracking-[-0.04em] text-[#173b33]">{selectedPlan.shortTitle} 플랜</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {selectedPlan.dailyPriceText ? (
                  <span className="rounded-full border border-[#d9d2c7] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#665e54]">{selectedPlan.dailyPriceText}</span>
                ) : null}
                {selectedPlan.billingType === "one_time" ? (
                  <span className="rounded-full border border-[#d9d2c7] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#665e54]">일반결제</span>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[28px] font-extrabold tracking-[-0.05em] text-[#18211f]">월 {won(selectedPlan.monthlyPrice)}</p>
              <p className="mt-1 text-[13px] font-semibold text-[#6a6259]">
                {selectedPlan.billingType === "one_time" ? "1개월 이용" : selectedPlan.totalLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-[#dcd5ca] bg-[#fffdf9] px-4 py-4 shadow-[0_10px_24px_rgba(23,59,51,0.05)]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#d8d1c5] bg-white text-[#1f5b51]">
              <CreditCard className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[#173b33]">신용/체크카드</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6e6a61]">
                {usesOneTimePayment
                  ? "1개월 플랜은 일반결제로 한 번 결제하고 바로 시작합니다."
                  : "약정 플랜은 카드 등록 후 매달 자동 청구로 이어집니다."}
              </p>
            </div>
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef8f3] text-[#1f5b51]">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="flex h-[56px] w-full items-center justify-center rounded-[18px] bg-[#12a06b] px-4 text-[16px] font-semibold text-white shadow-[0_6px_0_#0b4d3f] disabled:opacity-60"
          >
            {primaryAction.label}
          </button>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-[18px] border border-[#d8d1c5] bg-white px-4 py-3 text-sm text-[#4a4640]">{message}</p> : null}
    </div>
  );
}





