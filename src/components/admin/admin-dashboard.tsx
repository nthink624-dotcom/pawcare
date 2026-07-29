"use client";

import {
  DoorOpen,
  Lightbulb,
  MessageSquareText,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  formatWon,
  isPendingSupportRequest,
  type AdminDashboardAccount,
  type AdminRevenueSummary,
  type OwnerSupportRequestItem,
  type OwnerSupportRequestStatus,
} from "@/components/admin/admin-dashboard-model";
import AdminRevenueOverview from "@/components/admin/admin-revenue-overview";
import AdminSupportInbox from "@/components/admin/admin-support-inbox";
import { fetchApiJson } from "@/lib/api";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export default function AdminDashboard({
  sessionLoginId,
}: {
  sessionLoginId: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [supportRequests, setSupportRequests] = useState<
    OwnerSupportRequestItem[]
  >([]);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportSavingId, setSupportSavingId] = useState<string | null>(null);
  const [revenueSummary, setRevenueSummary] =
    useState<AdminRevenueSummary | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const nextAccount = await fetchApiJson<AdminDashboardAccount>(
        "/api/admin/session",
        { cache: "no-store" },
      );
      setAccount(nextAccount);
      setAccountError(null);
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "관리자 정보를 불러오지 못했습니다.",
      );
    }
  }, []);

  const loadSupportRequests = useCallback(async () => {
    setSupportLoading(true);
    try {
      const response = await fetchApiJson<{
        requests: OwnerSupportRequestItem[];
      }>("/api/admin/support-requests?limit=50", { cache: "no-store" });
      setSupportRequests(response.requests);
      setSupportError(null);
    } catch (error) {
      setSupportError(
        error instanceof Error
          ? error.message
          : "문의 내역을 불러오지 못했습니다.",
      );
    } finally {
      setSupportLoading(false);
    }
  }, []);

  const loadRevenueSummary = useCallback(async () => {
    try {
      const response = await fetchApiJson<AdminRevenueSummary>(
        "/api/admin/revenue-summary",
        { cache: "no-store" },
      );
      setRevenueSummary(response);
      setRevenueError(null);
    } catch (error) {
      setRevenueError(
        error instanceof Error
          ? error.message
          : "매출 요약을 불러오지 못했습니다.",
      );
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      loadAccount(),
      loadSupportRequests(),
      loadRevenueSummary(),
    ]);

    const refreshTimer = window.setInterval(() => {
      void loadSupportRequests();
    }, 30_000);

    return () => window.clearInterval(refreshTimer);
  }, [loadAccount, loadRevenueSummary, loadSupportRequests]);

  async function updateSupportRequest(
    id: string,
    status: OwnerSupportRequestStatus,
    adminNote: string,
    answerMessage = "",
  ) {
    setSupportSavingId(id);
    try {
      const response = await fetchApiJson<{
        request: OwnerSupportRequestItem;
      }>("/api/admin/support-requests", {
        method: "PATCH",
        body: JSON.stringify({ id, status, adminNote, answerMessage }),
      });
      setSupportRequests((current) =>
        current.map((item) => (item.id === id ? response.request : item)),
      );
      setSupportError(null);
      return true;
    } catch (error) {
      setSupportError(
        error instanceof Error
          ? error.message
          : "문의 내용을 저장하지 못했습니다.",
      );
      return false;
    } finally {
      setSupportSavingId(null);
    }
  }

  async function handleLogout() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  const currentAccount = account ?? {
    fullName: "관리자",
    loginId: sessionLoginId,
    isActive: true,
  };
  const pendingCount = supportRequests.filter(isPendingSupportRequest).length;
  const pendingFeatureCount = supportRequests.filter(
    (request) =>
      request.category === "feature_request" &&
      isPendingSupportRequest(request),
  ).length;

  return (
    <main className="min-h-screen bg-[#f4f6f5] px-4 py-4 text-[#172033] md:px-6">
      <div className="mx-auto w-full max-w-[1360px]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[#1f6b5b]">
              {PETMANAGER_SERVICE_NAME}
            </p>
            <h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-[#0f172a]">
              운영 관리자
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[13px] text-[#64748b] sm:inline">
              {currentAccount.fullName} · {currentAccount.loginId}
            </span>
            <Link
              href="/owner/admin"
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              <Store className="h-4 w-4" />
              오너 계정
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#64748b] hover:bg-[#f8fafc]"
            >
              <DoorOpen className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </header>

        {accountError ? (
          <p className="mt-3 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] text-[#a04455]">
            {accountError}
          </p>
        ) : null}

        <section className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={MessageSquareText}
            label="미처리 문의"
            value={`${pendingCount}건`}
            emphasis={pendingCount > 0}
          />
          <SummaryCard
            icon={Lightbulb}
            label="기능 개선 미처리"
            value={`${pendingFeatureCount}건`}
            emphasis={pendingFeatureCount > 0}
          />
          <SummaryCard
            icon={WalletCards}
            label="이번 달 매출"
            value={formatWon(revenueSummary?.monthRevenue ?? 0)}
          />
          <SummaryCard
            icon={Store}
            label="유료 이용 매장"
            value={`${revenueSummary?.activePaidSubscriptions ?? 0}곳`}
          />
        </section>

        <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AdminSupportInbox
            requests={supportRequests}
            error={supportError}
            loading={supportLoading}
            savingId={supportSavingId}
            onRefresh={() => void loadSupportRequests()}
            onUpdate={updateSupportRequest}
          />
          <AdminRevenueOverview
            summary={revenueSummary}
            error={revenueError}
            onRefresh={() => void loadRevenueSummary()}
          />
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: typeof MessageSquareText;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-h-[74px] items-center gap-3 rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-3">
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ${
          emphasis
            ? "bg-[#fff4e8] text-[#a46619]"
            : "bg-[#edf6f2] text-[#1f6b5b]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-[#64748b]">{label}</p>
        <p className="mt-0.5 truncate text-[18px] font-semibold text-[#111827]">
          {value}
        </p>
      </div>
    </div>
  );
}
