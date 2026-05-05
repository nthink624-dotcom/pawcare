"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { OwnerBillingSuccessCard } from "@/components/owner/owner-billing-flow-shared";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { getOwnerPlanByCode, type OwnerPlan } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { won } from "@/lib/utils";

function hasSuccessfulPayment(summary: OwnerSubscriptionSummary) {
  return summary.lastPaymentStatus === "paid" || summary.status === "active";
}

function getSnapshotPlan(searchParams: Pick<URLSearchParams, "get">) {
  const rawPlanCode = searchParams.get("plan");
  return rawPlanCode ? getOwnerPlanByCode(rawPlanCode) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function OwnerBillingSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [summary, setSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [message, setMessage] = useState("결제 완료 내용을 확인하고 있어요.");

  const snapshotPlan = getSnapshotPlan(searchParams);
  const snapshotEndAt = searchParams.get("endAt");
  const snapshotMethod = searchParams.get("method");
  const hasSnapshot = Boolean(snapshotPlan || snapshotEndAt || snapshotMethod);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("결제 완료 내용을 확인할 수 없어요.");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login?next=/owner/billing/success" as never);
        router.refresh();
        return;
      }

      const maxAttempts = hasSnapshot ? 4 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
            cache: "no-store",
          });

          if (!active) return;

          if (hasSuccessfulPayment(nextSummary)) {
            setSummary(nextSummary);
            setMessage("선택하신 플랜이 적용되어 지금 바로 서비스를 이용하실 수 있어요.");
            return;
          }
        } catch (error) {
          if (!active) return;
          const nextMessage = error instanceof Error ? error.message : "결제 완료 정보를 불러오는 중 문제가 발생했습니다.";
          if (nextMessage === "인증 정보가 필요합니다.") {
            router.replace("/login?next=/owner/billing/success" as never);
            router.refresh();
            return;
          }
          setMessage(nextMessage);
        }

        if (attempt < maxAttempts - 1) {
          await sleep(700);
        }
      }

      if (!active) return;

      if (!hasSnapshot) {
        setMessage("결제 완료 내용을 확인할 수 없어요.");
        return;
      }

      setMessage("결제는 완료되었지만 최신 플랜 정보를 불러오는 데 시간이 조금 더 필요합니다.");
    }

    void load();
    return () => {
      active = false;
    };
  }, [hasSnapshot, router, supabase]);

  const displayPlan: OwnerPlan | null = summary?.currentPlan ?? snapshotPlan ?? getOwnerPlanByCode("monthly");
  const displayEndAt =
    summary?.currentPeriodEndsAt ?? summary?.nextBillingAt ?? snapshotEndAt ?? summary?.trialEndsAt ?? null;
  const displayMethod = summary?.paymentMethodLabel ?? snapshotMethod;

  if (!displayPlan) {
    return (
      <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">
        {message}
      </div>
    );
  }

  return (
    <OwnerBillingSuccessCard
      plan={displayPlan}
      endAt={displayEndAt}
      paymentMethodLabel={displayMethod}
      message={message}
      onClose={() => router.push("/owner")}
      onConfirm={() => router.push("/owner")}
    />
  );
}

export default function OwnerBillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">
          결제 완료 내용을 확인하고 있어요.
        </div>
      }
    >
      <OwnerBillingSuccessPageContent />
    </Suspense>
  );
}
