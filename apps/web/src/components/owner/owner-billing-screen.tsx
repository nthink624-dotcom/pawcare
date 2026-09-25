"use client";

import { CalendarX2, CreditCard, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { OwnerBillingPlanPicker } from "@/components/owner/owner-billing-plan-picker";
import { OwnerBillingModal } from "@/components/owner/owner-billing-modal";
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
  saveOwnerSubscriptionPreferences,
  retryOwnerSubscriptionPayment,
} from "@/lib/billing/owner-billing-client";
import {
  billableOwnerPlans,
  calculateOwnerBillingAmountBreakdown,
  getOwnerPlanByCode,
  getOwnerPlanDisplayName,
  OWNER_SINGLE_MONTHLY_PLAN_CODE,
  type OwnerPlanCode,
} from "@/lib/billing/owner-plans";
import { addDaysIso, addMonthsIso, type OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
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
  return currentPlanCode === OWNER_SINGLE_MONTHLY_PLAN_CODE ? currentPlanCode : fallbackPlanCode;
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
    };
  }

  if (summary.status === "past_due") {
    return {
      title: "결제가 완료되지 않았습니다",
    };
  }

  if (summary.status === "expired") {
    return {
      title: summary.currentPlanCode === "free" ? "체험 플랜이 종료되었습니다" : "이용 기간이 종료되었습니다",
    };
  }

  if (summary.noticeLevel === "1day") {
    return {
      title: "내일 체험 플랜이 종료됩니다",
    };
  }

  if (summary.noticeLevel === "3days") {
    return {
      title: `${PETMANAGER_SERVICE_NAME} 이용 기간이 ${summary.daysUntilTrialEnds}일 남았어요`,
    };
  }

  if (summary.status === "active") {
    return {
      title: "현재 플랜을 이용 중입니다",
    };
  }

  return {
    title: "체험 플랜이 진행 중입니다",
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
  const planPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
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
  const isFreePlan = selectedPlan.code === "free";
  const selectedPlanLabel = getOwnerPlanDisplayName(selectedPlan.code);
  const projectedServiceEndDate = formatProjectedServiceEndDate(summary, selectedPlan);
  const hasUsableRegisteredPaymentMethod = summary.paymentMethodExists && !summary.paymentMethodResetRequired;
  const registeredPaymentTitle =
    summary.paymentMethodLabel && summary.paymentMethodLabel.trim() && summary.paymentMethodLabel !== "등록된 카드"
      ? summary.paymentMethodLabel
      : hasUsableRegisteredPaymentMethod
        ? "등록 카드"
        : "카드 정보 확인 필요";
  const billingCycleLabel = "매월 자동 결제";
  const nextBillingDateLabel = formatDate(addMonthsIso(new Date().toISOString(), 1));
  const agreementContinueLabel =
    registeringCard || retryingPayment || resumingRegisteredCardPayment
      ? "결제 진행 중..."
      : hasUsableRegisteredPaymentMethod
        ? "동의하고 결제하기"
        : "동의하고 카드 등록 후 결제하기";
  const paymentMethodOptions: PaymentMethodOption[] = hasUsableRegisteredPaymentMethod
    ? [
        {
          id: "saved",
          title: registeredPaymentTitle,
        },
        {
          id: "new",
          title: "새 카드 등록",
        },
      ]
    : [
        {
          id: "new",
          title: "새 카드 등록",
        },
      ];
  const paymentSheetAmountLabel = `월 ${won(selectedBillingAmount.monthlyTotalAmount)}`;
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
    if (resumingRegisteredCardPayment || retryingPayment) {
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
        let activeSummary = summary;
        if (pendingPlanCode !== summary.currentPlanCode) {
          const savedSummary = await saveOwnerSubscriptionPreferences(summary.shopId);
          if (cancelled) return;
          activeSummary = savedSummary;
          setSummary(savedSummary);
          setSelectedPlanCode(savedSummary.currentPlanCode);
        }

        clearPendingBillingRegistration();

        const nextSummary = await retryOwnerSubscriptionPayment(activeSummary.shopId);
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
  }, [resumingRegisteredCardPayment, retryingPayment, summary]);

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
        shopId: summary.shopId,
        ...credentials,
        customerName: summary.ownerName || "매장 사장님",
        phoneNumber: summary.ownerPhoneNumber,
        email: summary.ownerEmail,
      });

      if (!registeredSummary) {
        return;
      }

      setSummary(registeredSummary);
      setSelectedPlanCode(registeredSummary.currentPlanCode);

      const paidSummary = await retryOwnerSubscriptionPayment(registeredSummary.shopId);
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
      const nextSummary = await retryOwnerSubscriptionPayment(summary.shopId);
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

  const primaryAction = isFreePlan
    ? {
        label: "체험 플랜 상태 확인",
        onClick: () => undefined,
        disabled: true,
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

    const savedSummary = await saveOwnerSubscriptionPreferences(summary.shopId);
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
      await handleRegisterCard();
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
      const nextSummary = await cancelOwnerSubscriptionRenewal(summary.shopId);
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
              {summary.currentPlanCode === OWNER_SINGLE_MONTHLY_PLAN_CODE
                ? "이용 기간이 끝나면 예약 운영과 알림톡 기능 이용이 함께 중지됩니다."
                : "이용 기간이 끝나면 예약 운영과 알림톡 기능 이용이 함께 중지됩니다."}
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

  const billingFlowBusy = registeringCard || retryingPayment || resumingRegisteredCardPayment;

  function closeBillingFlow() {
    if (billingFlowBusy) return;
    setPaymentSheetOpen(false);
    setCardRegistrationOpen(false);
    setIsSelectingPlan(false);
    setSelectionStep("plan");
    setAgreementAccepted(false);
    setMessage(null);
  }

  function closeCardRegistration() {
    if (billingFlowBusy) return;
    setCardRegistrationOpen(false);
    setMessage(null);
  }

  return (
    <>
      <div className="owner-font pm-owner-web min-h-screen w-full bg-[var(--bg)] px-4 py-6 text-[var(--ink)] sm:px-6 lg:px-8 lg:py-8">
        <section className="mx-auto w-full max-w-[1180px] rounded-[14px] border border-[var(--bd)] bg-white px-5 py-6 shadow-none sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#1677ff]">
          {PETMANAGER_SERVICE_NAME} 플랜 및 결제
        </p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[var(--ink)]">{copy.title}</h1>

        <div className="mt-5 rounded-[12px] border border-[#e8edf3] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#111111]">현재 선택된 플랜</p>
          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-[var(--ink)]">{selectedPlanLabel}</p>
          <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            월 {won(selectedBillingAmount.monthlyTotalAmount)}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--mid)]">다음 결제 기준일 {projectedServiceEndDate}</p>
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
          </div>
        </div>

        <div className="mt-4 rounded-[12px] border border-[#e8edf3] bg-white px-4 py-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#bfdbfe] bg-[#eff6ff] text-[#1677ff]">
              <CreditCard className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[var(--ink)]">신용/체크카드</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2.5 sm:max-w-[360px]">
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="flex h-[48px] w-full items-center justify-center rounded-[9px] bg-[#1677ff] px-4 text-[15px] font-semibold text-white transition hover:bg-[#0e65d8] disabled:opacity-60"
          >
            {primaryAction.label}
          </button>
          <button
            ref={planPickerTriggerRef}
            type="button"
            onClick={() => setIsSelectingPlan(true)}
            className="flex h-[48px] w-full items-center justify-center rounded-[9px] border border-[#e8edf3] bg-white px-4 text-[15px] font-semibold text-[#1677ff] transition hover:border-[#bfdbfe] hover:bg-[#f8fbff]"
          >
            플랜 다시 선택하기
          </button>
          {canCancelRenewal ? (
            <button
              type="button"
              onClick={openCancelRenewalDialog}
              disabled={cancellingRenewal}
              className="flex h-[48px] w-full items-center justify-center rounded-[9px] border border-[#f1d1d7] bg-white px-4 text-[15px] font-semibold text-[#a04455] disabled:opacity-60"
            >
              {cancellingRenewal ? "취소 처리 중..." : "다음 정기결제 취소"}
            </button>
          ) : null}
        </div>
        </section>

        {message ? <p className="mx-auto mt-4 w-full max-w-[1180px] rounded-[10px] border border-[#e8edf3] bg-white px-4 py-3 text-sm text-[#334155]">{message}</p> : null}
      </div>

      {cardRegistrationOpen ? (
        <OwnerBillingModal
          labelledBy="owner-billing-card-registration-title"
          closeLabel="카드 등록 닫기"
          onClose={closeCardRegistration}
          maxWidthClassName="max-w-[720px]"
          dismissible={!billingFlowBusy}
        >
          <OwnerBillingCardRegistrationForm
            variant="modal"
            planLabel={selectedPlanLabel}
            amountLabel={`월 ${won(selectedBillingAmount.monthlyTotalAmount)}`}
            loading={registeringCard || retryingPayment}
            message={message}
            onBack={closeCardRegistration}
            onSubmit={async (credentials) => {
              await handleApiCardRegistration(credentials);
            }}
          />
        </OwnerBillingModal>
      ) : isSelectingPlan ? (
        selectionStep === "agreement" ? (
          <OwnerBillingModal
            labelledBy="owner-billing-consent-title"
            closeLabel="결제 화면 닫기"
            onClose={closeBillingFlow}
            maxWidthClassName="max-w-[900px]"
            dismissible={!billingFlowBusy}
            returnFocusRef={planPickerTriggerRef}
          >
            <BillingConsent
              variant="modal"
              planLabel={selectedPlanLabel}
              billingCycleLabel={billingCycleLabel}
              nextBillingDateLabel={nextBillingDateLabel}
              checkboxLabel={`월 ${won(selectedBillingAmount.monthlyTotalAmount)} 자동결제와 KCP·포트원 카드 처리를 확인했습니다.`}
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
                void (hasUsableRegisteredPaymentMethod ? handlePayNow() : handleRegisterCard());
              }}
              onBack={() => setSelectionStep("plan")}
              loading={registeringCard || retryingPayment}
              message={message}
            />
          </OwnerBillingModal>
        ) : (
          <OwnerBillingModal
            labelledBy="owner-billing-plan-picker-title"
            closeLabel="플랜 선택 닫기"
            onClose={closeBillingFlow}
            dismissible={!billingFlowBusy}
            returnFocusRef={planPickerTriggerRef}
          >
            <OwnerBillingPlanPicker
              variant="modal"
              plans={billableOwnerPlans}
              currentPlanCode={summary.currentPlanCode}
              selectedPlanCode={selectedPlanCode}
              totalShopCount={summary.billingAmount.multiShopDiscount.totalShopCount}
              onSelectPlanCode={handleSelectPlanCode}
              onContinue={() => {
                setMessage(null);
                setSelectionStep("agreement");
              }}
              onBack={closeBillingFlow}
              canCancelRenewal={canCancelRenewal}
              cancellingRenewal={cancellingRenewal}
              onCancelRenewal={openCancelRenewalDialog}
              loading={registeringCard || retryingPayment}
              message={message}
            />
          </OwnerBillingModal>
        )
      ) : null}

      <PaymentMethodSheet
        open={isSelectingPlan && selectionStep === "agreement" && paymentSheetOpen}
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





