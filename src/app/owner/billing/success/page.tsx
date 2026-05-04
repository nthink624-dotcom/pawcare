"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { OwnerBillingSuccessCard } from "@/components/owner/owner-billing-flow-shared";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { getOwnerPlanByCode, getOwnerPlanDisplayName, type OwnerPlan } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { won } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function hasSuccessfulPayment(summary: OwnerSubscriptionSummary) {
  return summary.lastPaymentStatus === "paid" || summary.status === "active";
}

function getPlanSelectionLine(plan: OwnerPlan) {
  if (plan.code === "monthly") {
    return "총 12,900원";
  }
  return plan.totalLabel ?? `총 ${won(plan.totalPrice)}`;
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
  const [message, setMessage] = useState("결제 내용을 확인하고 있어요.");

  const snapshotPlan = getSnapshotPlan(searchParams);
  const snapshotEndAt = searchParams.get("endAt");
  const snapshotMethod = searchParams.get("method");
  const hasSnapshot = Boolean(snapshotPlan || snapshotEndAt || snapshotMethod);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("결제 내용을 다시 확인해 주세요.");
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
            setMessage("선택하신 플랜이 정상적으로 적용되었어요.");
            return;
          }
        } catch (error) {
          if (!active) return;
          const nextMessage = error instanceof Error ? error.message : "결제 내용을 다시 불러오지 못했습니다.";
          if (nextMessage === "로그인이 필요합니다.") {
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
        setMessage("결제 결과를 다시 확인해 주세요.");
        return;
      }

      setMessage("결제는 완료되었고 상세 정보만 다시 불러오는 중이에요.");
    }

    void load();
    return () => {
      active = false;
    };
  }, [hasSnapshot, router, supabase]);

  const displayPlan = summary?.currentPlan ?? snapshotPlan ?? getOwnerPlanByCode("monthly");
  const displayPlanLabel =
    summary?.currentPlanCode && getOwnerPlanByCode(summary.currentPlanCode)
      ? getOwnerPlanDisplayName(summary.currentPlanCode)
      : snapshotPlan
        ? getOwnerPlanDisplayName(snapshotPlan.code)
        : "플랜";
  const displayEndAt =
    summary?.currentPeriodEndsAt ?? summary?.nextBillingAt ?? snapshotEndAt ?? summary?.trialEndsAt ?? null;
  const displayMethod = summary?.paymentMethodLabel ?? snapshotMethod;

  if (!displayPlan) {
    return <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">{message}</div>;
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
          결제 내용을 확인하고 있어요.
        </div>
      }
    >
      <OwnerBillingSuccessPageContent />
    </Suspense>
  );
}
