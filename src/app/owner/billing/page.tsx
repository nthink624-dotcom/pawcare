"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import OwnerBillingScreen from "@/components/owner/owner-billing-screen";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  fetchOwnerSubscriptionSummary,
  registerOwnerBillingKey,
} from "@/lib/billing/owner-billing-client";
import {
  readOwnerBillingSummaryCache,
  writeOwnerBillingSummaryCache,
} from "@/lib/billing/owner-billing-navigation";
import { getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { CURRENT_OWNER_SHOP_STORAGE, readCurrentOwnerShopId } from "@/lib/owner-current-shop";

type OwnedShopSummary = {
  id: string;
};

function isSummaryForActiveShop(summary: OwnerSubscriptionSummary, shopId: string) {
  return summary.shopId === shopId;
}

export function OwnerBillingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const preferredPlan = (planParam && getOwnerPlanByCode(planParam)?.code) as OwnerPlanCode | null;
  const forcePlanPicker = searchParams.get("compare") === "1";
  const openPaymentSheet = searchParams.get("sheet") === "1";
  const notice = searchParams.get("notice");
  const billingReturn = searchParams.get("billingReturn") === "1";
  const returnedBillingKey = searchParams.get("billingKey");
  const returnedIssueId = searchParams.get("issueId");
  const returnedBillingError = searchParams.get("message") || searchParams.get("code");
  const [summary, setSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [freshSummaryShopId, setFreshSummaryShopId] = useState<string | null>(null);
  const [message, setMessage] = useState("구독 정보를 불러오는 중입니다.");
  const handledBillingKeyRef = useRef<string | null>(null);
  const activeShopIdRef = useRef<string | null>(null);
  const activeShopResolutionRef = useRef(0);

  useEffect(() => {
    activeShopIdRef.current = activeShopId;
  }, [activeShopId]);

  useEffect(() => {
    let active = true;

    async function resolveActiveShop() {
      const resolutionId = activeShopResolutionRef.current + 1;
      activeShopResolutionRef.current = resolutionId;
      setActiveShopId(null);
      setFreshSummaryShopId(null);
      setSummary(null);
      const storedShopId = readCurrentOwnerShopId();
      if (!storedShopId) {
        if (active) setMessage("현재 매장을 확인한 뒤 결제를 관리할 수 있습니다.");
        return;
      }

      try {
        const shops = await fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops", { cache: "no-store" });
        if (!active || activeShopResolutionRef.current !== resolutionId) return;
        if (!shops.some((shop) => shop.id === storedShopId)) {
          setMessage("현재 매장의 결제 권한을 확인하지 못했습니다.");
          return;
        }

        setActiveShopId(storedShopId);
        const cachedSummary = readOwnerBillingSummaryCache();
        if (cachedSummary && isSummaryForActiveShop(cachedSummary, storedShopId)) {
          setSummary(cachedSummary);
          setMessage("최신 구독 정보를 확인하는 중입니다.");
        }
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "구독 정보를 불러오지 못했습니다.";
        if (
          nextMessage === "로그인이 필요합니다." ||
          nextMessage.includes("로그인 상태를 확인하지 못했습니다")
        ) {
          router.replace("/login?next=/owner/billing" as never);
          router.refresh();
          return;
        }
        setMessage(nextMessage);
      }
    }

    void resolveActiveShop();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CURRENT_OWNER_SHOP_STORAGE) {
        void resolveActiveShop();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, [router]);

  useEffect(() => {
    if (!activeShopId) return;
    let active = true;

    const refreshSummary = async () => {
      try {
        const nextSummary = await fetchOwnerSubscriptionSummary(activeShopId);
        if (!active || activeShopIdRef.current !== activeShopId) return;
        if (!isSummaryForActiveShop(nextSummary, activeShopId)) {
          setFreshSummaryShopId(null);
          setMessage("현재 매장의 최신 구독 정보를 확인하지 못했습니다.");
          return;
        }
        writeOwnerBillingSummaryCache(nextSummary);
        setSummary(nextSummary);
        setFreshSummaryShopId(activeShopId);
      } catch {
        // Keep the latest visible summary when a background refresh misses.
      }
    };

    const handleFocus = () => {
      void refreshSummary();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSummary();
      }
    };

    void refreshSummary();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeShopId]);

  useEffect(() => {
    if (
      !billingReturn ||
      !returnedBillingKey ||
      !preferredPlan ||
      !summary ||
      !activeShopId ||
      freshSummaryShopId !== activeShopId ||
      !isSummaryForActiveShop(summary, activeShopId)
    ) {
      return;
    }
    if (handledBillingKeyRef.current === returnedBillingKey) return;

    const billingKey = returnedBillingKey;
    const planCode = preferredPlan;
    const verifiedShopId = activeShopId;
    let active = true;

    async function finishBillingKeyRegistration() {
      if (activeShopIdRef.current !== verifiedShopId) return;
      handledBillingKeyRef.current = billingKey;
      setMessage("카드 등록 정보를 확인하고 있어요.");

      try {
        await registerOwnerBillingKey({
          shopId: verifiedShopId,
          billingKey,
          issueId: returnedIssueId,
          paymentMethodLabel: "등록 카드",
        });
        if (!active) return;

        const params = new URLSearchParams({ compare: "1", plan: planCode });
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
  }, [
    activeShopId,
    billingReturn,
    freshSummaryShopId,
    preferredPlan,
    returnedBillingKey,
    returnedIssueId,
    router,
    summary,
  ]);

  if (!summary) {
    return (
      <main className="owner-font pm-owner-web min-h-screen bg-[var(--bg)] px-8 py-10">
        <div className="mx-auto w-full max-w-[1180px] rounded-[12px] border border-[var(--bd)] bg-white px-6 py-5 text-[14px] leading-6 text-[var(--mid)] shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          {message}
        </div>
      </main>
    );
  }

  if (billingReturn && !returnedBillingKey && returnedBillingError) {
    return (
      <main className="owner-font pm-owner-web min-h-screen bg-[var(--bg)] px-8 py-10">
        <div className="mx-auto w-full max-w-[1180px] rounded-[12px] border border-[var(--bd)] bg-white px-6 py-5 text-[14px] leading-6 text-[var(--mid)] shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p>카드 등록을 완료하지 못했습니다. {returnedBillingError}</p>
          <button
            type="button"
            onClick={() =>
              router.replace(
                `/owner/billing?compare=1${preferredPlan ? `&plan=${preferredPlan}` : ""}` as never,
              )
            }
            className="mt-4 h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
          >
            결제로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  const shouldForcePlanPicker =
    forcePlanPicker || openPaymentSheet || summary.status === "expired" || summary.status === "past_due";
  const showPaymentRequiredNotice =
    !openPaymentSheet &&
    (notice === "expired" ||
      notice === "past_due" ||
      summary.status === "expired" ||
      summary.status === "past_due");

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
    <Suspense
      fallback={
        <main className="owner-font pm-owner-web min-h-screen bg-[var(--bg)] px-8 py-10">
          <div className="mx-auto w-full max-w-[1180px] rounded-[12px] border border-[var(--bd)] bg-white px-6 py-5 text-[14px] leading-6 text-[var(--mid)] shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            구독 정보를 불러오는 중입니다.
          </div>
        </main>
      }
    >
      <OwnerBillingPageContent />
    </Suspense>
  );
}
