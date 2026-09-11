"use client";

import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  MessageCircle,
  RefreshCcw,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatAdminDateTime,
  formatWon,
  isPendingSupportRequest,
  supportRequestCategoryLabels,
  supportRequestStatusLabels,
  type AdminRevenueSummary,
  type OwnerSupportRequestItem,
} from "@/components/admin/admin-dashboard-model";
import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import { adaptAdminWorkItems, ADMIN_WORK_STAGES, type AdminWorkCard, type AdminWorkStage } from "@/components/admin/admin-kanban";
import AdminSupportRequestDetail from "@/components/admin/admin-support-request-detail";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import PetManagerBrand from "@/components/brand/petmanager-brand";
import { getDotIndicatorClass, getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { fetchApiJson } from "@/lib/api";
import type { AdminAoCard, AdminAoCardDetail, AdminAoDashboardSnapshot, AdminAoLaneId } from "@/types/admin-ao-dashboard";

type LoadState = "idle" | "loading" | "ready" | "partial" | "error";

export default function AdminHome({ adminName = "관리자님" }: { adminName?: string }) {
  const router = useRouter();
  const [activated, setActivated] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [requests, setRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [selectedSupportRequest, setSelectedSupportRequest] = useState<OwnerSupportRequestItem | null>(null);
  const [selectedWork, setSelectedWork] = useState<AdminWorkCard | null>(null);
  const [workSnapshot, setWorkSnapshot] = useState<AdminAoDashboardSnapshot | null>(null);
  const supportDetailsRef = useRef<HTMLDetailsElement>(null);
  const supportSummaryRef = useRef<HTMLElement>(null);
  const supportRequestTriggerRef = useRef<HTMLButtonElement | null>(null);
  const revenueDetailsRef = useRef<HTMLDetailsElement>(null);
  const revenueSummaryRef = useRef<HTMLElement>(null);
  const workTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadWorkItems = useCallback(async () => {
    try {
      setWorkSnapshot(await fetchApiJson<AdminAoDashboardSnapshot>("/api/admin/ao-dashboard", { cache: "no-store" }));
    } catch {
      setWorkSnapshot({
        checkedAt: new Date().toISOString(),
        connection: "unavailable",
        connectionLabel: "연결 전",
        lanes: [
          { id: "queued", title: "지시사항", cards: [] },
          { id: "working", title: "작업중", cards: [] },
          { id: "action", title: "조치필요", cards: [] },
          { id: "review", title: "검수필요", cards: [] },
          { id: "completed", title: "완료", cards: [] },
        ],
      });
      setError("업무 원장을 확인하지 못했습니다.");
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    const results = await Promise.allSettled([
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
    ]);
    if (results[0].status === "fulfilled") {
      setRequests(results[0].value.requests);
      setSupportError(null);
      setLoadState("ready");
    } else {
      setSupportError(
        getAdminErrorMessage(results[0].reason, "고객 문의를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."),
      );
      setLoadState("error");
    }
    if (results[1].status === "fulfilled") setRevenue(results[1].value);
    const failed = results.filter((result) => result.status === "rejected").length;
    setError(failed ? `운영 정보 ${failed}개를 불러오지 못했습니다.` : null);
  }, []);

  useEffect(() => {
    void loadWorkItems();
    const timer = window.setInterval(() => void loadWorkItems(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadWorkItems]);

  useEffect(() => {
    if (!activated) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [activated, refresh]);

  const openSupport = useCallback(() => {
    setActivated(true);
    if (supportDetailsRef.current) supportDetailsRef.current.open = true;
    window.history.replaceState(null, "", "#customer-support");
    window.requestAnimationFrame(() => supportSummaryRef.current?.focus());
  }, []);

  const openRevenue = useCallback(() => {
    setActivated(true);
    if (revenueDetailsRef.current) revenueDetailsRef.current.open = true;
    window.history.replaceState(null, "", "#revenue");
    window.requestAnimationFrame(() => revenueSummaryRef.current?.focus());
  }, []);

  useEffect(() => {
    if (window.location.hash === "#customer-support") openSupport();
    if (window.location.hash === "#revenue") openRevenue();
  }, [openRevenue, openSupport]);

  async function logout() { try { await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" }); } finally { router.replace("/admin/login" as never); router.refresh(); } }

  const pending = requests.filter(isPendingSupportRequest);
  const visibleRequests = filter === "pending" ? pending : requests;
  const workItems = adaptAdminWorkItems(workSnapshot?.lanes.flatMap((lane) => lane.cards.map((card) => cardToWorkItem(card, lane.id))) ?? null);
  const snapshotHasCounts = workSnapshot?.connection === "connected" || workSnapshot?.connection === "limited";
  const laneCount = (lane: AdminAoLaneId) => workSnapshot?.lanes.find((item) => item.id === lane)?.cards.length ?? 0;
  const queuedCount = laneCount("queued");
  const actionCount = laneCount("action");
  const isLimited = workSnapshot?.connection === "limited";
  const greetingName = adminName.trim() || "관리자님";
  const greetingLabel = greetingName.endsWith("님") ? greetingName : `${greetingName} 님`;
  const countUnavailableLabel = workSnapshot ? "업무 원장 연결 전" : "확인 중";
  const firstPendingSupportRequest = pending[0] ?? null;
  const closeSupportRequest = useCallback(() => {
    const trigger = supportRequestTriggerRef.current;
    setSelectedSupportRequest(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
      else supportSummaryRef.current?.focus();
      supportRequestTriggerRef.current = null;
    });
  }, []);

  const closeWork = useCallback(() => {
    const trigger = workTriggerRef.current;
    setSelectedWork(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
      workTriggerRef.current = null;
    });
  }, []);

  function saveSupportRequest(nextRequest: OwnerSupportRequestItem) {
    setRequests((current) => current.map((item) => (item.id === nextRequest.id ? nextRequest : item)));
    setSelectedSupportRequest(nextRequest);
  }

  async function openWork(item: AdminWorkCard) {
    try {
      const detail = await fetchApiJson<AdminAoCardDetail>(`/api/admin/ao-dashboard/${item.id}`, { cache: "no-store" });
      setSelectedWork(adaptAdminWorkItems([{ ...item, directiveSummary: detail.directiveSummary, breakdown: detail.planSummary === "기록 없음" ? [] : [detail.planSummary], owner: detail.assignee, blocker: detail.blocker === "없음" ? null : detail.blocker, nextAction: detail.nextAction, ownerDecision: detail.approval, checkedAt: detail.updatedAt ?? "확인 시각 기록 없음", source: detail.source, sourceLabel: detail.sourceLabel, verificationResults: detail.completed === "기록 없음" ? [] : [detail.completed] }])[0]);
    } catch {
      setError("업무 상세를 확인하지 못했습니다.");
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F4F4F4] text-[#111112] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden bg-white sm:rounded-[14px] sm:border sm:border-[#D9E0E8] sm:shadow-[0_2px_14px_rgba(15,23,42,0.14)]">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-[#E7E7E7] px-4 sm:px-6 lg:px-8">
          <PetManagerBrand nameClassName="text-[14px] text-[#111112]" imageClassName="h-[18px]" priority />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className={`hidden text-[#64748b] lg:inline ${ADMIN_TYPOGRAPHY.helper}`}>시스템 관리자</span>
            <button
              type="button"
              onClick={() => {
                void loadWorkItems();
                if (activated) void refresh();
              }}
              aria-label="관리자 홈 새로고침"
              className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-[#DCE7EE] bg-white px-3 text-[#475569] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 sm:px-4"
            >
              <RefreshCcw className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`} />
              <span className={`hidden sm:inline ${ADMIN_TYPOGRAPHY.helper}`}>새로고침</span>
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="관리자 로그아웃"
              className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-[#DCE7EE] bg-white px-3 text-[#475569] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 sm:px-4"
            >
              <DoorOpen className="h-4 w-4" />
              <span className={`hidden sm:inline ${ADMIN_TYPOGRAPHY.helper}`}>로그아웃</span>
            </button>
          </div>
        </header>

        <div className="bg-[#F4F4F4]">
        <section className="rounded-bl-[72px] bg-white px-4 pb-10 pt-7 sm:px-6 md:rounded-bl-[120px] md:pb-12 lg:px-8">
          <div className="grid min-w-0 items-center gap-6 md:grid-cols-[minmax(150px,0.55fr)_minmax(0,2fr)] lg:gap-8">
            <div className="md:pl-3 lg:pl-16">
              <p className={`text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>안녕하세요.</p>
              <h1 className={`mt-1 break-keep tracking-[-0.03em] text-[#111112] ${ADMIN_TYPOGRAPHY.pageTitle}`}>
                {greetingLabel}.
              </h1>
            </div>
            <div className="min-w-0">
              <p aria-live="polite" className={`mb-2 text-right text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
                {!workSnapshot
                  ? "업무 수 확인 중"
                  : workSnapshot.connection === "connected"
                    ? "실제 업무 원장"
                    : workSnapshot.connection === "limited"
                      ? "일부 연결 · 확인 가능한 실제 업무 기준"
                      : "업무 원장 연결 전"}
              </p>
              <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0 md:pb-0">
                <div className="grid w-max min-w-full snap-x snap-mandatory grid-cols-[repeat(4,minmax(240px,78vw))] gap-2 md:w-full md:grid-cols-4">
                  <StatusCard
                    label="처리할 업무"
                    value={snapshotHasCounts ? String(queuedCount + actionCount) : "—"}
                    detail={snapshotHasCounts ? `지시 ${queuedCount} · 조치 ${actionCount}` : countUnavailableLabel}
                    primary
                    limited={isLimited}
                  />
                  <StatusCard label="작업중" value={snapshotHasCounts ? String(laneCount("working")) : "—"} detail={snapshotHasCounts ? "현재 진행 중" : countUnavailableLabel} limited={isLimited} />
                  <StatusCard label="검수필요" value={snapshotHasCounts ? String(laneCount("review")) : "—"} detail={snapshotHasCounts ? "독립 검수 대기" : countUnavailableLabel} limited={isLimited} />
                  <StatusCard label="완료" value={snapshotHasCounts ? String(laneCount("completed")) : "—"} detail={snapshotHasCounts ? "검수까지 완료" : countUnavailableLabel} limited={isLimited} />
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div className="bg-[#F4F4F4] px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8">
          {error ? <p role="alert" className={`${getWrapIndicatorClass("burgundy")} mt-4 px-4 py-3 text-[#a04455] ${ADMIN_TYPOGRAPHY.helper}`}>{error}</p> : null}

          <section className="pt-5" aria-labelledby="focus-work-title">
            <h2 id="focus-work-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
              <span className="text-[#0873C6]">지금 먼저 확인할 업무</span>
            </h2>
            <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-[10px] border border-[#E7E7E7] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <p className={`text-[#0873C6] ${ADMIN_TYPOGRAPHY.meta}`}>
                  고객 문의 · 미처리 {pending.length}건
                </p>
                <h3 className={`mt-1 break-words text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
                  {loadState === "idle" || loadState === "loading"
                    ? "고객 문의를 확인하고 있습니다."
                    : firstPendingSupportRequest
                      ? firstPendingSupportRequest.title
                      : "처리할 고객 문의가 없습니다."}
                </h3>
                <p className={`mt-1 line-clamp-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
                  {firstPendingSupportRequest
                    ? `${supportRequestCategoryLabels[firstPendingSupportRequest.category]} · ${supportRequestStatusLabels[firstPendingSupportRequest.status]} · ${formatAdminDateTime(firstPendingSupportRequest.createdAt)}`
                    : loadState === "error"
                      ? supportError ?? "고객 문의를 불러오지 못했습니다."
                      : "답변과 처리 상태는 고객 문의에서 확인합니다."}
                </p>
              </div>
              <Link
                href="/admin/support"
                className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] bg-[#0873C6] px-5 text-white transition hover:bg-[#075FA3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
              >
                고객 문의 열기
              </Link>
            </div>
          </section>

          <section className="mt-7" aria-labelledby="admin-menu-title">
            <h2 id="admin-menu-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
              <span className="text-[#0873C6]">관리 메뉴</span>
            </h2>
            <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 md:mx-0 md:overflow-visible md:px-0 md:pb-0">
              <nav aria-label="관리 메뉴" className="grid w-max min-w-full snap-x snap-mandatory grid-cols-[repeat(4,minmax(240px,78vw))] gap-3 md:w-full md:grid-cols-2 xl:grid-cols-4">
                <MenuCard href="/admin/marketing" title="워크룸" description="업무 진행과 검수 확인" color="#0873C6" textColor="#FFFFFF" icon={<ClipboardList className="h-6 w-6" />} />
                <MenuCard href="/owner/admin" title="계정 관리" description="오너 계정 운영" color="#31A5F6" textColor="#082F49" icon={<Users className="h-6 w-6" />} />
                <MenuCard href="/admin/support" title="고객 문의" description="접수·답변·처리 현황" color="#31D6C6" textColor="#103E45" icon={<MessageCircle className="h-6 w-6" />} />
                <MenuCard onClick={openRevenue} controls="revenue" title="매출 현황" description="결제와 구독 매출" color="#31BCFC" textColor="#082F49" icon={<BarChart3 className="h-6 w-6" />} />
              </nav>
            </div>
          </section>

          <section className="mt-7" aria-labelledby="kanban-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0873C6]`}>WORKROOM</p>
                <h2 id="kanban-title" className={`mt-1 text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>대표 업무 흐름</h2>
              </div>
              <p className={`text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
                {workSnapshot
                  ? `${workSnapshot.connectionLabel} · ${workSnapshot.connection === "connected" ? "실제 업무 원장" : workSnapshot.connection === "limited" ? "일부 출처 확인 불가" : "unavailable"}`
                  : "업무 원장 확인 중"}
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {ADMIN_WORK_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage.id}
                  title={stage.label}
                  tone={stage.tone}
                  items={workItems}
                  sourceAvailable={workSnapshot?.connection === "connected" || workSnapshot?.connection === "limited"}
                  onSelect={(item, trigger) => {
                    workTriggerRef.current = trigger;
                    void openWork(item);
                  }}
                />
              ))}
            </div>
          </section>

          <section className="mt-7 grid gap-3 lg:grid-cols-2" aria-label="운영 정보">
            <Details id="customer-support" detailsRef={supportDetailsRef} summaryRef={supportSummaryRef} title="고객 문의" summary={activated ? `미처리 ${pending.length}건` : "열어서 조회"} onOpen={() => setActivated(true)}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] p-4">
                <div className="flex gap-2">
                  {(["pending", "all"] as const).map((value) => (
                    <button key={value} type="button" onClick={() => setFilter(value)} className={`inline-flex min-h-11 items-center rounded-[8px] px-4 ${ADMIN_TYPOGRAPHY.meta} ${filter === value ? "bg-[#2563eb] text-white" : "bg-[#f1f5f9] text-[#64748b]"}`}>
                      {value === "pending" ? "미처리" : "전체"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void refresh()} disabled={loadState === "loading"} className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] px-4 text-[#64748b] disabled:opacity-60 ${ADMIN_TYPOGRAPHY.helper}`}>
                  <RefreshCcw className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`} />새로고침
                </button>
              </div>
              <div className="max-h-[420px] divide-y divide-[#edf2f7] overflow-y-auto">
                {loadState === "loading" ? <p className={`px-4 py-6 text-center text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>문의 목록을 불러오는 중입니다.</p> : null}
                {loadState === "error" ? (
                  <div className="px-4 py-6 text-center">
                    <p role="alert" className={`text-[#a04455] ${ADMIN_TYPOGRAPHY.helper}`}>{supportError ?? "고객 문의를 불러오지 못했습니다."}</p>
                    <button type="button" onClick={() => void refresh()} className={`mt-3 inline-flex min-h-11 items-center rounded-[8px] border border-[#dbe2ea] px-4 text-[#334155] ${ADMIN_TYPOGRAPHY.control}`}>다시 시도</button>
                  </div>
                ) : null}
                {loadState === "ready" ? visibleRequests.map((request) => (
                  <button key={request.id} type="button" onClick={(event) => { supportRequestTriggerRef.current = event.currentTarget; setSelectedSupportRequest(request); }} className="min-h-11 w-full px-4 py-3 text-left transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-[14px] font-medium text-[#0f172a]">{request.title}</p>
                      <span className={`shrink-0 text-[#2563eb] ${ADMIN_TYPOGRAPHY.badge}`}>{supportRequestStatusLabels[request.status]}</span>
                    </div>
                    <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{request.shopName ?? request.shopId} · {supportRequestCategoryLabels[request.category]} · {formatAdminDateTime(request.createdAt)}</p>
                  </button>
                )) : null}
                {loadState === "ready" && visibleRequests.length === 0 ? <p className={`px-4 py-6 text-center text-[#94a3b8] ${ADMIN_TYPOGRAPHY.helper}`}>{filter === "pending" ? "미처리 문의가 없습니다." : "접수된 문의가 없습니다."}</p> : null}
              </div>
            </Details>
            <Details id="revenue" detailsRef={revenueDetailsRef} summaryRef={revenueSummaryRef} title="매출" summary={revenue ? `이번 달 ${formatWon(revenue.monthRevenue)}` : "열어서 조회"} onOpen={() => setActivated(true)}>
              <div className="grid grid-cols-2 gap-px bg-[#edf2f7]"><Metric label="이번 달" value={formatWon(revenue?.monthRevenue ?? 0)} /><Metric label="예상 월 매출" value={formatWon(revenue?.expectedMonthlyRecurringRevenue ?? 0)} /><Metric label="오늘" value={formatWon(revenue?.todayRevenue ?? 0)} /><Metric label="유료 이용 매장" value={`${revenue?.activePaidSubscriptions ?? 0}곳`} /></div>
            </Details>
          </section>
        </div>
      </div>
      {selectedWork ? <WorkDetailPanel item={selectedWork} onClose={closeWork} /> : null}
      {selectedSupportRequest ? <AdminSupportRequestDetail request={selectedSupportRequest} onClose={closeSupportRequest} onSaved={saveSupportRequest} /> : null}
    </main>
  );
}

function StatusCard({ label, value, detail, primary = false, limited = false }: { label: string; value: string; detail: string; primary?: boolean; limited?: boolean }) {
  return (
    <article className={`min-h-[112px] min-w-0 snap-start rounded-[14px] border px-4 py-4 ${primary ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#60A5FA] bg-white text-[#111112]"}`}>
      <p className={ADMIN_TYPOGRAPHY.meta}>{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-[28px] leading-none font-semibold tracking-[-0.03em]">{value}</p>
        {limited ? <span className={`rounded-full px-2 py-0.5 ${ADMIN_TYPOGRAPHY.meta} ${primary ? "bg-white/20 text-white" : "bg-[#EAF5FF] text-[#0873C6]"}`}>일부</span> : null}
      </div>
      <p className={`mt-2 truncate ${primary ? "text-white/80" : "text-[#64748b]"} ${ADMIN_TYPOGRAPHY.helper}`}>{detail}</p>
    </article>
  );
}

function MenuCard({ href, onClick, controls, title, description, color, textColor, icon }: { href?: string; onClick?: () => void; controls?: string; title: string; description: string; color: string; textColor: string; icon: React.ReactNode }) {
  const content = <><span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/60" aria-hidden="true">{icon}</span><span className={`mt-4 block ${ADMIN_TYPOGRAPHY.label}`}>{title}</span><span className={`mt-1 block opacity-80 ${ADMIN_TYPOGRAPHY.helper}`}>{description}</span></>;
  const className = "min-h-[148px] min-w-0 snap-start rounded-[10px] px-5 py-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2";
  const style = { backgroundColor: color, color: textColor };
  if (href) return <Link href={href as never} className={className} style={style}>{content}</Link>;
  return <button type="button" onClick={onClick} aria-controls={controls} className={`${className} w-full`} style={style}>{content}</button>;
}

function cardToWorkItem(card: AdminAoCard, lane: AdminAoLaneId) { return { id: card.key, title: card.title, directiveSummary: "상세에서 확인", breakdown: [], owner: card.assignee, stage: stageFromLane(lane), actualStatus: card.statusLabel, blocker: null, nextAction: card.nextAction, ownerDecision: card.approvalRequired ? "대표 판단 필요" : null, checkedAt: card.updatedAt ?? "확인 시각 기록 없음", source: card.source, sourceLabel: card.sourceLabel, completionCriteria: [], verificationResults: [] }; }
function stageFromLane(lane: AdminAoLaneId): AdminWorkStage { return lane === "queued" ? "directive" : lane === "working" ? "in_progress" : lane === "action" ? "action_required" : lane === "review" ? "review_required" : "complete"; }
function KanbanColumn({ stage, title, tone, items, sourceAvailable, onSelect }: { stage: AdminWorkStage; title: string; tone: StatusIndicatorTone; items: AdminWorkCard[]; sourceAvailable: boolean; onSelect: (item: AdminWorkCard, trigger: HTMLButtonElement) => void }) { const visible = items.filter((item) => item.stage === stage); return <section className="min-w-0 rounded-[10px] border border-[#dce5f0] bg-[#f8fafc] p-3" aria-label={title}><header className="flex min-h-11 items-center justify-between"><h3 className="text-[14px] font-medium text-[#0f172a]">{title}</h3><span className={`inline-flex items-center gap-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}><span className={getDotIndicatorClass(tone)} />{visible.length}</span></header><div className="grid gap-2">{visible.map((item) => <button key={item.id} type="button" data-kanban-item-id={item.id} onClick={(event) => onSelect(item, event.currentTarget)} className={`${getWrapIndicatorClass(item.tone)} min-h-11 w-full px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2`}><span className="line-clamp-2 text-[14px] font-medium text-[#0f172a]">{item.title}</span><span className={`mt-1 block truncate text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{item.actualStatus}</span></button>)}{visible.length === 0 ? <p className={`rounded-[8px] border border-dashed border-[#dbe2ea] bg-white px-3 py-4 text-center text-[#94a3b8] ${ADMIN_TYPOGRAPHY.helper}`}>{sourceAvailable ? "등록된 업무가 없습니다" : "업무 원장 연결 전"}</p> : null}</div></section>; }
function WorkDetailPanel({ item, onClose }: { item: AdminWorkCard; onClose: () => void }) { const closeButtonRef = useRef<HTMLButtonElement>(null); useEffect(() => { closeButtonRef.current?.focus(); const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [onClose]); return <div className="fixed inset-0 z-50 flex justify-end bg-[#0f172a]/25" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside role="dialog" aria-modal="true" aria-labelledby="work-detail-title" className="h-full w-full overflow-y-auto border-l border-[#dce5f0] bg-white p-5 sm:max-w-[560px] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>{item.stageLabel}</p><h2 id="work-detail-title" className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{item.title}</h2></div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="상세 닫기" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe4ef]"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-5"><DetailRow label="원 지시 요약" value={item.directiveSummary} /><DetailList label="계획·업무 분해" values={item.breakdown} /><DetailRow label="담당" value={item.owner} /><DetailRow label="실제 상태" value={item.actualStatus} /><DetailRow label="막힘" value={item.blocker ?? "없음"} /><DetailRow label="다음 순서" value={item.nextAction} /><DetailRow label="대표 판단 필요" value={item.ownerDecision ?? "없음"} /><DetailRow label="확인 시각" value={item.checkedAt} /><DetailRow label="출처" value={`${item.sourceLabel} · ${item.source}`} /><DetailList label="완료 조건" values={item.completionCriteria} /><DetailList label="검수 결과" values={item.verificationResults} /></div></aside></div>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <section><h3 className={`${ADMIN_TYPOGRAPHY.meta} text-[#475569]`}>{label}</h3><p className={`mt-1 whitespace-pre-wrap text-[#0f172a] ${ADMIN_TYPOGRAPHY.body}`}>{value}</p></section>; }
function DetailList({ label, values }: { label: string; values: string[] }) { return <section><h3 className={`${ADMIN_TYPOGRAPHY.meta} text-[#475569]`}>{label}</h3>{values.length ? <ul className={`mt-1 grid gap-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.body}`}>{values.map((value) => <li key={value}>· {value}</li>)}</ul> : <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>기록 없음</p>}</section>; }
function Details({ id, detailsRef, summaryRef, title, summary, onOpen, children }: { id?: string; detailsRef?: React.RefObject<HTMLDetailsElement | null>; summaryRef?: React.RefObject<HTMLElement | null>; title: string; summary: string; onOpen: () => void; children: React.ReactNode }) { return <details id={id} ref={detailsRef} onToggle={(event) => { if (event.currentTarget.open) onOpen(); }} className="group scroll-mt-4 overflow-hidden rounded-[10px] border border-[#dce5f0] bg-white"><summary ref={summaryRef} className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]"><span>{title}</span><span className={`flex items-center gap-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{summary}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span></summary><div className="border-t border-[#edf2f7]">{children}</div></details>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white px-4 py-4"><p className={`text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{label}</p><p className="mt-1 text-[17px] font-semibold text-[#0f172a]">{value}</p></div>; }
