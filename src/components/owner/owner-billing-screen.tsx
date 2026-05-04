"use client";

import { CreditCard, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  OwnerBillingAgreementStep,
} from "@/components/owner/owner-billing-flow-shared";
import { OwnerBillingPlanPicker } from "@/components/owner/owner-billing-plan-picker";
import {
  issueOwnerBillingKey,
  requestOwnerOneTimePayment,
  saveOwnerSubscriptionPreferences,
  retryOwnerSubscriptionPayment,
} from "@/lib/billing/owner-billing-client";
import { billableOwnerPlans, getOwnerPlanByCode, getOwnerPlanDisplayName, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { addDaysIso, addMonthsIso, type OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { env } from "@/lib/env";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function formatServiceEndDate(summary: OwnerSubscriptionSummary) {
  return formatDate(summary.currentPeriodEndsAt ?? summary.trialEndsAt);
}

function formatProjectedServiceEndDate(
  summary: OwnerSubscriptionSummary,
  plan: NonNullable<ReturnType<typeof getOwnerPlanByCode>>,
) {
  if (plan.code === "free") {
    return formatServiceEndDate(summary);
  }

  const now = Date.now();
  const currentPeriodEndsAt =
    summary.currentPeriodEndsAt && new Date(summary.currentPeriodEndsAt).getTime() > now
      ? summary.currentPeriodEndsAt
      : null;
  const billingStartAt = currentPeriodEndsAt ?? new Date().toISOString();
  const nextBoundaryAt = addMonthsIso(billingStartAt, Math.max(plan.months, 1));
  const displayEndsAt = addDaysIso(nextBoundaryAt, -1);

  return formatDate(displayEndsAt);
}

function getPlanSelectionLine(plan: NonNullable<ReturnType<typeof getOwnerPlanByCode>>) {
  switch (plan.code) {
    case "monthly":
      return "총 12,900원";
    case "quarterly":
    case "halfyearly":
    case "yearly":
      return plan.totalLabel ?? `총 ${won(plan.totalPrice)}`;
    default:
      return `총 ${won(plan.totalPrice)}`;
  }
}

function hasSuccessfulPayment(summary: OwnerSubscriptionSummary) {
  return summary.lastPaymentStatus === "paid" || summary.status === "active";
}

function getCardNumberHint(label: string | null | undefined) {
  const match = label?.match(/(\d{3,4})/);
  if (!match) return null;
  return `앞자리 ${match[1]}`;
}

function PaymentOptionRow({
  icon,
  title,
  description,
  selected,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 py-4 text-left transition ${
        disabled ? "cursor-not-allowed opacity-55" : "hover:bg-[#fbf8f3]"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#171411]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold tracking-[-0.03em] text-[#171411]">{title}</p>
        <p className="mt-1 text-[12px] leading-[1.45] text-[#6a645d]">{description}</p>
      </div>
      <span
        className={`mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-[#1f5b51]" : "border-[#d4ccc0]"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${selected ? "bg-[#1f5b51]" : "bg-transparent"}`} />
      </span>
    </button>
  );
}

const OWNER_BILLING_PENDING_KEY = "owner-billing:pending-register-and-pay";

function storePendingBillingRegistration(planCode: OwnerPlanCode) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    OWNER_BILLING_PENDING_KEY,
    JSON.stringify({
      planCode,
      requestedAt: Date.now(),
    }),
  );
}

function readPendingBillingRegistration(): { planCode: OwnerPlanCode; requestedAt: number } | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(OWNER_BILLING_PENDING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { planCode?: OwnerPlanCode; requestedAt?: number };
    if (!parsed.planCode || typeof parsed.requestedAt !== "number") {
      return null;
    }
    return {
      planCode: parsed.planCode,
      requestedAt: parsed.requestedAt,
    };
  } catch {
    return null;
  }
}

function clearPendingBillingRegistration() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(OWNER_BILLING_PENDING_KEY);
}

function buildBillingSuccessUrl(summary: OwnerSubscriptionSummary) {
  const params = new URLSearchParams();
  params.set("plan", summary.currentPlanCode);
  if (summary.currentPeriodEndsAt) {
    params.set("endAt", summary.currentPeriodEndsAt);
  } else if (summary.trialEndsAt) {
    params.set("endAt", summary.trialEndsAt);
  }
  if (summary.paymentMethodLabel) {
    params.set("method", summary.paymentMethodLabel);
  }
  return `/owner/billing/success?${params.toString()}`;
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
      title: summary.currentPlanCode === "free" ? "체험 플랜이 종료되었습니다" : "이용 기간이 종료되었습니다",
      body: "자동결제는 되지 않습니다. 계속 사용하려면 플랜을 확인하고 결제를 진행해 주세요.",
    };
  }

  if (summary.noticeLevel === "1day") {
    return {
      title: "내일 체험 플랜이 종료됩니다",
      body: "종료 후 계속 사용하려면 플랜을 확인하고 결제를 준비해 두세요.",
    };
  }

  if (summary.noticeLevel === "3days") {
    return {
      title: `펫매니저 이용 기간이 ${summary.daysUntilTrialEnds}일 남았어요`,
      body: "이용 기간이 끝나면 예약·고객관리 기능 이용이 제한될 수 있습니다.\n서비스를 계속 이용하시려면 플랜 연장이 필요합니다.",
    };
  }

  if (summary.status === "active") {
    return {
      title: "현재 플랜을 이용 중입니다",
      body: "지금 사용 중인 플랜, 이용 종료일, 결제수단을 여기서 확인할 수 있어요.",
    };
  }

  return {
    title: "체험 플랜이 진행 중입니다",
    body: "체험 플랜이 진행 중입니다.",
  };
}

export default function OwnerBillingScreen({
  initialSummary,
  preferredPlanCode,
  forcePlanPicker = false,
  openPaymentSheet = false,
}: {
  initialSummary: OwnerSubscriptionSummary;
  preferredPlanCode?: OwnerPlanCode | null;
  forcePlanPicker?: boolean;
  openPaymentSheet?: boolean;
}) {
  const router = useRouter();
  const featuredPlan = useMemo(
    () => billableOwnerPlans.find((plan) => plan.featured) ?? billableOwnerPlans[billableOwnerPlans.length - 1],
    [],
  );
  const [summary, setSummary] = useState(initialSummary);
  const [selectedPlanCode, setSelectedPlanCode] = useState<OwnerPlanCode>(
    preferredPlanCode ?? (forcePlanPicker ? featuredPlan.code : initialSummary.currentPlanCode),
  );
  const [isSelectingPlan, setIsSelectingPlan] = useState(forcePlanPicker || !preferredPlanCode);
  const [selectionStep, setSelectionStep] = useState<"plan" | "agreement">(
    openPaymentSheet ? "agreement" : "plan",
  );
  const [registeringCard, setRegisteringCard] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<"existing" | "new">(
    initialSummary.paymentMethodExists && !initialSummary.paymentMethodResetRequired ? "existing" : "new",
  );
  const [resumingRegisteredCardPayment, setResumingRegisteredCardPayment] = useState(false);
  const copy = statusCopy(summary);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = useMemo(() => getOwnerPlanByCode(selectedPlanCode) ?? initialSummary.currentPlan, [initialSummary.currentPlan, selectedPlanCode]);
  const isFreePlan = selectedPlan.code === "free";
  const usesOneTimePayment = selectedPlan.billingType === "one_time";
  const selectedPlanLabel = getOwnerPlanDisplayName(selectedPlan.code);
  const projectedServiceEndDate = formatProjectedServiceEndDate(summary, selectedPlan);
  const hasRegisteredPaymentMethod = summary.paymentMethodExists;
  const hasUsableRegisteredPaymentMethod = summary.paymentMethodExists && !summary.paymentMethodResetRequired;
  const registeredPaymentTitle =
    summary.paymentMethodLabel && summary.paymentMethodLabel.trim() && summary.paymentMethodLabel !== "등록된 카드"
      ? summary.paymentMethodLabel
      : hasUsableRegisteredPaymentMethod
        ? "등록 카드"
        : "카드 정보 확인 필요";
  const registeredPaymentDescription = summary.paymentMethodResetRequired
    ? "기존 카드 정보를 다시 확인할 수 없어 새 카드 등록이 한 번 필요해요."
    : getCardNumberHint(summary.paymentMethodLabel)
      ? `${getCardNumberHint(summary.paymentMethodLabel)} 카드로 바로 결제를 진행합니다.`
      : "등록된 카드로 바로 결제를 진행합니다.";
  const emptyRegisteredPaymentTitle = "등록된 카드 없음";
  const emptyRegisteredPaymentDescription = "등록된 카드가 없어요. 아래 새 카드 등록으로 진행해 주세요.";

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    setSelectedPlanCode(preferredPlanCode ?? (forcePlanPicker ? featuredPlan.code : initialSummary.currentPlanCode));
    setIsSelectingPlan(forcePlanPicker || !preferredPlanCode);
    setSelectionStep(openPaymentSheet ? "agreement" : "plan");
    setAgreementAccepted(false);
  }, [featuredPlan.code, forcePlanPicker, initialSummary.currentPlanCode, openPaymentSheet, preferredPlanCode]);

  useEffect(() => {
    setSelectedPaymentOption(summary.paymentMethodExists && !summary.paymentMethodResetRequired ? "existing" : "new");
  }, [summary.paymentMethodExists, summary.paymentMethodResetRequired]);

  useEffect(() => {
    if (!openPaymentSheet || isFreePlan || !hasUsableRegisteredPaymentMethod) return;
    setPaymentSheetOpen(true);
  }, [hasUsableRegisteredPaymentMethod, isFreePlan, openPaymentSheet]);

  useEffect(() => {
    const pending = readPendingBillingRegistration();
    if (!pending) return;
    if (Date.now() - pending.requestedAt > 1000 * 60 * 20) {
      clearPendingBillingRegistration();
      return;
    }
    if (usesOneTimePayment || resumingRegisteredCardPayment || retryingPayment || !summary.paymentMethodExists) {
      return;
    }
    if (summary.status !== "expired" && summary.status !== "past_due") {
      clearPendingBillingRegistration();
      return;
    }

    let cancelled = false;
    const pendingPlanCode = pending.planCode;

    async function resumePayment() {
      setResumingRegisteredCardPayment(true);
      setMessage("등록한 카드로 결제를 이어서 진행하고 있어요.");

      try {
        if (pendingPlanCode !== summary.currentPlanCode) {
          const savedSummary = await saveOwnerSubscriptionPreferences({ currentPlanCode: pendingPlanCode });
          if (cancelled) return;
          setSummary(savedSummary);
          setSelectedPlanCode(savedSummary.currentPlanCode);
        }

        clearPendingBillingRegistration();

        const nextSummary = await retryOwnerSubscriptionPayment();
        if (cancelled) return;

        setSummary(nextSummary);
        setSelectedPlanCode(nextSummary.currentPlanCode);
        if (hasSuccessfulPayment(nextSummary)) {
          setMessage(null);
          router.replace(buildBillingSuccessUrl(nextSummary) as never);
        } else {
          setMessage("카드 등록은 완료됐지만 결제를 완료하지 못했습니다. 다시 확인해 주세요.");
        }
      } catch (error) {
        if (cancelled) return;
        clearPendingBillingRegistration();
        setMessage(error instanceof Error ? error.message : "카드 등록 후 결제를 이어서 진행하지 못했습니다.");
      } finally {
        if (!cancelled) {
          setResumingRegisteredCardPayment(false);
        }
      }
    }

    void resumePayment();

    return () => {
      cancelled = true;
    };
  }, [resumingRegisteredCardPayment, retryingPayment, summary, usesOneTimePayment]);

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
      await persistSelectedPlanIfNeeded();
      storePendingBillingRegistration(selectedPlanCode);

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
      clearPendingBillingRegistration();
      if (hasSuccessfulPayment(paidSummary)) {
        setMessage(null);
        router.replace(buildBillingSuccessUrl(paidSummary) as never);
      } else {
        setMessage("카드 등록은 완료됐지만 결제를 완료하지 못했습니다. 다시 확인해 주세요.");
      }
    } catch (error) {
      clearPendingBillingRegistration();
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
      if (hasSuccessfulPayment(nextSummary)) {
        setMessage(null);
        router.replace(buildBillingSuccessUrl(nextSummary) as never);
      } else {
        setMessage("결제를 완료하지 못했습니다. 카드 정보를 다시 확인해 주세요.");
      }
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
        userId: summary.userId,
        shopId: summary.shopId,
        planCode: selectedPlanCode,
        amount: selectedPlan.totalPrice,
        orderName: `펫매니저 ${selectedPlan.title} 결제`,
      });

      setSummary(nextSummary);
      setSelectedPlanCode(nextSummary.currentPlanCode);
      if (hasSuccessfulPayment(nextSummary)) {
        setMessage(null);
        router.replace(buildBillingSuccessUrl(nextSummary) as never);
      } else {
        setMessage("결제를 완료하지 못했습니다.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "결제를 완료하지 못했습니다.");
    } finally {
      setRetryingPayment(false);
    }
  }

  const primaryAction = isFreePlan
    ? {
        label: "체험 플랜 상태 확인",
        onClick: () => undefined,
        disabled: true,
      }
    : usesOneTimePayment
    ? {
        label: retryingPayment ? "처리 중..." : "결제하고 다시 이용하기",
        onClick: handleOneTimePayment,
        disabled: retryingPayment,
      }
    : hasUsableRegisteredPaymentMethod
    ? {
        label: retryingPayment ? "처리 중..." : "결제하고 다시 이용하기",
        onClick: handlePayNow,
        disabled: retryingPayment,
      }
    : {
        label: registeringCard ? "처리 중..." : "카드 등록하고 다시 이용하기",
        onClick: handleRegisterCard,
        disabled: registeringCard,
      };

  async function persistSelectedPlanIfNeeded() {
    if (selectedPlanCode === summary.currentPlanCode) {
      return summary;
    }

    const savedSummary = await saveOwnerSubscriptionPreferences({ currentPlanCode: selectedPlanCode });
    setSummary(savedSummary);
    return savedSummary;
  }

  async function handlePaymentSheetSubmit() {
    if (registeringCard || retryingPayment) return;

    try {
      if (selectedPaymentOption === "existing" && hasUsableRegisteredPaymentMethod) {
        await persistSelectedPlanIfNeeded();
        setPaymentSheetOpen(false);
        await handlePayNow();
        return;
      }

      setPaymentSheetOpen(false);
      await (usesOneTimePayment ? handleOneTimePayment() : handleRegisterCard());
    } catch {
      // Error messages are already handled in each payment action.
    }
  }

  if (isSelectingPlan) {
    if (selectionStep === "agreement") {
      return (
        <>
          <OwnerBillingAgreementStep
            selectedPlan={selectedPlan}
            agreed={agreementAccepted}
            onAgreeChange={setAgreementAccepted}
            onContinue={() => {
              if (!agreementAccepted) {
                setMessage("정기결제 안내 동의가 필요합니다.");
                return;
              }
              setMessage(null);

              if (hasUsableRegisteredPaymentMethod) {
                setPaymentSheetOpen(true);
                return;
              }

              void (usesOneTimePayment ? handleOneTimePayment() : handleRegisterCard());
            }}
            onBack={() => setSelectionStep("plan")}
            loading={registeringCard || retryingPayment}
            message={message}
          />

          {paymentSheetOpen ? (
            <div
              className="fixed inset-0 z-30 bg-[rgba(28,23,18,0.28)]"
              onClick={() => setPaymentSheetOpen(false)}
            >
              <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
                <div
                  className="w-full rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-16px_40px_rgba(32,27,22,0.14)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mx-auto h-1.5 w-11 rounded-full bg-[#dfd7cc]" />

                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#8c8378]">PAYMENT</p>
                      <p className="mt-2 text-[29px] font-extrabold leading-none tracking-[-0.05em] text-[#171411]">결제수단 선택</p>
                      <p className="mt-2.5 text-[13px] leading-[1.5] tracking-[-0.02em] text-[#6b655d]">
                        {usesOneTimePayment
                          ? "선택한 플랜을 바로 결제할 수 있는 수단을 선택해 주세요."
                          : "이번 기간 연장에 사용할 카드를 선택해 주세요."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentSheetOpen(false)}
                      aria-label="닫기"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5ddd2] text-[#7d756c]"
                    >
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <div className="mt-6 border-t border-[#ece6dc] pt-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5">
                      <div className="min-w-0">
                        <p className="text-[29px] font-extrabold leading-none tracking-[-0.05em] text-[#171411]">{selectedPlanLabel}</p>
                        <p className="mt-2 text-[13px] leading-none text-[#7b7369]">{getPlanSelectionLine(selectedPlan)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[29px] font-extrabold leading-none tracking-[-0.05em] text-[#171411]">월 {won(selectedPlan.monthlyPrice)}</p>
                        <p className="mt-2 text-[13px] leading-none text-[#7b7369]">{usesOneTimePayment ? "1회 결제" : "자동결제"}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2.5 border-t border-[#ece6dc] pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-medium text-[#7c746a]">총 금액</p>
                        <p className="text-[13px] font-semibold text-[#171411]">{getPlanSelectionLine(selectedPlan)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-medium text-[#7c746a]">서비스 종료일</p>
                        <p className="text-[13px] font-semibold text-[#171411]">{projectedServiceEndDate}</p>
                      </div>
                    </div>
                  </div>

                    <div className="mt-4 border-t border-[#ece6dc]">
                      <div className="border-b border-[#ece6dc]">
                        <PaymentOptionRow
                          icon={<CreditCard className="h-[18px] w-[18px]" />}
                          title={hasRegisteredPaymentMethod ? registeredPaymentTitle : emptyRegisteredPaymentTitle}
                          description={
                            hasRegisteredPaymentMethod
                              ? registeredPaymentDescription
                              : emptyRegisteredPaymentDescription
                          }
                          selected={selectedPaymentOption === "existing" && hasUsableRegisteredPaymentMethod}
                          disabled={!hasUsableRegisteredPaymentMethod}
                          onClick={() => {
                            if (hasUsableRegisteredPaymentMethod) {
                              setSelectedPaymentOption("existing");
                            }
                          }}
                        />
                      </div>

                      <PaymentOptionRow
                        icon={<Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />}
                        title="새 카드 등록"
                        description={
                          usesOneTimePayment
                            ? "새 카드를 등록하고 이번 결제를 바로 진행합니다."
                            : "새 카드를 등록하고 결제를 이어갑니다."
                        }
                        selected={selectedPaymentOption === "new"}
                        onClick={() => setSelectedPaymentOption("new")}
                      />
                    </div>

                  {!usesOneTimePayment ? (
                    <p className="mt-3 text-[11px] leading-[1.45] text-[#7a736b]">
                      카드사 알림에는 ‘KG이니시스 정기과금’으로 표시될 수 있으며, 펫매니저 이용요금입니다.
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handlePaymentSheetSubmit()}
                      disabled={registeringCard || retryingPayment}
                      className="flex h-[54px] w-full items-center justify-center rounded-[18px] bg-[#1f5b51] px-4 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(31,91,81,0.12)] disabled:opacity-60"
                    >
                      {registeringCard
                        ? "카드 등록 중..."
                        : retryingPayment
                          ? "결제 진행 중..."
                          : selectedPaymentOption === "existing" && hasRegisteredPaymentMethod
                            ? "계속하기"
                            : usesOneTimePayment
                              ? "결제창 열기"
                              : "선택한 수단으로 계속하기"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      );
    }

      return (
        <>
        <OwnerBillingPlanPicker
          plans={billableOwnerPlans}
          selectedPlanCode={selectedPlanCode}
          onSelectPlanCode={setSelectedPlanCode}
          onContinue={() => {
            setMessage(null);
            setSelectionStep("agreement");
          }}
          onBack={() => {
            if (window.history.length > 1) router.back();
            else router.push("/owner");
          }}
          loading={registeringCard || retryingPayment}
          message={message}
        />
      </>
    );
  }

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#111111]">
      <section className="rounded-[28px] border border-[#dfd8cc] bg-[#fffdf8] px-5 py-6 shadow-[0_10px_30px_rgba(41,41,38,0.05)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">펫매니저 플랜 및 결제</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#173b33]">다시 이용할 플랜을 확인해 주세요</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#615d56]">{copy.body}</p>

        <div className="mt-5 rounded-[22px] border border-[#d9d2c7] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#111111]">현재 선택된 플랜</p>
          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-[#173b33]">{selectedPlanLabel}</p>
          <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[#18211f]">월 {won(selectedPlan.monthlyPrice)}</p>
          <p className="mt-1 text-sm leading-6 text-[#6e6a61]">예상 서비스 종료일 {projectedServiceEndDate}</p>
          <p className="mt-2 text-[13px] leading-5 text-[#6e6a61]">
            {isFreePlan
              ? "체험 플랜은 관리자 배정용 플랜입니다. 유료 결제로 전환하려면 플랜을 변경해 주세요."
              : usesOneTimePayment
              ? "한 달 플랜은 한 번 결제하고 바로 시작할 수 있습니다."
              : `${selectedPlanLabel}은 카드 등록 후 이용 기간 동안 계속 사용할 수 있습니다.`}
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
                  ? "체험 플랜은 결제가 필요하지 않습니다."
                  : usesOneTimePayment
                  ? "한 달 플랜은 일반결제로 한 번 결제하고 바로 시작합니다."
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





