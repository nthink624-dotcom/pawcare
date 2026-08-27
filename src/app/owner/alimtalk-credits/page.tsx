"use client";

import { BellRing, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import OwnerServiceExpiredScreen from "@/components/owner/owner-service-expired-screen";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import {
  OWNER_SINGLE_PLAN_INCLUDED_COPY,
  OWNER_SINGLE_PLAN_LIMIT_COPY,
} from "@/lib/billing/owner-plans";
import {
  isOwnerSubscriptionBlocked,
  type OwnerSubscriptionSummary,
} from "@/lib/billing/owner-subscription";

export default function OwnerAlimtalkCreditsPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<OwnerSubscriptionSummary | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("요금제 정보를 불러오는 중입니다.");

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      try {
        const nextSubscription = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (!active) return;
        writeOwnerBillingSummaryCache(nextSubscription);
        setSubscription(nextSubscription);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "요금제 정보를 불러오지 못했습니다.";
        if (message === "로그인이 필요합니다." || message.includes("로그인 상태를 확인하지 못했습니다.")) {
          router.replace("/login?next=/owner/alimtalk-credits" as never);
          router.refresh();
          return;
        }
        setLoadingMessage(message);
      }
    }

    void loadSubscription();
    return () => {
      active = false;
    };
  }, [router]);

  if (subscription && isOwnerSubscriptionBlocked(subscription.status)) {
    return <OwnerServiceExpiredScreen summary={subscription} />;
  }

  if (!subscription) {
    return (
      <div className="owner-font min-h-screen bg-[#f8fafc] px-5 py-8 text-[#0f172a]">
        <div className="mx-auto max-w-[720px] rounded-xl border border-[#e2e8f0] bg-white px-5 py-4 text-sm font-medium text-[#64748b]">
          {loadingMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="owner-font min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <main className="mx-auto flex min-h-screen max-w-[760px] flex-col px-5 py-5 sm:px-8 sm:py-8">
        <Link
          href="/owner"
          prefetch
          className="inline-flex h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-[14px] font-semibold text-[#64748b] transition hover:bg-white hover:text-[#0f172a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          운영 홈
        </Link>

        <section className="mt-4 rounded-[14px] border border-[#e2e8f0] bg-white p-6 sm:p-8" aria-labelledby="alimtalk-policy-title">
          <BellRing className="h-6 w-6 text-[#111827]" aria-hidden="true" />
          <h1 id="alimtalk-policy-title" className="mt-4 text-[26px] font-bold tracking-[-0.03em] text-[#111827]">
            알림톡은 요금제에 포함됩니다
          </h1>
          <p className="mt-3 text-[16px] font-medium leading-7 text-[#374151]">{OWNER_SINGLE_PLAN_INCLUDED_COPY}</p>
          <p className="mt-3 text-[14px] leading-6 text-[#6b7280]">{OWNER_SINGLE_PLAN_LIMIT_COPY}</p>
          <Link
            href="/owner/billing?plan=quarterly"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-[9px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]"
          >
            요금제 확인
          </Link>
        </section>
      </main>
    </div>
  );
}
