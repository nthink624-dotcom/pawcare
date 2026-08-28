"use client";

import { AlertTriangle, DoorOpen, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import { getDotIndicatorClass, getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { fetchApiJson } from "@/lib/api";
import type { AdminAoCard, AdminAoCardDetail, AdminAoDashboardSnapshot, AdminAoLaneId } from "@/types/admin-ao-dashboard";

type BoardState = "loading" | "ready" | "stale" | "error";

const laneTone: Record<AdminAoLaneId, StatusIndicatorTone> = {
  queued: "neutral",
  working: "active",
  action: "burgundy",
  review: "amber",
  completed: "completed",
};

export default function AdminHome({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AdminAoDashboardSnapshot | null>(null);
  const [boardState, setBoardState] = useState<BoardState>("loading");
  const [selectedCard, setSelectedCard] = useState<AdminAoCard | null>(null);
  const [detail, setDetail] = useState<AdminAoCardDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const snapshotRef = useRef<AdminAoDashboardSnapshot | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const loadBoard = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const next = await fetchApiJson<AdminAoDashboardSnapshot>("/api/admin/ao-dashboard", { cache: "no-store" });
      snapshotRef.current = next;
      setSnapshot(next);
      setBoardState("ready");
    } catch {
      setBoardState(snapshotRef.current ? "stale" : "error");
    }
  }, []);

  useEffect(() => {
    void loadBoard();
    const timer = window.setInterval(() => void loadBoard(), 30_000);
    const refresh = () => void loadBoard();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadBoard]);

  useEffect(() => {
    if (!selectedCard) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedCard(null);
      setDetail(null);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedCard]);

  async function openDetail(card: AdminAoCard, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setSelectedCard(card);
    setDetail(null);
    setDetailState("loading");
    try {
      setDetail(await fetchApiJson<AdminAoCardDetail>(`/api/admin/ao-dashboard/${card.key}`, { cache: "no-store" }));
      setDetailState("ready");
    } catch {
      setDetailState("error");
    }
  }

  function closeDetail() {
    setSelectedCard(null);
    setDetail(null);
    setDetailState("idle");
    triggerRef.current?.focus();
  }

  async function logout() {
    try {
      await fetchApiJson("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6f8] px-4 py-5 text-[#172033] md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="rounded-[14px] border border-[#dbe2ea] bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`${T.meta} text-[#2563eb]`}>관리자 AO</p>
              <h1 className={`mt-1 text-[#0f172a] ${T.pageTitle}`}>팀 업무 현황</h1>
              <p className={`mt-1 text-[#64748b] ${T.body}`}>지시부터 완료까지 실제 연결된 업무만 단계별로 확인합니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden text-[#64748b] sm:inline ${T.meta}`}>{sessionLoginId}</span>
              <button type="button" onClick={() => void loadBoard()} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"><RefreshCw className="h-4 w-4" aria-hidden="true" />새로고침</button>
              <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"><DoorOpen className="h-4 w-4" aria-hidden="true" />로그아웃</button>
            </div>
          </div>
          <div className="mt-4 border-t border-[#edf2f7] pt-4"><AdminSectionNav active="home" /></div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[#475569] ${T.body}`}>
            <span className={getDotIndicatorClass(snapshot?.connection === "connected" ? "confirmed" : snapshot?.connection === "limited" ? "amber" : "neutral")} aria-hidden="true" />
            {snapshot?.connectionLabel ?? (boardState === "loading" ? "연결 확인 중" : "연결 전")}
          </div>
          <p className={`text-[#64748b] ${T.helper}`}>{snapshot ? `${formatTime(snapshot.checkedAt)} 확인` : "확인 시각 알 수 없음"}</p>
        </div>

        {boardState === "error" ? <Notice tone="burgundy" title="업무 원장 연결 전" body="실제 업무를 확인할 수 없습니다. 연결 전 상태를 0건으로 표시하지 않습니다." /> : null}
        {boardState === "stale" ? <Notice tone="amber" title="자동 갱신 확인 불가" body="마지막으로 확인한 현황을 유지합니다." /> : null}

        <section aria-label="팀 업무 5단계 현황" className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {(snapshot?.lanes ?? fallbackLanes).map((lane) => (
            <section key={lane.id} aria-labelledby={`lane-${lane.id}`} className={`min-w-0 rounded-[14px] border border-[#dbe2ea] bg-[#f8fafc] p-3 ${lane.id === "queued" ? "md:col-span-2 xl:col-span-1" : ""}`}>
              <div className="flex min-h-11 items-center justify-between gap-2 border-b border-[#e5eaf0] pb-2">
                <h2 id={`lane-${lane.id}`} className={`flex items-center gap-2 text-[#0f172a] ${T.sectionTitle}`}><span className={getDotIndicatorClass(laneTone[lane.id])} aria-hidden="true" />{lane.title}</h2>
                <span className={`text-[#64748b] ${T.meta}`}>{snapshot ? `${lane.cards.length}건` : "확인 중"}</span>
              </div>
              <div className="mt-3 space-y-3">
                {lane.cards.map((card) => <WorkCard key={card.key} card={card} lane={lane.id} onOpen={openDetail} />)}
                {lane.cards.length === 0 ? <EmptyLane connected={Boolean(snapshot)} /> : null}
              </div>
            </section>
          ))}
        </section>
      </div>

      {selectedCard ? <DetailDialog card={selectedCard} detail={detail} state={detailState} onClose={closeDetail} /> : null}
    </main>
  );
}

const fallbackLanes: AdminAoDashboardSnapshot["lanes"] = [
  { id: "queued", title: "지시사항", cards: [] },
  { id: "working", title: "작업중", cards: [] },
  { id: "action", title: "조치필요", cards: [] },
  { id: "review", title: "검수필요", cards: [] },
  { id: "completed", title: "완료", cards: [] },
];

function WorkCard({ card, lane, onOpen }: { card: AdminAoCard; lane: AdminAoLaneId; onOpen: (card: AdminAoCard, trigger: HTMLButtonElement) => Promise<void> }) {
  const tone = laneTone[lane];
  return (
    <button type="button" onClick={(event) => void onOpen(card, event.currentTarget)} className={`${getWrapIndicatorClass(tone)} block min-h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2`}>
      <span className="flex items-center justify-between gap-2"><span className={`text-[#475569] ${T.badge}`}>{card.statusLabel}</span>{card.approvalRequired ? <span className={`text-[#b98121] ${T.badge}`}>승인 필요</span> : null}</span>
      <strong className={`mt-2 block line-clamp-2 text-[#0f172a] ${T.bodyStrong}`}>{card.title}</strong>
      {card.representativeDirective ? <span className={`mt-2 block rounded-[6px] bg-[#f8fafc] px-2 py-2 text-[#334155] ${T.body}`}><span className={`block text-[#64748b] ${T.helper}`}>대표 지시</span>{card.representativeDirective}</span> : null}
      <span className={`mt-2 block line-clamp-2 text-[#475569] ${T.body}`}>{card.nextAction}</span>
      <span className={`mt-2 flex flex-wrap items-center justify-between gap-1 text-[#64748b] ${T.helper}`}><span>{card.assignee}</span><span>{card.sourceLabel} · {card.updatedAt ? formatTime(card.updatedAt) : "확인불가"}</span></span>
    </button>
  );
}

function EmptyLane({ connected }: { connected: boolean }) {
  return <div className={`rounded-[8px] border border-dashed border-[#cfd7e1] bg-white px-3 py-4 text-center text-[#64748b] ${T.body}`}>{connected ? "현재 업무 없음" : "연결 전 · 확인불가"}</div>;
}

function DetailDialog({ card, detail, state, onClose }: { card: AdminAoCard; detail: AdminAoCardDetail | null; state: "idle" | "loading" | "ready" | "error"; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/25 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="ao-detail-title" className="max-h-[85vh] w-full overflow-y-auto rounded-t-[14px] border border-[#dbe2ea] bg-white p-4 sm:max-w-[620px] sm:rounded-[14px] sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className={`${T.meta} text-[#2563eb]`}>{card.statusLabel} · {card.assignee}</p><h2 id="ao-detail-title" className={`mt-1 text-[#0f172a] ${T.sectionTitle}`}>{card.title}</h2></div><button type="button" onClick={onClose} aria-label="상세 닫기" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"><X className="h-5 w-5" aria-hidden="true" /></button></div>{state === "loading" ? <p className={`mt-5 text-[#64748b] ${T.body}`}>상세 확인 중</p> : null}{state === "error" ? <Notice tone="burgundy" title="상세 확인 불가" body="요약 상태는 유지됩니다." /> : null}{detail ? <dl className="mt-4 divide-y divide-[#edf2f7]">{[["목적", detail.objective], ["완료 내용", detail.completed], ["막힘", detail.blocker], ["다음 단계", detail.nextAction], ["승인", detail.approval], ["출처", detail.sourceLabel], ["최근 확인", detail.updatedAt ? formatTime(detail.updatedAt) : "확인불가"]].map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[100px_1fr]"><dt className={`text-[#64748b] ${T.meta}`}>{label}</dt><dd className={`break-words text-[#334155] ${T.body}`}>{value}</dd></div>)}</dl> : null}</section></div>;
}

function Notice({ tone, title, body }: { tone: "burgundy" | "amber"; title: string; body: string }) {
  return <div role="status" className={`${getWrapIndicatorClass(tone)} mt-3 flex gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3`}><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "burgundy" ? "text-[#a04455]" : "text-[#b98121]"}`} aria-hidden="true" /><div><p className={`text-[#0f172a] ${T.bodyStrong}`}>{title}</p><p className={`mt-1 text-[#64748b] ${T.body}`}>{body}</p></div></div>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인불가";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
