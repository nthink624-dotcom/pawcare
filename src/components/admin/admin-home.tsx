"use client";

import { ArrowRight, ChevronDown, DoorOpen, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatWon, isPendingSupportRequest, type AdminDashboardAccount, type AdminRevenueSummary, type OwnerSupportRequestItem } from "@/components/admin/admin-dashboard-model";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { getDotIndicatorClass, getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { fetchApiJson } from "@/lib/api";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import type { MarketingAgentStatus, MarketingWorkStatus } from "@/types/marketing-agent";

type LoadState = "idle" | "loading" | "ready" | "partial" | "error";
const WORK_STATUS: Record<MarketingWorkStatus, { label: string; tone: StatusIndicatorTone }> = {
  running: { label: "진행 중", tone: "active" }, suspended: { label: "승인 대기", tone: "amber" },
  success: { label: "완료", tone: "confirmed" }, failed: { label: "막힘", tone: "burgundy" }, unknown: { label: "확인 필요", tone: "neutral" },
};

export default function AdminHome({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [activated, setActivated] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [requests, setRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null);
  const [marketing, setMarketing] = useState<MarketingAgentStatus | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    const results = await Promise.allSettled([
      fetchApiJson<AdminDashboardAccount>("/api/admin/session", { cache: "no-store" }),
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
      fetchApiJson<MarketingAgentStatus>("/api/admin/marketing/status", { cache: "no-store" }),
    ]);
    if (results[0].status === "fulfilled") setAccount(results[0].value);
    if (results[1].status === "fulfilled") setRequests(results[1].value.requests);
    if (results[2].status === "fulfilled") setRevenue(results[2].value);
    if (results[3].status === "fulfilled") setMarketing(results[3].value);
    const failed = results.filter((result) => result.status === "rejected").length;
    setLoadState(failed === 0 ? "ready" : failed === results.length ? "error" : "partial");
    setError(failed ? `운영 정보 ${failed}개를 불러오지 못했습니다.` : null);
  }, []);

  useEffect(() => {
    if (!activated) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [activated, refresh]);

  async function logout() {
    try { await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" }); }
    finally { router.replace("/admin/login" as never); router.refresh(); }
  }

  const currentAccount = account ?? { fullName: "관리자", loginId: sessionLoginId, isActive: true };
  const pending = requests.filter(isPendingSupportRequest);
  const visible = filter === "pending" ? pending : requests;
  const work = marketing?.workflow.currentWork ?? null;
  const workMeta = work ? WORK_STATUS[work.status] : { label: "상세 대기", tone: "neutral" as const };

  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 text-[#172033] lg:px-8 lg:py-8">
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="rounded-[20px] border border-[#dce5f0] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>{PETMANAGER_SERVICE_NAME} ADMIN</p><h1 className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>관리자 홈</h1><p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>업무 흐름을 확인하고 필요한 상세만 열어보세요.</p></div>
          <div className="flex items-center gap-2"><span className="hidden text-[13px] text-[#64748b] md:inline">{currentAccount.fullName} · {currentAccount.loginId}</span><button type="button" disabled={!activated} onClick={() => void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[#dbe4ef] bg-white px-4 text-[14px] text-[#475569] disabled:opacity-50"><RefreshCcw className="h-4 w-4" />새로고침</button><button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[#dbe4ef] bg-white px-4 text-[14px] text-[#475569]"><DoorOpen className="h-4 w-4" />로그아웃</button></div>
        </div><div className="mt-5 border-t border-[#edf2f7] pt-5"><AdminSectionNav active="home" /></div>
      </header>
      {error ? <p className={`${getWrapIndicatorClass("burgundy")} mt-4 px-4 py-3 text-[13px] text-[#a04455]`}>{error}</p> : null}
      <section className="mt-6" aria-labelledby="workflow-title">
        <div className="flex items-end justify-between gap-4"><div><p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>WORKFLOW</p><h2 id="workflow-title" className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>업무지시 → 계획 → 현황</h2></div><Link href="/admin/marketing" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[#cfe0d9] bg-white px-4 text-[14px] font-medium text-[#1f6b5b]">상세 워룸<ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3"><Flow step="1" label="업무지시" title={work?.goal ?? "상세를 열어 현재 업무 확인"} status={workMeta.label} tone={workMeta.tone} /><Flow step="2" label="계획" title={marketing?.workflow.label ?? "상세를 열어 계획 연결 확인"} status={marketing?.studio.connected ? "연결됨" : "상세 대기"} tone={marketing?.studio.connected ? "confirmed" : "neutral"} /><Flow step="3" label="현황" title={activated ? `미처리 문의 ${pending.length}건 · 승인 ${marketing?.workflow.pendingApprovals ?? 0}건` : "상세를 열면 최신 현황을 조회합니다"} status={loadState === "ready" ? "최신" : loadState === "loading" ? "조회 중" : "상세 대기"} tone={loadState === "ready" ? "confirmed" : "neutral"} /></div>
      </section>
      <section className="mt-6 grid gap-3 lg:grid-cols-2" aria-label="상세 업무">
        <Details title="문의 상세" summary={activated ? `미처리 ${pending.length}건` : "열어서 조회"} onOpen={() => setActivated(true)}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] p-4"><div className="flex gap-2">{(["pending", "all"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`inline-flex min-h-11 items-center rounded-[8px] px-4 text-[13px] font-medium ${filter === value ? "bg-[#1f6b5b] text-white" : "bg-[#f1f5f9] text-[#64748b]"}`}>{value === "pending" ? "미처리" : "전체"}</button>)}</div><button type="button" onClick={() => void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] px-4 text-[13px] text-[#64748b]"><RefreshCcw className="h-4 w-4" />새로고침</button></div><div className="divide-y divide-[#edf2f7]">{visible.slice(0, 5).map((request) => <div key={request.id} className="px-4 py-3"><p className="text-[14px] font-medium text-[#0f172a]">{request.title}</p><p className="mt-1 text-[12px] text-[#64748b]">{request.shopName ?? request.shopId}</p></div>)}{loadState !== "loading" && visible.length === 0 ? <p className="px-4 py-6 text-center text-[13px] text-[#94a3b8]">표시할 문의가 없습니다.</p> : null}</div></Details>
        <Details title="매출 상세" summary={revenue ? `이번 달 ${formatWon(revenue.monthRevenue)}` : "열어서 조회"} onOpen={() => setActivated(true)}><div className="grid grid-cols-2 gap-px bg-[#edf2f7]"><Metric label="이번 달" value={formatWon(revenue?.monthRevenue ?? 0)} /><Metric label="예상 월 매출" value={formatWon(revenue?.expectedMonthlyRecurringRevenue ?? 0)} /><Metric label="오늘" value={formatWon(revenue?.todayRevenue ?? 0)} /><Metric label="유료 이용 매장" value={`${revenue?.activePaidSubscriptions ?? 0}곳`} /></div><Link href="/owner/admin" className="flex min-h-11 items-center justify-between border-t border-[#edf2f7] px-4 text-[13px] font-semibold text-[#1f6b5b]">오너 계정 관리<ArrowRight className="h-4 w-4" /></Link></Details>
      </section>
    </div>
  </main>;
}

function Flow({ step, label, title, status, tone }: { step: string; label: string; title: string; status: string; tone: StatusIndicatorTone }) { return <article className={`${getWrapIndicatorClass(tone)} px-4 py-4`}><div className="flex items-center justify-between gap-3"><p className="text-[12px] text-[#64748b]">{step}. {label}</p><span className="inline-flex items-center gap-2 text-[12px] text-[#475569]"><span className={getDotIndicatorClass(tone)} />{status}</span></div><p className="mt-2 text-[14px] font-medium text-[#0f172a]">{title}</p></article>; }
function Details({ title, summary, onOpen, children }: { title: string; summary: string; onOpen: () => void; children: React.ReactNode }) { return <details onToggle={(event) => { if (event.currentTarget.open) onOpen(); }} className="group overflow-hidden rounded-[12px] border border-[#dce5f0] bg-white"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-[#334155]"><span>{title}</span><span className="flex items-center gap-2 text-[13px] font-normal text-[#64748b]">{summary}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span></summary><div className="border-t border-[#edf2f7]">{children}</div></details>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white px-4 py-4"><p className="text-[12px] text-[#64748b]">{label}</p><p className="mt-1 text-[17px] font-semibold text-[#0f172a]">{value}</p></div>; }
