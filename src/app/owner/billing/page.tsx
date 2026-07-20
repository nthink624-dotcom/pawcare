"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import OwnerBillingScreen from "@/components/owner/owner-billing-screen";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { registerOwnerBillingKey } from "@/lib/billing/owner-billing-client";
import { readOwnerBillingSummaryCache, writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";

function OwnerBillingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredPlan = (searchParams.get("plan") && getOwnerPlanByCode(searchParams.get("plan"))?.code) as OwnerPlanCode | null;
  const forcePlanPicker = searchParams.get("compare") === "1";
  const openPaymentSheet = searchParams.get("sheet") === "1";
  const notice = searchParams.get("notice");
  const billingReturn = searchParams.get("billingReturn") === "1";
  const returnedBillingKey = searchParams.get("billingKey");
  const returnedIssueId = searchParams.get("issueId");
  const returnedBillingError = searchParams.get("message") || searchParams.get("code");
  const [summary, setSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [message, setMessage] = useState("구독 정보를 불러오는 중입니다.");
  const handledBillingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const cachedSummary = readOwnerBillingSummaryCache();
      if (cachedSummary && active) {
        setSummary(cachedSummary);
        setMessage("최신 구독 정보를 확인하는 중입니다.");
      }

      try {
        const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (active) {
          writeOwnerBillingSummaryCache(nextSummary);
          setSummary(nextSummary);
        }
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "구독 정보를 불러오지 못했습니다.";
        if (nextMessage === "로그인이 필요합니다." || nextMessage.includes("로그인 상태를 확인하지 못했습니다")) {
          router.replace("/login?next=/owner/billing" as never);
          router.refresh();
          return;
        }
        setMessage(nextMessage);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;

    async function refreshSummary() {
      try {
        const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (active) {
          writeOwnerBillingSummaryCache(nextSummary);
          setSummary(nextSummary);
        }
      } catch {
        // Keep the latest visible summary when background refresh fails.
      }
    }

    const handleFocus = () => {
      void refreshSummary();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSummary();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!billingReturn || !returnedBillingKey || !preferredPlan) {
      return;
    }
    if (handledBillingKeyRef.current === returnedBillingKey) {
      return;
    }

    const billingKey = returnedBillingKey;
    const planCode = preferredPlan;
    handledBillingKeyRef.current = billingKey;
    let active = true;

    async function finishBillingKeyRegistration() {
      setMessage("카드 등록 정보를 확인하고 있어요.");

      try {
        await registerOwnerBillingKey({
          billingKey,
          issueId: returnedIssueId,
          paymentMethodLabel: "등록 카드",
          planCode,
        });
        if (!active) return;

        const params = new URLSearchParams({
          compare: "1",
          plan: planCode,
        });
        router.replace(`/owner/billing?${params.toString()}` as never);
        router.refresh();
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "카드 등록 정보를 처리하지 못했습니다.");
      }
    }

    void finishBillingKeyRegistration();
    return () => {
      active = false;
    };
  }, [billingReturn, preferredPlan, returnedBillingKey, returnedIssueId, router]);

  if (!summary) {
    return <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">{message}</div>;
  }

  if (billingReturn && !returnedBillingKey && returnedBillingError) {
    return (
      <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">
        <p>카드 등록을 완료하지 못했습니다. {returnedBillingError}</p>
        <button
          type="button"
          onClick={() => router.replace(`/owner/billing?compare=1${preferredPlan ? `&plan=${preferredPlan}` : ""}` as never)}
          className="mt-4 h-10 rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-medium text-[#334155]"
        >
          결제로 돌아가기
        </button>
      </div>
    );
  }

  const shouldForcePlanPicker = forcePlanPicker || openPaymentSheet || summary.status === "expired" || summary.status === "past_due";
  const showPaymentRequiredNotice =
    !openPaymentSheet &&
    (notice === "expired" || notice === "past_due" || summary.status === "expired" || summary.status === "past_due");

  return (
    <OwnerBillingScreen
      initialSummary={summary}
      preferredPlanCode={preferredPlan}
      forcePlanPicker={shouldForcePlanPicker}
      openPaymentSheet={openPaymentSheet}
      showPaymentRequiredNotice={showPaymentRequiredNotice}
    />
  );
}

export default function OwnerBillingPage() {
  return (
    <Suspense fallback={<div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">구독 정보를 불러오는 중입니다.</div>}>
      <OwnerBillingPageContent />
    </Suspense>
  );
}
