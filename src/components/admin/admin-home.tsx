"use client";

import { AlertTriangle, ChevronDown, ChevronRight, DoorOpen, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { getDotIndicatorClass, getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { fetchApiJson } from "@/lib/api";
import type { ReleaseReadinessItem, ReleaseReadinessStatus, ReleaseReadinessSummary } from "@/lib/admin-release-readiness";

type DetailResponse = { items: ReleaseReadinessItem[]; nextOffset: number | null; total: number; version: string };

const statusLabel: Record<ReleaseReadinessStatus, string> = {
  blocked: "차단",
  approval: "승인 필요",
  checking: "확인 필요",
  ready: "완료",
};

const statusTone: Record<ReleaseReadinessStatus, StatusIndicatorTone> = {
  blocked: "burgundy",
  approval: "amber",
  checking: "active",
  ready: "confirmed",
};

export default function AdminHome({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<ReleaseReadinessSummary | null>(null);
  const [summaryState, setSummaryState] = useState<"loading" | "ready" | "partial" | "error">("loading");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<ReleaseReadinessItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<ReleaseReadinessSummary | null>(null);

  const loadSummary = useCallback(async (onlyWhenChanged = false) => {
    try {
      const next = await fetchApiJson<ReleaseReadinessSummary>("/api/admin/release-readiness", { cache: "no-store" });
      if (!onlyWhenChanged || summaryRef.current?.version !== next.version) {
        summaryRef.current = next;
        setSummary(next);
      }
      setSummaryState("ready");
    } catch {
      setSummaryState((current) => (summaryRef.current || current === "ready" ? "partial" : "error"));
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void loadSummary(true);
    };
    const interval = window.setInterval(refreshVisible, 60_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadSummary]);

  useEffect(() => {
    if (!detailsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDetailsOpen(false);
      detailsButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsOpen]);

  const loadDetails = useCallback(async (offset: number) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const result = await fetchApiJson<DetailResponse>(`/api/admin/release-readiness?view=details&offset=${offset}&limit=${offset === 0 ? 5 : 10}`, { cache: "no-store" });
      setDetails((current) => (offset === 0 ? result.items : [...current, ...result.items]));
      setNextOffset(result.nextOffset);
    } catch {
      setDetailsError("상세 근거를 불러오지 못했습니다. 요약의 차단 상태는 유지됩니다.");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  async function toggleDetails() {
    const nextOpen = !detailsOpen;
    setDetailsOpen(nextOpen);
    if (nextOpen && details.length === 0 && !detailsLoading) await loadDetails(0);
  }

  async function handleLogout() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  const p0Items = summary?.important.filter((item) => item.priority === "P0") ?? [];
  const approvalItems = summary?.important.filter((item) => item.approval) ?? [];
  const generalItems = summary?.important.filter((item) => item.priority !== "P0" && !item.approval) ?? [];

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-5 text-[#172033] sm:px-5 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="rounded-[10px] border border-[#dbe2ea] bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>관리자 운영</p>
              <h1 className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>출시 준비 현황</h1>
              <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>출시 불가 원인과 지금 할 일을 한 화면에서 확인합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden text-[#64748b] sm:inline ${ADMIN_TYPOGRAPHY.meta}`}>{sessionLoginId}</span>
              <button type="button" onClick={() => void handleLogout()} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
                <DoorOpen className="h-4 w-4" aria-hidden="true" />로그아웃
              </button>
            </div>
          </div>
          <div className="mt-4 border-t border-[#edf2f7] pt-4"><AdminSectionNav active="home" /></div>
        </header>

        <section aria-labelledby="release-summary" className="mt-4 grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className={`${getWrapIndicatorClass(summary?.releaseStatus === "ready" ? "confirmed" : "burgundy")} rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>전체 상태</p>
                <h2 id="release-summary" className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{summaryState === "loading" ? "확인 중" : summary?.releaseStatus === "ready" ? "출시 준비 완료" : "현재 출시 불가"}</h2>
              </div>
              <button type="button" onClick={() => void loadSummary()} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] font-medium outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />다시 확인
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label="P0" value={summary?.counts.p0 ?? "—"} tone="burgundy" />
              <Metric label="P1" value={summary?.counts.p1 ?? "—"} tone="active" />
              <Metric label="승인" value={summary?.counts.approvals ?? "—"} tone="amber" />
            </div>
            <p className={`mt-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{summary ? `${formatTime(summary.checkedAt)} 확인 · 로컬 스냅샷` : "상태를 불러오는 중입니다."}</p>
          </div>

          <section aria-labelledby="immediate-actions" className="rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-4">
            <h2 id="immediate-actions" className={`text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>즉시 행동</h2>
            <ol className="mt-2 space-y-2">
              {(summary?.actions ?? ["상태 확인 중"]).map((action, index) => <li key={action} className={`flex gap-2 text-[#334155] ${ADMIN_TYPOGRAPHY.body}`}><span className="text-[#2563eb]">{index + 1}.</span><span>{action}</span></li>)}
            </ol>
          </section>
        </section>

        {summaryState === "error" ? <FailureBanner title="전체 상태를 확인하지 못했습니다" body="확인 실패 상태에서는 운영 반영을 계속 차단합니다." /> : null}
        {summaryState === "partial" ? <FailureBanner title="표시된 정보가 오래됐을 수 있습니다" body="마지막 정상 요약을 유지합니다. 다시 확인하기 전에는 운영 반영을 진행하지 마세요." /> : null}

        <ReadinessSection title="P0 출시 차단" items={p0Items} empty={summaryState === "loading" ? "차단 항목 확인 중" : "표시할 P0 차단 항목이 없습니다."} />
        <ReadinessSection title="승인 필요" items={approvalItems.filter((item) => item.priority !== "P0")} empty="추가 승인 항목이 없습니다." />
        <ReadinessSection title="일반 준비" items={generalItems} empty="표시할 일반 준비 항목이 없습니다." />

        <section className="mt-4 rounded-[8px] border border-[#dbe2ea] bg-white">
          <button ref={detailsButtonRef} type="button" onClick={() => void toggleDetails()} aria-expanded={detailsOpen} aria-controls="release-evidence" className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]">
            <span>근거와 확인 이력</span><ChevronDown className={`h-4 w-4 transition ${detailsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {detailsOpen ? (
            <div id="release-evidence" className="border-t border-[#edf2f7] px-4 py-4">
              {detailsError ? <p className={`text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`}>{detailsError}</p> : null}
              <div className="space-y-3">{details.map((item) => <article key={item.id} className="rounded-[8px] bg-[#f8fafc] px-4 py-3"><p className={`text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{item.title}</p><p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{item.detail}</p><p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>{formatTime(item.evidenceAt)} 근거</p></article>)}</div>
              {nextOffset !== null ? <button type="button" disabled={detailsLoading} onClick={() => void loadDetails(nextOffset)} className="mt-3 inline-flex min-h-11 items-center rounded-[8px] border border-[#dbe2ea] px-4 text-[14px] font-medium outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50">{detailsLoading ? "불러오는 중" : "10건 더 보기"}</button> : null}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="work-links" className="mt-4 rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-4">
          <h2 id="work-links" className={`text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>업무 이동</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <WorkLink href="/owner/admin" label="오너 계정 관리" />
            <WorkLink href="/admin/marketing" label="마케팅 워룸" />
          </div>
        </section>
      </div>
    </main>
  );
}

function ReadinessSection({ title, items, empty }: { title: string; items: Array<Omit<ReleaseReadinessItem, "detail">>; empty: string }) {
  return <section className="mt-4" aria-labelledby={`section-${title}`}><h2 id={`section-${title}`} className={`text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{title}</h2><div className="mt-2 space-y-2">{items.length ? items.map((item) => <ReadinessRow key={item.id} item={item} />) : <p className={`rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{empty}</p>}</div></section>;
}

function ReadinessRow({ item }: { item: Omit<ReleaseReadinessItem, "detail"> }) {
  const tone = statusTone[item.status];
  return <article className={`${getWrapIndicatorClass(tone)} grid gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_160px_110px]`}><div className="min-w-0"><div className="flex items-center gap-2"><span className={getDotIndicatorClass(tone)} aria-hidden="true" /><span className={`text-[#475569] ${ADMIN_TYPOGRAPHY.badge}`}>{item.priority} · {statusLabel[item.status]}</span>{item.approval ? <span className={`text-[#b98121] ${ADMIN_TYPOGRAPHY.badge}`}>승인</span> : null}</div><h3 className={`mt-1 line-clamp-2 text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{item.title}</h3></div><div className="min-w-0"><p className={`line-clamp-2 text-[#475569] ${ADMIN_TYPOGRAPHY.body}`}>{item.reason}</p><p className={`mt-1 line-clamp-2 text-[#2563eb] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{item.nextAction}</p></div><p className={`text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}>{item.approval ?? "승인 불필요"}</p><p className={`text-[#64748b] md:text-right ${ADMIN_TYPOGRAPHY.helper}`}>{formatTime(item.evidenceAt)}</p></article>;
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: StatusIndicatorTone }) {
  return <div className="rounded-[8px] border border-[#edf2f7] px-3 py-2"><p className={`flex items-center gap-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}><span className={getDotIndicatorClass(tone)} aria-hidden="true" />{label}</p><p className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{value}</p></div>;
}

function FailureBanner({ title, body }: { title: string; body: string }) {
  return <div role="alert" className={`${getWrapIndicatorClass("burgundy")} mt-4 flex gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a04455]" aria-hidden="true" /><div><p className={`text-[#a04455] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{title}</p><p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{body}</p></div></div>;
}

function WorkLink({ href, label }: { href: string; label: string }) {
  return <Link href={href as never} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] px-4 text-[14px] font-medium outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">{label}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
