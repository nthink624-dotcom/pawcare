"use client";

import {
  ArrowRight,
  ChevronDown,
  DoorOpen,
  MessageSquareText,
  RefreshCcw,
  Store,
  TrendingUp,
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
import PetManagerBrand from "@/components/brand/petmanager-brand";
import {
  getDotIndicatorClass,
  getWrapIndicatorClass,
  type StatusIndicatorTone,
} from "@/components/owner-web/status-indicators";
import { fetchApiJson } from "@/lib/api";
import type { MarketingAgentStatus, MarketingWorkStatus } from "@/types/marketing-agent";

type LoadState = "loading" | "ready" | "partial" | "error";

const WORK_STATUS: Record<MarketingWorkStatus, { label: string; tone: StatusIndicatorTone }> = {
  running: { label: "진행 중", tone: "active" },
  suspended: { label: "승인 대기", tone: "amber" },
  success: { label: "완료", tone: "confirmed" },
  failed: { label: "막힘", tone: "burgundy" },
  unknown: { label: "확인 필요", tone: "neutral" },
};

export default function AdminDashboard({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [supportRequests, setSupportRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<AdminRevenueSummary | null>(null);
  const [marketingStatus, setMarketingStatus] = useState<MarketingAgentStatus | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [supportSavingId, setSupportSavingId] = useState<string | null>(null);
  const [detailsActivated, setDetailsActivated] = useState(false);

  const loadDashboard = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchApiJson<AdminDashboardAccount>("/api/admin/session", { cache: "no-store" }),
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
      fetchApiJson<MarketingAgentStatus>("/api/admin/marketing/status", { cache: "no-store" }),
    ]);

    if (results[0].status === "fulfilled") setAccount(results[0].value);
    if (results[1].status === "fulfilled") setSupportRequests(results[1].value.requests);
    if (results[2].status === "fulfilled") setRevenueSummary(results[2].value);
    if (results[3].status === "fulfilled") setMarketingStatus(results[3].value);

    const failedCount = results.filter((result) => result.status === "rejected").length;
    setLoadState(failedCount === 0 ? "ready" : failedCount === results.length ? "error" : "partial");
    setError(failedCount ? "일부 운영 정보를 확인하지 못했습니다. 확인되지 않은 값은 집계 대기로 표시합니다." : null);
  }, []);

  useEffect(() => {
    if (!detailsActivated) return;
    void loadDashboard();
    const timer = window.setInterval(() => void loadDashboard(), 30_000);
    return () => window.clearInterval(timer);
  }, [detailsActivated, loadDashboard]);

  async function updateSupportRequest(
    id: string,
    status: OwnerSupportRequestStatus,
    adminNote: string,
    answerMessage = "",
  ) {
    setSupportSavingId(id);
    try {
      const response = await fetchApiJson<{ request: OwnerSupportRequestItem }>("/api/admin/support-requests", {
        method: "PATCH",
        body: JSON.stringify({ id, status, adminNote, answerMessage }),
      });
      setSupportRequests((current) => current.map((item) => (item.id === id ? response.request : item)));
      setError(null);
      return true;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "문의 내용을 저장하지 못했습니다.");
      return false;
    } finally {
      setSupportSavingId(null);
    }
  }

  async function handleLogout() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  const currentAccount = account ?? { fullName: "관리자", loginId: sessionLoginId };
  const currentWork = marketingStatus?.workflow.currentWork ?? null;
  const workMeta = currentWork ? WORK_STATUS[currentWork.status] : { label: "업무 없음", tone: "neutral" as const };
  const pendingSupport = supportRequests.filter(isPendingSupportRequest).length;
  const nextAction = currentWork
    ? currentWork.status === "suspended"
      ? "승인 대기 내용을 확인하세요."
      : currentWork.status === "failed"
        ? "막힌 원인을 확인하세요."
        : "마케팅 워룸에서 다음 단계를 확인하세요."
    : "새 업무 지시를 기다립니다.";

  return (
    <main className="min-h-screen bg-[#f4f6f5] px-4 py-5 text-[#172033] md:px-7 md:py-6">
      <div className="mx-auto w-full max-w-[1380px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe2df] pb-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin" aria-label="펫매니저 관리자 홈" className="inline-flex min-h-11 items-center rounded-[8px]">
              <PetManagerBrand imageClassName="h-6" nameClassName="text-[17px] text-[#1f6b5b]" />
            </Link>
            <div className="min-w-0 border-l border-[#dbe2df] pl-4">
              <h1 className="text-[20px] font-semibold leading-7 text-[#0f172a]">관리자 홈</h1>
              <p className="truncate text-[13px] leading-5 text-[#64748b]">{currentAccount.fullName} · {currentAccount.loginId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadDashboard()} disabled={!detailsActivated} title={detailsActivated ? "운영 정보 새로고침" : "상세를 열면 새로고침할 수 있습니다"} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#475569] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50">
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />새로고침
            </button>
            <button type="button" onClick={() => void handleLogout()} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#475569] hover:bg-[#f8fafc]">
              <DoorOpen className="h-4 w-4" aria-hidden="true" />로그아웃
            </button>
          </div>
        </header>

        {error ? <p role="alert" className={`${getWrapIndicatorClass("burgundy")} mt-3 rounded-[8px] px-4 py-3 text-[13px] leading-5 text-[#a04455]`}>{error}</p> : null}

        <section className="mt-4" aria-labelledby="work-flow-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[12px] leading-[18px] text-[#1f6b5b]">현재 운영 흐름</p>
              <h2 id="work-flow-title" className="text-[16px] font-semibold leading-6 text-[#0f172a]">업무지시 → 계획 → 현황</h2>
            </div>
            <Link href="/admin/marketing" className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#cfe0d9] bg-white px-4 text-[14px] font-medium text-[#1f6b5b] hover:bg-[#f5faf8]">상세 워룸<ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            <FlowCard step="1" label="업무지시" title={currentWork?.goal ?? "진행 중인 업무 없음"} status={workMeta.label} owner="성장팀" nextAction={nextAction} tone={workMeta.tone} />
            <FlowCard step="2" label="계획" title={marketingStatus?.workflow.label ?? "계획 연결 확인 중"} status={marketingStatus?.studio.connected ? "연결됨" : "확인 필요"} owner="마케팅 워룸" nextAction={marketingStatus?.studio.connected ? "현재 실행 단계를 확인하세요." : "연결 상태를 확인하세요."} tone={marketingStatus?.studio.connected ? "confirmed" : "amber"} />
            <FlowCard step="3" label="현황" title={`문의 ${pendingSupport}건 · 승인 ${marketingStatus?.workflow.pendingApprovals ?? 0}건`} status={loadState === "ready" ? "최신" : loadState === "loading" ? "확인 중" : "일부 확인"} owner="운영 관리자" nextAction={pendingSupport ? "미처리 문의를 확인하세요." : "추가 조치가 없습니다."} tone={pendingSupport ? "amber" : loadState === "ready" ? "confirmed" : "neutral"} />
          </div>
          <WorkflowGraph
            hasInstruction={Boolean(currentWork)}
            planConnected={Boolean(marketingStatus?.studio.connected)}
            statusReady={loadState === "ready"}
          />
        </section>

        <section className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="운영 요약">
          <Metric icon={MessageSquareText} label="미처리 문의" value={`${pendingSupport}건`} />
          <Metric icon={WalletCards} label="이번 달 매출" value={revenueSummary ? formatWon(revenueSummary.monthRevenue) : "집계 대기"} />
          <Metric icon={TrendingUp} label="예상 월 매출" value={revenueSummary ? formatWon(revenueSummary.expectedMonthlyRecurringRevenue) : "집계 대기"} />
          <Metric icon={Store} label="유료 이용 매장" value={revenueSummary ? `${revenueSummary.activePaidSubscriptions}곳` : "집계 대기"} />
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-2" aria-label="상세 업무">
          <DetailEntry title="문의 상세" summary={`미처리 ${pendingSupport}건`} onOpen={() => setDetailsActivated(true)}>
            <AdminSupportInbox requests={supportRequests} error={error} loading={loadState === "loading"} savingId={supportSavingId} onRefresh={() => void loadDashboard()} onUpdate={updateSupportRequest} />
          </DetailEntry>
          <DetailEntry title="매출 상세" summary={revenueSummary ? `이번 달 ${formatWon(revenueSummary.monthRevenue)}` : "집계 대기"} onOpen={() => setDetailsActivated(true)}>
            <AdminRevenueOverview summary={revenueSummary} error={error} onRefresh={() => void loadDashboard()} />
          </DetailEntry>
        </section>
      </div>
    </main>
  );
}

function FlowCard({ step, label, title, status, owner, nextAction, tone }: { step: string; label: string; title: string; status: string; owner: string; nextAction: string; tone: StatusIndicatorTone }) {
  return (
    <article className={`${getWrapIndicatorClass(tone)} rounded-[8px] px-4 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] leading-[18px] text-[#64748b]">{step}. {label}</p>
        <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#475569]"><span className={getDotIndicatorClass(tone)} aria-hidden="true" />{status}</span>
      </div>
      <h3 className="mt-1 line-clamp-2 text-[14px] font-medium leading-5 text-[#0f172a]">{title}</h3>
      <dl className="mt-2 grid gap-1 text-[12px] leading-[18px] sm:grid-cols-[64px_1fr]">
        <dt className="text-[#94a3b8]">담당</dt><dd className="text-[#475569]">{owner}</dd>
        <dt className="text-[#94a3b8]">다음 행동</dt><dd className="text-[#2563eb]">{nextAction}</dd>
      </dl>
    </article>
  );
}

function WorkflowGraph({ hasInstruction, planConnected, statusReady }: { hasInstruction: boolean; planConnected: boolean; statusReady: boolean }) {
  const stages = [
    { label: "업무지시", ready: hasInstruction },
    { label: "계획", ready: planConnected },
    { label: "현황", ready: statusReady },
  ];

  return (
    <div className="mt-2 rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3" aria-label="업무 진행 그래프">
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2" role="img" aria-label={stages.map((stage) => `${stage.label} ${stage.ready ? "준비됨" : "확인 필요"}`).join(", ")}>
        {stages.map((stage, index) => (
          <div key={stage.label} className="contents">
            <div className="flex min-w-0 flex-col items-center gap-1 text-center">
              <span className={`h-3 w-3 rounded-full ${stage.ready ? "bg-[#1f9d55]" : "bg-[#b9c3cf]"}`} aria-hidden="true" />
              <span className="text-[12px] leading-[18px] text-[#475569]">{stage.label}</span>
            </div>
            {index < stages.length - 1 ? <span className={`h-px ${stages[index + 1].ready ? "bg-[#1f9d55]" : "bg-[#dbe2ea]"}`} aria-hidden="true" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return <div className="flex min-h-[68px] items-center gap-3 rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3"><Icon className="h-4 w-4 shrink-0 text-[#607080]" aria-hidden="true" /><div className="min-w-0"><p className="text-[12px] leading-[18px] text-[#64748b]">{label}</p><p className="truncate text-[16px] font-semibold leading-6 text-[#111827]">{value}</p></div></div>;
}

function DetailEntry({ title, summary, onOpen, children }: { title: string; summary: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <details onToggle={(event) => { if (event.currentTarget.open) onOpen(); }} className="group overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-[#334155] hover:bg-[#f8fafc]">
        <span>{title}</span><span className="flex items-center gap-2 text-[13px] font-normal text-[#64748b]">{summary}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
      </summary>
      <div className="border-t border-[#eef2f6] p-2">{children}</div>
    </details>
  );
}
