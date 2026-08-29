"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerServiceExpiredScreen from "@/components/owner/owner-service-expired-screen";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerAuthTokenCache, waitForOwnerAuthHydration } from "@/lib/auth/owner-auth-handoff";
import {
  isOwnerSubscriptionBlocked,
  type OwnerSubscriptionSummary,
} from "@/lib/billing/owner-subscription";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function OwnerAlimtalkCreditsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      try {
        const nextSummary = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (active) setSummary(nextSummary);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "";
        if (message === "로그인이 필요합니다." || message.includes("로그인 상태를 확인하지 못했습니다")) {
          router.replace("/login?next=/owner/alimtalk-credits" as never);
          router.refresh();
        }
      }
    }

    void loadSubscription();
    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await waitForOwnerAuthHydration();
      clearOwnerAuthTokenCache();
      await getSupabaseBrowserClient()?.auth.signOut();
    } finally {
      router.replace("/login" as never);
      router.refresh();
      setLoggingOut(false);
    }
  };

  if (!summary) return null;

  if (isOwnerSubscriptionBlocked(summary.status)) {
    return <OwnerServiceExpiredScreen summary={summary} onLogout={handleLogout} loggingOut={loggingOut} />;
  }

  return (
    <main className="owner-font min-h-screen bg-[#f8fafc] px-5 py-10 text-[#0f172a]">
      <section className="mx-auto max-w-[520px] rounded-[14px] border border-[#dbe2ea] bg-white px-6 py-7">
        <p className="text-[12px] font-semibold text-[#607080]">알림톡 이용 안내</p>
        <h1 className="mt-2 text-[24px] font-bold tracking-[-0.03em]">추가 발송 이용권 판매가 종료되었습니다</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#526070]">
          신규 월 정기 요금에는 알림톡 기능이 포함됩니다. 별도 건수 충전이나 월별 크레딧 리셋은 없습니다.
        </p>
        <Link
          href="/owner/billing"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#17243c] text-[14px] font-semibold text-white"
        >
          요금제 확인
        </Link>
      </section>
    </main>
  );
}
