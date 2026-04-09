"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import OwnerApp from "@/components/owner/owner-app";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

function TrialNoticeBanner({ summary }: { summary: OwnerSubscriptionSummary }) {
  if (summary.status === "past_due" || summary.status === "expired") return null;
  if (summary.noticeLevel !== "3days" && summary.noticeLevel !== "1day") return null;

  const title =
    summary.noticeLevel === "1day"
      ? "무료체험이 내일 종료됩니다"
      : `무료체험이 ${summary.daysUntilTrialEnds}일 후 종료됩니다`;
  const body =
    summary.noticeLevel === "1day"
      ? "계속 사용하려면 종료 후 플랜을 확인하고 결제를 진행해 주세요. 자동결제는 되지 않습니다."
      : "미리 플랜을 확인해 두면 무료체험 종료 후 바로 이어서 사용할 수 있어요.";

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pt-4">
      <div className="rounded-[22px] border border-[#cfe0da] bg-[#eef8f3] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#18211f]">{title}</p>
            <p className="mt-1 text-[13px] leading-5 text-[#5f5a54]">{body}</p>
            <p className="mt-2 text-[12px] text-[#6d746f]">무료체험이 끝나도 자동으로 결제되지 않으며, 결제 전까지는 사용이 제한될 수 있습니다.</p>
          </div>
          <a
            href="/owner/billing"
            className="shrink-0 rounded-full border border-[#1f5b51] bg-white px-3 py-2 text-xs font-semibold text-[#1f5b51]"
          >
            플랜 보기
          </a>
        </div>
      </div>
    </div>
  );
}

function ServiceLockedScreen({ summary, onLogout, loggingOut }: { summary: OwnerSubscriptionSummary; onLogout: () => void; loggingOut: boolean }) {
  const title = summary.status === "past_due" ? "결제가 필요합니다" : "무료체험이 종료되었습니다";
  const body =
    summary.status === "past_due"
      ? "결제가 완료되지 않아 현재 서비스 사용이 제한되어 있습니다. 카드 정보를 확인하고 다시 결제하면 바로 이용을 재개할 수 있어요."
      : "2주 무료체험이 종료되었습니다. 계속 사용하려면 플랜을 확인하고 결제를 진행해 주세요.";

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 py-6 text-[#111111]">
      <div className="rounded-[28px] border border-[#dfd8cc] bg-[#fffdf8] px-5 py-6 shadow-[0_10px_30px_rgba(41,41,38,0.05)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">멍매니저 이용 상태</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#173b33]">{title}</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#615d56]">{body}</p>

        <div className="mt-5 rounded-[22px] border border-[#d9d2c7] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#111111]">현재 선택된 플랜</p>
          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-[#173b33]">{summary.currentPlan.name}</p>
          <p className="mt-1 text-sm leading-6 text-[#6e6a61]">
            무료체험 종료일 {summary.trialEndsAt.slice(0, 10).replace(/-/g, ".")}
            {summary.currentPeriodEndsAt ? ` · 현재 이용 종료일 ${summary.currentPeriodEndsAt.slice(0, 10).replace(/-/g, ".")}` : ""}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-[#6e6a61]">로그인과 플랜 확인, 결제 관련 기능은 계속 사용할 수 있습니다.</p>
        </div>

        <div className="mt-5 grid gap-2.5">
          <a
            href="/owner/billing"
            className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#1f5b51] px-4 text-[15px] font-semibold text-white"
          >
            플랜 및 결제 관리 열기
          </a>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="flex h-[52px] items-center justify-center rounded-[18px] border border-[#ddd6ca] bg-white px-4 text-[15px] font-semibold text-[#1f5b51] disabled:opacity-60"
          >
            {loggingOut ? "로그아웃 중..." : "다른 계정으로 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OwnerShell({
  initialData,
  subscriptionSummary,
  userEmail,
}: {
  initialData: BootstrapPayload;
  subscriptionSummary: OwnerSubscriptionSummary | null;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => getSupabaseBrowserClient());
  const [loggingOut, setLoggingOut] = useState(false);
  const [summary, setSummary] = useState(subscriptionSummary);

  useEffect(() => {
    setSummary(subscriptionSummary);
  }, [subscriptionSummary]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      router.replace("/login" as never);
      router.refresh();
      setLoggingOut(false);
    }
  };

  if (summary && (summary.status === "expired" || summary.status === "past_due")) {
    return <ServiceLockedScreen summary={summary} onLogout={handleLogout} loggingOut={loggingOut} />;
  }

  return (
    <>
      {summary ? <TrialNoticeBanner summary={summary} /> : null}
      <OwnerApp
        initialData={initialData}
        subscriptionSummary={summary}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        userEmail={userEmail}
      />
    </>
  );
}
