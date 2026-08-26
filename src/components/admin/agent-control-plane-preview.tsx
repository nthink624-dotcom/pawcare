"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Link2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import type { ControlPlaneNode, ControlPlaneSnapshot, ControlPlaneStatus } from "@/types/agent-control-plane";

const STATUS: Record<ControlPlaneStatus, string> = { not_started: "시작 전", received: "지시 수신", in_progress: "진행 중", review: "검수 중", approval_waiting: "승인 대기", completed: "완료", blocked: "막힘", failed: "실패" };

export default function AgentControlPlanePreview({ mode = "operational" }: { mode?: "operational" | "demo" }) {
  const [snapshot, setSnapshot] = useState<ControlPlaneSnapshot | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState("CP-OPS-001");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (cursor: number) => {
    try {
      const endpoint = mode === "demo" ? `/api/admin/marketing/control-plane-preview?cursor=${cursor}` : "/api/admin/marketing/control-plane";
      const value = await fetchApiJson<ControlPlaneSnapshot>(endpoint, { cache: "no-store" });
      setSnapshot(value);
      setError(null);
    } catch (cause) {
      setSnapshot((current) => current ? { ...current, sources: { codex: "source_unavailable", mastra: "source_unavailable" } } : null);
      setError(cause instanceof Error ? cause.message : "연결 상태를 확인하지 못했습니다.");
    }
  }, [mode]);
  useEffect(() => { if (snapshot) return; const timer = window.setTimeout(() => void load(0), 0); return () => window.clearTimeout(timer); }, [load, snapshot]);
  useEffect(() => { if (paused || !snapshot) return; const delay = mode === "demo" && snapshot.hasMore ? 1_500 : 3_000; const timer = window.setTimeout(() => void load(snapshot.cursor), delay); return () => window.clearTimeout(timer); }, [load, mode, paused, snapshot]);
  const selected = snapshot?.nodes.find((node) => node.workId === selectedWorkId) ?? snapshot?.nodes[0] ?? null;
  const roots = useMemo(() => snapshot?.nodes.filter((node) => !node.parentWorkId) ?? [], [snapshot]);
  const children = useCallback((id: string) => snapshot?.nodes.filter((node) => node.parentWorkId === id) ?? [], [snapshot]);

  return <main className={ADMIN_SURFACE}><div className="mx-auto w-full max-w-[1440px]">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className={`${T.badge} font-bold text-[#2563eb]`}>{mode === "demo" ? "데모 데이터 · 격리 Preview" : "운영 데이터"}</p><h1 className={`${T.pageTitle} mt-1 font-bold text-[#172033]`}>실시간 업무 관제</h1></div><Link href="/admin/marketing" className={`${T.button} inline-flex items-center gap-2 rounded-xl border border-[#dbe2ea] bg-white px-4 font-bold text-[#334155]`}><ArrowLeft className="h-5 w-5" />마케팅 워크룸</Link></header>
      <div className={`${T.secondary} mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dbe2ea] bg-white px-4 py-3`}><div className="flex flex-wrap gap-4"><span>Codex 기존 작업 · <strong className="text-[#b98121]">동기화 제한</strong></span><span>Mastra · <strong className="text-[#2563eb]">3단계 POC</strong></span><span>외부 실행 · <strong className="text-[#1f6b5b]">꺼짐</strong></span></div><div className="flex gap-2"><button type="button" onClick={() => setPaused((value) => !value)} className={`${T.button} min-h-11 rounded-lg border border-[#cbd5e1] px-4 font-bold`}>{paused ? "재개" : "일시정지"}</button><button type="button" onClick={() => { setSnapshot(null); void load(0); }} className={`${T.button} inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cbd5e1] px-4 font-bold`}><RefreshCw className="h-4 w-4" />{mode === "demo" ? "Replay" : "새로고침"}</button></div></div>
    {error ? <p className={`${T.body} mt-3 flex items-center gap-2 rounded-lg bg-[#fff7f7] p-3 text-[#a04455]`}><AlertTriangle className="h-5 w-5" />{error} · 이전 상태는 오래됨으로 취급합니다.</p> : null}
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4"><div className="rounded-xl border border-[#dbe2ea] bg-[#f4f6f5] p-4"><div className="mb-3 flex items-center justify-between"><h2 className={`${T.sectionTitle} font-bold`}>업무 계보</h2><span className={`${T.badge} rounded-full bg-white px-3 py-1 font-bold text-[#64748b]`}>{snapshot?.cursor ?? 0}개 이벤트</span></div><div className="space-y-3">{roots.map((root) => <div key={root.workId}><NodeCard node={root} selected={selected?.workId === root.workId} onSelect={setSelectedWorkId} /><div className="ml-5 mt-3 grid gap-3 border-l-2 border-[#cbd5e1] pl-4 md:grid-cols-2">{children(root.workId).map((child) => <NodeCard key={child.workId} node={child} selected={selected?.workId === child.workId} onSelect={setSelectedWorkId} />)}</div></div>)}</div></div>
      <div className="rounded-xl border border-[#dbe2ea] bg-white p-4"><h2 className={`${T.sectionTitle} font-bold`}>이벤트 타임라인</h2><ol className="mt-4 space-y-3">{[...(snapshot?.timeline ?? [])].reverse().map((event) => <li key={event.eventId} className="grid grid-cols-[22px_1fr] gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-[#2563eb]" /><div className="border-b border-[#eef2f5] pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className={T.body}>{event.role} · {STATUS[event.status]}</strong><time className={`${T.secondary} text-[#64748b]`}>{formatTime(event.sourceEventAt)}</time></div><p className={`${T.secondary} mt-1 text-[#475569]`}>{event.title}</p></div></li>)}</ol></div></div>
      <Detail node={selected} />
    </section>
  </div></main>;
}

function NodeCard({ node, selected, onSelect }: { node: ControlPlaneNode; selected: boolean; onSelect: (id: string) => void }) {
  return <button type="button" onClick={() => onSelect(node.workId)} className={`min-h-[112px] w-full rounded-xl border bg-white p-4 text-left ${selected ? "border-[#2563eb] ring-2 ring-[#bfdbfe]" : "border-[#dbe2ea]"}`}><div className="flex items-start justify-between gap-3"><div><p className={`${T.secondary} font-bold text-[#64748b]`}>{node.role}</p><h3 className={`${T.cardTitle} mt-1 font-bold text-[#172033]`}>{node.title}</h3></div><Status status={node.status} /></div><p className={`${T.body} mt-3 text-[#334155]`}>{node.nextAction}</p></button>;
}

function Detail({ node }: { node: ControlPlaneNode | null }) {
  if (!node) return <aside className={`${T.body} rounded-xl border border-dashed border-[#cbd5e1] bg-white p-5 text-[#64748b]`}>이벤트 수신 대기</aside>;
  const rows = [["원지시", node.originalDirectiveSummary], ["운영팀 지시", node.operationsDirectiveSummary], ["담당", node.role], ["현재 단계", STATUS[node.status]], ["완료", node.completedSummary ?? "아직 없음"], ["막힘", node.blockerSummary ?? "없음"], ["다음 행동", node.nextAction], ["승인", node.approvalRequired ? "대표 승인 필요" : "현재 승인 불필요"], ["갱신", formatTime(node.sourceEventAt)]];
  return <aside className="rounded-xl border border-[#dbe2ea] bg-white p-5 xl:sticky xl:top-4 xl:h-fit"><div className="flex items-start justify-between gap-3"><div><p className={`${T.badge} font-bold text-[#2563eb]`}>선택된 업무</p><h2 className={`${T.sectionTitle} mt-1 font-bold`}>{node.title}</h2></div><Status status={node.status} /></div><dl className="mt-4 divide-y divide-[#eef2f5]">{rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[96px_1fr]"><dt className={`${T.secondary} text-[#64748b]`}>{label}</dt><dd className={`${T.body} text-[#334155]`}>{value}</dd></div>)}</dl>{node.artifact ? <Link href={node.artifact.url as never} className={`${T.button} mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#2563eb] px-4 font-bold text-white`}><Link2 className="h-4 w-4" />{node.artifact.title}</Link> : <p className={`${T.secondary} mt-4 text-[#64748b]`}>안전한 산출물 링크 없음</p>}<p className={`${T.secondary} mt-4 flex items-center gap-2 text-[#64748b]`}>{node.freshness === "fresh" ? <CheckCircle2 className="h-4 w-4 text-[#1f9d55]" /> : <Clock3 className="h-4 w-4 text-[#b98121]" />}{node.freshness === "fresh" ? "Preview 이벤트 최신" : "오래됨"}</p></aside>;
}

function Status({ status }: { status: ControlPlaneStatus }) { const tone = status === "completed" ? "bg-[#e9f7ef] text-[#1f9d55]" : status === "blocked" || status === "failed" ? "bg-[#faecef] text-[#a04455]" : status === "approval_waiting" || status === "review" ? "bg-[#fff6e8] text-[#b98121]" : "bg-[#eaf1ff] text-[#2563eb]"; return <span className={`${T.badge} shrink-0 rounded-full px-3 py-1 font-bold ${tone}`}>{STATUS[status]}</span>; }
function formatTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Seoul", hour12: false }).format(new Date(value)); }
