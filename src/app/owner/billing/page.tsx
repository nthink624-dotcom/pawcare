"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import OwnerBillingScreen from "@/components/owner/owner-billing-screen";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function OwnerBillingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredPlan = (searchParams.get("plan") && getOwnerPlanByCode(searchParams.get("plan"))?.code) as OwnerPlanCode | null;
  const forcePlanPicker = searchParams.get("compare") === "1";
  const openPaymentSheet = searchParams.get("sheet") === "1";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [summary, setSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [message, setMessage] = useState("구독 정보를 불러오는 중입니다.");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("Supabase 설정을 확인해 주세요.");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login?next=/owner/billing" as never);
        router.refresh();
        return;
      }

      try {
        const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (active) {
          setSummary(nextSummary);
        }
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "구독 정보를 불러오지 못했습니다.";
        if (nextMessage === "로그인이 필요합니다.") {
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
  }, [router, supabase]);

  useEffect(() => {
    let active = true;

    async function refreshSummary() {
      try {
        const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (active) {
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

  if (!summary) {
    return <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">{message}</div>;
  }

  const shouldForcePlanPicker = forcePlanPicker || openPaymentSheet || summary.status === "expired" || summary.status === "past_due";

  return (
    <OwnerBillingScreen
      initialSummary={summary}
      preferredPlanCode={preferredPlan}
      forcePlanPicker={shouldForcePlanPicker}
      openPaymentSheet={openPaymentSheet}
    />
  );
}

export default function OwnerBillingPage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">구독 정보를 불러오는 중입니다.</div>}>
      <OwnerBillingPageContent />
    </Suspense>
  );
}
