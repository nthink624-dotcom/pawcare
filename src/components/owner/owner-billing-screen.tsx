"use client";

import { CalendarX2, CreditCard, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { OwnerBillingPlanPicker } from "@/components/owner/owner-billing-plan-picker";
import {
  BillingConsent,
  OwnerBillingCardRegistrationForm,
  PaymentMethodSheet,
  type OwnerBillingCardCredentials,
  type PaymentMethodOption,
} from "@/features/billing";
import {
  cancelOwnerSubscriptionRenewal,
  issueOwnerBillingKeyByApi,
  requestOwnerOneTimePayment,
  saveOwnerSubscriptionPreferences,
  retryOwnerSubscriptionPayment,
} from "@/lib/billing/owner-billing-client";
import {
  billableOwnerPlans,
  calculateOwnerBillingAmountBreakdown,
  getOwnerPlanByCode,
  getOwnerPlanDisplayName,
  getOwnerPlanStaffLimitLabel,
  type OwnerPlanCode,
} from "@/lib/billing/owner-plans";
import { addDaysIso, addMonthsIso, type OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { env } from "@/lib/env";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const datePart = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? `${datePart.slice(2, 4)}.${datePart.slice(5, 7)}.${datePart.slice(8, 10)}` : datePart.replace(/-/g, ".");
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

function hasSuccessfulPayment(summary: OwnerSubscriptionSummary) {
  return summary.lastPaymentStatus === "paid" || summary.status === "active";
}

function getCardNumberHint(label: string | null | undefined) {
  const match = label?.match(/(\d{3,4})/);
  if (!match) return null;
  return `앞자리 ${match[1]}`;
}

const OWNER_BILLING_PENDING_KEY = "owner-billing:pending-register-and-pay";
const cancellationReasons = [
  "가격 부담이 큽니다",
  "당분간 사용을 쉬려고 합니다",
  "필요한 기능이 부족합니다",
  "다른 방식으로 운영하려고 합니다",
  "기타",
];

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

function getDefaultPickerPlanCode(currentPlanCode: OwnerPlanCode, fallbackPlanCode: OwnerPlanCode) {
  if (currentPlanCode === "free" || currentPlanCode === "monthly") {
    return "quarterly";
  }

  if (currentPlanCode === "halfyearly") {
    return "quarterly";
  }

  return currentPlanCode || fallbackPlanCode;
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
  if (summary.cancelAtPeriodEnd) {
    return {
      title: "정기결제가 취소되었습니다",
      body: "현재 이용 기간까지는 계속 사용할 수 있고, 다음 결제일부터 자동 결제가 중단됩니다.",
    };
  }

  if (summary.status === "past_due") {
    return {
      title: "결제가 완료되지 않았습니다",
      body: "카드 정보를 다시 확인하고 결제를 진행하면 바로 다시 사용할 수 있어요.",
    };
  }

  if (summary.status === "expired") {
    return {
      title: summary.currentPlanCode === "free" ? "체험 플랜이 종료되었습니다" : "이용 기간이 종료되었습니다",
      body: "계속 사용하려면 매장 규모에 맞는 요금제를 선택하고 결제를 진행해 주세요.",
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
      body: "이용 기간이 끝나면 예약·고객 관리 기능 이용이 제한될 수 있습니다.\n서비스를 계속 이용하시려면 플랜 연장이 필요합니다.",
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
  showPaymentRequiredNotice = false,
}: {
  initialSummary: OwnerSubscriptionSummary;
  preferredPlanCode?: OwnerPlanCode | null;
  forcePlanPicker?: boolean;
  openPaymentSheet?: boolean;
  showPaymentRequiredNotice?: boolean;
}) {
  const router = useRouter();
  const featuredPlan = useMemo(
    () => billableOwnerPlans.find((plan) => plan.featured) ?? billableOwnerPlans[billableOwnerPlans.length - 1],
    [],
  );
  const defaultPickerPlanCode = useMemo(
    () => getDefaultPickerPlanCode(initialSummary.currentPlanCode, featuredPlan.code),
    [featuredPlan.code, initialSummary.currentPlanCode],
  );
  const [summary, setSummary] = useState(initialSummary);
  const [selectedPlanCode, setSelectedPlanCode] = useState<OwnerPlanCode>(
    preferredPlanCode ?? (forcePlanPicker ? defaultPickerPlanCode : initialSummary.currentPlanCode),
  );
  const [isSelectingPlan, setIsSelectingPlan] = useState((forcePlanPicker || !preferredPlanCode) && !showPaymentRequiredNotice);
  const [selectionStep, setSelectionStep] = useState<"plan" | "agreement">(
    openPaymentSheet ? "agreement" : "plan",
  );
  const [registeringCard, setRegisteringCard] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [cancellingRenewal, setCancellingRenewal] = useState(false);
  const [cancelRenewalDialogOpen, setCancelRenewalDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [cardRegistrationOpen, setCardRegistrationOpen] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<"saved" | "new">(
    initialSummary.paymentMethodExists && !initialSummary.paymentMethodResetRequired ? "saved" : "new",
  );
  const [resumingRegisteredCardPayment, setResumingRegisteredCardPayment] = useState(false);
  const copy = statusCopy(summary);
  const [message, setMessage] = useState<string | null>(null);
  const agreementContinueRef = useRef<HTMLButtonElement | null>(null);
  const hasUserSelectedPlanRef = useRef(false);
  const lastPreferredPlanCodeRef = useRef(preferredPlanCode);

  const selectedPlan = useMemo(() => getOwnerPlanByCode(selectedPlanCode) ?? initialSummary.currentPlan, [initialSummary.currentPlan, selectedPlanCode]);
  const selectedBillingAmount = useMemo(
    () =>
      calculateOwnerBillingAmountBreakdown(
        selectedPlan,
        summary.billingAmount.multiShopDiscount.totalShopCount,
      ),
    [selectedPlan, summary.billingAmount.multiShopDiscount.totalShopCount],
  );
  const selectedMultiShopDiscount = selectedBillingAmount.multiShopDiscount;
  const selectedStaffLimitLabel = getOwnerPlanStaffLimitLabel(selectedPlan, selectedMultiShopDiscount.totalShopCount);
  const isFreePlan = selectedPlan.code === "free";
  const usesOneTimePayment = selectedPlan.billingType === "one_time";
  const selectedPlanLabel = getOwnerPlanDisplayName(selectedPlan.code);
  const projectedServiceEndDate = formatProjectedServiceEndDate(summary, selectedPlan);
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
  const billingCycleLabel = usesOneTimePayment ? "1회 결제" : "매월 자동 결제";
  const nextBillingDateLabel = usesOneTimePayment ? "없음" : formatDate(addMonthsIso(new Date().toISOString(), 1));
  const consentLines = usesOneTimePayment
    ? [
        "선택한 플랜은 결제 1회로 이용이 시작됩니다.",
        "등록한 카드는 펫매니저 이용요금 결제수단으로 사용됩니다.",
        "카드 정보는 자동결제 등록을 위해 KCP와 포트원에 전송되며, 펫매니저에는 저장되지 않습니다.",
      ]
    : [
        "선택한 요금제는 등록된 카드로 매월 자동 결제됩니다.",
        "카드 등록이 완료되면 선택한 플랜 결제가 바로 진행됩니다.",
        `${selectedPlan.alimtalkIncludedLabel}이며, 초과 알림톡은 11원/건으로 부가세가 포함됩니다.`,
        "카드 정보는 자동결제 등록을 위해 KCP와 포트원에 전송되며, 펫매니저에는 저장되지 않습니다.",
      ];
  const agreementContinueLabel =
    registeringCard || retryingPayment || resumingRegisteredCardPayment
      ? "결제 진행 중..."
      : hasUsableRegisteredPaymentMethod || usesOneTimePayment
        ? "동의하고 결제하기"
        : "동의하고 카드 등록 후 결제하기";
  const paymentMethodOptions: PaymentMethodOption[] = hasUsableRegisteredPaymentMethod
    ? [
        {
          id: "saved",
          title: registeredPaymentTitle,
          description: registeredPaymentDescription,
        },
        {
          id: "new",
          title: "새 카드 등록",
          description: usesOneTimePayment
            ? "등록 후 바로 결제를 진행합니다."
            : "등록 후 바로 해당 플랜 결제로 이어집니다.",
        },
      ]
    : [
        {
          id: "new",
          title: "새 카드 등록",
          description: usesOneTimePayment
            ? "등록 후 바로 결제를 진행합니다."
            : "등록 후 바로 해당 플랜 결제로 이어집니다.",
        },
      ];
  const paymentSheetAmountLabel = usesOneTimePayment
    ? `총 ${won(selectedPlan.totalPrice)}`
    : `월 ${won(selectedBillingAmount.monthlyTotalAmount)}`;
  const canCancelRenewal =
    summary.currentPlan.billingType === "subscription" &&
    summary.currentPlanCode !== "free" &&
    !summary.cancelAtPeriodEnd &&
    summary.status !== "expired";

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    const preferredPlanChanged = lastPreferredPlanCodeRef.current !== preferredPlanCode;
    lastPreferredPlanCodeRef.current = preferredPlanCode;

    if (preferredPlanChanged) {
      hasUserSelectedPlanRef.current = false;
    }
    if (hasUserSelectedPlanRef.current) {
      return;
    }

    setSelectedPlanCode(preferredPlanCode ?? (forcePlanPicker ? defaultPickerPlanCode : initialSummary.currentPlanCode));
  }, [defaultPickerPlanCode, forcePlanPicker, initialSummary.currentPlanCode, preferredPlanCode]);

  useEffect(() => {
    setIsSelectingPlan((forcePlanPicker || !preferredPlanCode) && !showPaymentRequiredNotice);
    setSelectionStep(openPaymentSheet ? "agreement" : "plan");
    setAgreementAccepted(false);
  }, [forcePlanPicker, openPaymentSheet, preferredPlanCode, showPaymentRequiredNotice]);

  useEffect(() => {
    setSelectedPaymentOption(summary.paymentMethodExists && !summary.paymentMethodResetRequired ? "saved" : "new");
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
    if (usesOneTimePayment || resumingRegisteredCardPayment || retryingPayment) {
      return;
    }
    if (!summary.paymentMethodExists) {
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

  function handleRegisterCard() {
    if (registeringCard || retryingPayment) return;
    setPaymentSheetOpen(false);
    setCardRegistrationOpen(true);
    setMessage(null);
  }

  async function handleApiCardRegistration(credentials: OwnerBillingCardCredentials) {
    if (registeringCard || retryingPayment) return;

    setRegisteringCard(true);
    setRetryingPayment(true);
    setMessage(null);

    try {
      await persistSelectedPlanIfNeeded();
      storePendingBillingRegistration(selectedPlanCode);

      const registeredSummary = await issueOwnerBillingKeyByApi({
        ...credentials,
        customerName: summary.ownerName || "펫매니저 사장님",
        phoneNumber: summary.ownerPhoneNumber,
        email: summary.ownerEmail,
        planCode: selectedPlanCode,
      });

      if (!registeredSummary) {
        return;
      }

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
      await persistSelectedPlanIfNeeded();
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

  function handleSelectPlanCode(planCode: OwnerPlanCode) {
    hasUserSelectedPlanRef.current = true;
    setSelectedPlanCode(planCode);
    setAgreementAccepted(false);
    setMessage(null);
  }

  async function handlePaymentSheetSubmit() {
    if (registeringCard || retryingPayment) return;

    try {
      if (selectedPaymentOption === "saved" && hasUsableRegisteredPaymentMethod) {
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

  function openCancelRenewalDialog() {
    if (!canCancelRenewal || cancellingRenewal) return;
    setCancelReason("");
    setCancelAcknowledged(false);
    setCancelRenewalDialogOpen(true);
    setMessage(null);
  }

  async function handleCancelRenewal() {
    if (cancellingRenewal) return;
    if (!cancelReason || !cancelAcknowledged) {
      setMessage("정기결제 취소 사유와 안내 확인이 필요합니다.");
      return;
    }

    setCancellingRenewal(true);
    setMessage(null);
    try {
      const nextSummary = await cancelOwnerSubscriptionRenewal();
      setSummary(nextSummary);
      setSelectedPlanCode(nextSummary.currentPlanCode);
      setCancelRenewalDialogOpen(false);
      setCancelReason("");
      setCancelAcknowledged(false);
      setMessage("정기결제가 취소되었습니다. 현재 이용 기간까지는 계속 사용할 수 있습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "정기결제 취소를 처리하지 못했습니다.");
    } finally {
      setCancellingRenewal(false);
    }
  }

  const cancelRenewalDialog = cancelRenewalDialogOpen ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/40 px-4 py-6 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-renewal-title"
        className="w-full max-w-[460px] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e7edf3] px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#fff7f8] text-[#a04455]">
              <CalendarX2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#a04455]">정기결제 취소</p>
              <h2 id="cancel-renewal-title" className="mt-1 text-[21px] font-semibold leading-7 text-[#0f172a]">
                다음 결제부터 중단할까요?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCancelRenewalDialogOpen(false)}
            disabled={cancellingRenewal}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155] disabled:opacity-60"
            aria-label="닫기"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-[8px] border border-[#eadde0] bg-[#fffafb] px-4 py-3.5">
            <p className="text-[13px] font-medium leading-5 text-[#7f3544]">
              현재 이용 기간까지는 계속 사용할 수 있고, 다음 결제일에는 자동 결제가 진행되지 않습니다.
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-[#8f5d66]">
              포함 알림톡은 다음 유료 결제 주기에 다시 제공되지 않으며, 이미 충전한 유료 알림톡은 정책에 따라 유지됩니다.
            </p>
          </div>

          <label className="mt-5 grid gap-2">
            <span className="text-[13px] font-medium text-[#334155]">취소 사유</span>
            <select
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              disabled={cancellingRenewal}
              className="h-11 rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#a04455] focus:ring-2 focus:ring-[#f4d9df] disabled:opacity-60"
            >
              <option value="">사유를 선택해 주세요</option>
              {cancellationReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-3">
            <input
              type="checkbox"
              checked={cancelAcknowledged}
              onChange={(event) => setCancelAcknowledged(event.target.checked)}
              disabled={cancellingRenewal}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#94a3b8] text-[#a04455] focus:ring-[#e7bcc5]"
            />
            <span className="text-[12px] leading-5 text-[#475569]">
              현재 이용 기간 종료일까지는 서비스를 사용할 수 있으며, 다음 결제일부터 자동 갱신이 중단된다는 내용을 확인했습니다.
            </span>
          </label>

          {message ? (
            <p className="mt-4 rounded-[8px] border border-[#fecaca] bg-[#fff7f7] px-3 py-2.5 text-[13px] leading-5 text-[#b91c1c]">
              {message}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2.5 border-t border-[#e7edf3] bg-[#fbfdff] px-6 py-4">
          <button
            type="button"
            onClick={() => setCancelRenewalDialogOpen(false)}
            disabled={cancellingRenewal}
            className="flex h-11 items-center justify-center rounded-[8px] border border-[#cfd8e3] bg-white text-[14px] font-medium text-[#475569] transition hover:bg-[#f8fafc] disabled:opacity-60"
          >
            유지하기
          </button>
          <button
            type="button"
            onClick={() => void handleCancelRenewal()}
            disabled={cancellingRenewal || !cancelReason || !cancelAcknowledged}
            className="flex h-11 items-center justify-center rounded-[8px] border border-[#a04455] bg-[#a04455] text-[14px] font-medium text-white transition hover:border-[#8e3948] hover:bg-[#8e3948] disabled:cursor-not-allowed disabled:border-[#e2e8f0] disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
          >
            {cancellingRenewal ? "취소 처리 중..." : "정기결제 취소"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (cardRegistrationOpen) {
    return (
      <OwnerBillingCardRegistrationForm
        planLabel={selectedPlanLabel}
        amountLabel={`월 ${won(selectedBillingAmount.monthlyTotalAmount)}`}
        loading={registeringCard || retryingPayment}
        message={message}
        onBack={() => {
          if (registeringCard || retryingPayment) return;
          setCardRegistrationOpen(false);
          setMessage(null);
        }}
        onSubmit={async (credentials) => {
          await handleApiCardRegistration(credentials);
        }}
      />
    );
  }

  if (isSelectingPlan) {
    if (selectionStep === "agreement") {
      return (
        <>
          <BillingConsent
            planLabel={selectedPlanLabel}
            billingCycleLabel={billingCycleLabel}
            nextBillingDateLabel={nextBillingDateLabel}
            consentLines={consentLines}
            agreed={agreementAccepted}
            onAgreeChange={setAgreementAccepted}
            continueLabel={agreementContinueLabel}
            continueButtonRef={agreementContinueRef}
            onContinue={() => {
              if (!agreementAccepted) {
                setMessage("정기결제 안내 동의가 필요합니다.");
                return;
              }
              setMessage(null);

              void (usesOneTimePayment ? handleOneTimePayment() : hasUsableRegisteredPaymentMethod ? handlePayNow() : handleRegisterCard());
            }}
            onBack={() => setSelectionStep("plan")}
            loading={registeringCard || retryingPayment}
            message={message}
          />

          <PaymentMethodSheet
            open={paymentSheetOpen}
            planLabel={selectedPlanLabel}
            amountLabel={paymentSheetAmountLabel}
            nextBillingDateLabel={nextBillingDateLabel}
            options={paymentMethodOptions}
            selectedOption={selectedPaymentOption}
            loading={registeringCard || retryingPayment}
            continueLabel={
              registeringCard
                ? "카드 등록 중..."
                : retryingPayment
                  ? "결제 진행 중..."
                  : selectedPaymentOption === "saved" && hasUsableRegisteredPaymentMethod
                    ? "선택한 수단으로 계속하기"
                    : usesOneTimePayment
                      ? "결제창 열기"
                      : "선택한 수단으로 계속하기"
            }
            returnFocusRef={agreementContinueRef}
            onSelectOption={setSelectedPaymentOption}
            onClose={() => setPaymentSheetOpen(false)}
            onContinue={() => void handlePaymentSheetSubmit()}
          />
          {cancelRenewalDialog}
        </>
      );
    }

    return (
      <>
        <OwnerBillingPlanPicker
          plans={billableOwnerPlans}
          currentPlanCode={summary.currentPlanCode}
          selectedPlanCode={selectedPlanCode}
          totalShopCount={summary.billingAmount.multiShopDiscount.totalShopCount}
          onSelectPlanCode={handleSelectPlanCode}
          onContinue={() => {
            setMessage(null);
            setSelectionStep("agreement");
          }}
          onBack={() => router.push("/owner")}
          canCancelRenewal={canCancelRenewal}
          cancellingRenewal={cancellingRenewal}
          onCancelRenewal={openCancelRenewalDialog}
          loading={registeringCard || retryingPayment}
          message={message}
        />
        {cancelRenewalDialog}
      </>
    );
  }

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#111111]">
      <section className="rounded-[28px] border border-[#dfd8cc] bg-[#fffdf8] px-5 py-6 shadow-[0_10px_30px_rgba(41,41,38,0.05)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">펫매니저 플랜 및 결제</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#173b33]">{copy.title}</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#615d56]">{copy.body}</p>

        <div className="mt-5 rounded-[22px] border border-[#d9d2c7] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#111111]">현재 선택된 플랜</p>
          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-[#173b33]">{selectedPlanLabel}</p>
          <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[#18211f]">
            월 {won(selectedBillingAmount.monthlyTotalAmount)}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#6e6a61]">다음 결제 기준일 {projectedServiceEndDate}</p>
          <div className="mt-3 rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[#64748b]">총 매장 수</span>
              <span className="font-semibold text-[#111827]">{selectedMultiShopDiscount.totalShopCount}개</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[#64748b]">매장 정가</span>
              <span className="font-semibold text-[#111827]">월 {won(selectedMultiShopDiscount.perShopListMonthlyPrice)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[#64748b]">할인 전 금액</span>
              <span className="font-semibold text-[#111827]">월 {won(selectedMultiShopDiscount.subtotalBeforeDiscount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[#64748b]">다점포 할인</span>
              <span className="font-semibold text-[#2563eb]">
                {selectedMultiShopDiscount.discountPercent > 0
                  ? `${selectedMultiShopDiscount.discountPercent}% · -${won(selectedMultiShopDiscount.discountAmount)}`
                  : "없음"}
              </span>
            </div>
            <p className="mt-2 text-[12px] font-medium leading-5 text-[#64748b]">
              {selectedMultiShopDiscount.appliedLabel} 매장 추가/삭제 변경분은 다음 결제일부터 반영됩니다.
            </p>
          </div>
          <p className="mt-2 text-[13px] leading-5 text-[#6e6a61]">
            {isFreePlan
              ? "체험 플랜은 관리자 배정용 플랜입니다. 유료 결제로 전환하려면 플랜을 변경해 주세요."
              : usesOneTimePayment
              ? "선택한 플랜은 결제 후 바로 시작할 수 있습니다."
              : `${selectedStaffLimitLabel} 기준, ${selectedPlan.alimtalkIncludedLabel} 요금제입니다.`}
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
                  ? "선택한 플랜은 결제 후 바로 시작합니다."
                  : "카드 등록 후 매월 같은 요금제로 자동 결제됩니다."}
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
          {canCancelRenewal ? (
            <button
              type="button"
              onClick={openCancelRenewalDialog}
              disabled={cancellingRenewal}
              className="flex h-[52px] w-full items-center justify-center rounded-[18px] border border-[#e5d4d7] bg-white px-4 text-[15px] font-semibold text-[#a04455] disabled:opacity-60"
            >
              {cancellingRenewal ? "취소 처리 중..." : "다음 정기결제 취소"}
            </button>
          ) : null}
        </div>
      </section>

      {message ? <p className="mt-4 rounded-[18px] border border-[#d8d1c5] bg-white px-4 py-3 text-sm text-[#4a4640]">{message}</p> : null}
      {cancelRenewalDialog}
    </div>
  );
}





