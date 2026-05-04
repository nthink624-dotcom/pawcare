"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { X } from "lucide-react";

import OwnerApp from "@/components/owner/owner-app";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { getOwnerPlanDisplayName } from "@/lib/billing/owner-plans";
import { LEGAL_BUSINESS_INFO } from "@/lib/legal/legal-info";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

type OwnedShopSummary = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

function formatServiceEndDate(summary: OwnerSubscriptionSummary) {
  const serviceEndsAt = summary.currentPeriodEndsAt ?? summary.trialEndsAt;
  return serviceEndsAt ? serviceEndsAt.slice(0, 10).replace(/-/g, ".") : "-";
}

function isTrialSummary(summary: OwnerSubscriptionSummary) {
  return (
    summary.currentPlanCode === "free" ||
    (!summary.currentPeriodStartedAt &&
      !summary.currentPeriodEndsAt &&
      (summary.status === "trialing" || summary.status === "trial_will_end" || summary.status === "expired"))
  );
}

function getCurrentPlanLabel(summary: OwnerSubscriptionSummary) {
  return isTrialSummary(summary) ? "체험 플랜" : getOwnerPlanDisplayName(summary.currentPlanCode);
}

function getResumePlanCode(summary: OwnerSubscriptionSummary) {
  return isTrialSummary(summary) ? "monthly" : summary.currentPlanCode;
}

function TrialNoticeBanner({ summary }: { summary: OwnerSubscriptionSummary }) {
  if (summary.status === "past_due" || summary.status === "expired") return null;
  if (summary.noticeLevel !== "3days" && summary.noticeLevel !== "1day") return null;

  const dismissKey = `owner-trial-banner:${summary.noticeLevel}:${summary.trialEndsAt}`;
  const [dismissed, setDismissed] = useState(false);

  const title =
    summary.noticeLevel === "1day"
      ? "체험 플랜이 내일 종료됩니다"
      : `체험 플랜이 ${summary.daysUntilTrialEnds}일 후 종료됩니다`;
  const body =
    summary.noticeLevel === "1day"
      ? "계속 사용하려면 종료 후 플랜을 확인하고 결제를 진행해 주세요. 자동결제는 되지 않습니다."
      : "미리 플랜을 확인해 두면 체험 플랜 종료 후 바로 이어서 사용할 수 있어요.";

  useEffect(() => {
    const savedDismissKey = window.localStorage.getItem("owner-trial-banner-dismissed");
    setDismissed(savedDismissKey === dismissKey);
  }, [dismissKey]);

  if (dismissed) return null;

  const handleDismiss = () => {
    window.localStorage.setItem("owner-trial-banner-dismissed", dismissKey);
    setDismissed(true);
  };

  return (
    <div className="owner-font mx-auto w-full max-w-[430px] px-4 pt-4">
      <div className="rounded-[10px] border border-[#dde3de] bg-[#fafbf9] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 pr-2 text-[17px] font-semibold tracking-[-0.03em] text-[#1d2b27]">{title}</p>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="체험 플랜 안내 닫기"
            className="shrink-0 rounded-[10px] border border-[#dfe5e0] bg-white p-2 text-[#7a847f]"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="mt-2.5 space-y-2">
          <p className="text-[14px] leading-6 tracking-[-0.02em] text-[#4f5753]">{body}</p>
          <p className="text-[13px] leading-6 tracking-[-0.02em] text-[#6c746f]">체험 플랜이 끝나도 자동으로 결제되지 않으며, 결제 전까지는 사용이 제한될 수 있습니다.</p>
        </div>
        <a
          href="/owner/billing"
          className="mt-4 flex h-[46px] w-full items-center justify-center rounded-[10px] border border-[#d8dfda] bg-white px-4 text-[15px] font-medium tracking-[-0.02em] text-[#2f5f55]"
        >
          업그레이드 플랜
        </a>
      </div>
    </div>
  );
}

function ServiceLockedScreen({ summary, onLogout, loggingOut }: { summary: OwnerSubscriptionSummary; onLogout: () => void; loggingOut: boolean }) {
  const title = summary.status === "past_due" ? "이용 재개가 필요합니다" : "이용 기간이 종료되었습니다";
  const body =
    summary.status === "past_due"
      ? "결제가 완료되지 않아 현재 예약·고객관리 기능이 일시적으로 제한되어 있습니다. 결제를 완료하면 바로 다시 이용할 수 있습니다."
      : "서비스 이용 기간이 종료되어 현재 예약·고객관리 기능이 일시적으로 제한되어 있습니다. 플랜을 다시 선택하고 결제하면 바로 이용을 재개할 수 있습니다.";
  const resumePlanCode = getResumePlanCode(summary);
  const supportHref = `mailto:${LEGAL_BUSINESS_INFO.customerServiceEmail}?subject=${encodeURIComponent("펫매니저 이용 재개 문의")}`;

  return (
    <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 py-6 text-[#111111]">
      <div className="rounded-[10px] border border-[#dfd8cc] bg-[#fffdf8] px-4 py-4 shadow-[0_10px_24px_rgba(41,41,38,0.05)]">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#335a50]">이용 재개 안내</p>
            <h1 className="mt-2 text-[23px] font-semibold tracking-[-0.04em] text-[#173b33]">{title}</h1>
            <p className="mt-2.5 max-w-[330px] text-[14px] leading-6 tracking-[-0.02em] text-[#615d56]">{body}</p>
          </div>

          <div className="rounded-[10px] border border-[#d9d2c7] bg-white px-4 py-3.5">
            <p className="text-[16px] font-medium text-[#111111]">이용 상태 요약</p>
            <div className="mt-2.5 space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[14px] font-medium text-[#7a736b]">서비스 종료일</p>
                <p className="text-[14px] font-medium text-[#173b33]">{formatServiceEndDate(summary)}</p>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-[#eee7dc] pt-2.5">
                <p className="text-[14px] font-medium text-[#7a736b]">마지막 이용 플랜</p>
                <p className="text-[14px] font-medium text-[#173b33]">{getCurrentPlanLabel(summary)}</p>
              </div>
              <div className="border-t border-[#eee7dc] pt-2.5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[14px] font-medium text-[#7a736b]">데이터 보관 상태</p>
                  <p className="text-[14px] font-medium text-[#173b33]">정상 보관 중</p>
                </div>
                <p className="mt-1.5 text-[13px] leading-5 text-[#5f5a54]">기존 고객·예약·이용 기록은 그대로 유지되며, 결제 후 바로 이어서 사용할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <a
            href={`/owner/billing?compare=1&plan=${resumePlanCode}`}
            className="flex h-[48px] items-center justify-center rounded-[10px] bg-[#1f5b51] px-4 text-[15px] font-medium text-white shadow-[0_10px_20px_rgba(31,91,81,0.12)]"
          >
            기간 연장하기
          </a>
        </div>

        <div className="mt-3">
          <a
            href={supportHref}
            className="flex h-[46px] items-center justify-center rounded-[10px] border border-[#e3ddd3] bg-white px-4 text-[15px] font-medium text-[#6b655d]"
          >
            문의하기
          </a>
        </div>
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="inline-flex h-[38px] items-center justify-center px-3 text-[12px] font-medium text-[#8b847b] disabled:opacity-60"
          >
            {loggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OwnerShell({
  initialData,
  ownedShops,
  selectedShopId,
  subscriptionSummary,
  userEmail,
  onSwitchShop,
}: {
  initialData: BootstrapPayload;
  ownedShops: OwnedShopSummary[];
  selectedShopId: string | null;
  subscriptionSummary: OwnerSubscriptionSummary | null;
  userEmail: string | null;
  onSwitchShop: (shopId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => getSupabaseBrowserClient());
  const [loggingOut, setLoggingOut] = useState(false);
  const [summary, setSummary] = useState(subscriptionSummary);
  const [redirectingToBilling, setRedirectingToBilling] = useState(false);

  useEffect(() => {
    setSummary(subscriptionSummary);
  }, [subscriptionSummary]);

  useEffect(() => {
    if (!summary || summary.status !== "past_due") {
      setRedirectingToBilling(false);
      return;
    }

    setRedirectingToBilling(true);
    router.replace(`/owner/billing?compare=1&plan=${getResumePlanCode(summary)}` as never);
  }, [router, summary]);

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
        // Keep the latest known state when background refresh fails.
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

    void refreshSummary();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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

  if (redirectingToBilling) {
    return (
      <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] px-4 py-6">
        <div className="rounded-[10px] border border-[#e3ddd3] bg-white px-4 py-4 text-[14px] leading-6 text-[#6f665f]">
          결제 화면으로 이동하고 있습니다.
        </div>
      </div>
    );
  }

  if (summary && summary.status === "expired") {
    return <ServiceLockedScreen summary={summary} onLogout={handleLogout} loggingOut={loggingOut} />;
  }

  return (
    <div className="owner-font">
      {summary ? <TrialNoticeBanner summary={summary} /> : null}
      <OwnerApp
        initialData={initialData}
        ownedShops={ownedShops}
        selectedShopId={selectedShopId}
        subscriptionSummary={summary}
        onLogout={handleLogout}
        onSwitchShop={onSwitchShop}
        loggingOut={loggingOut}
        userEmail={userEmail}
      />
    </div>
  );
}
