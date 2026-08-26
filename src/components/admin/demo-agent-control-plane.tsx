"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Link2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import type { ControlPlaneNode, ControlPlaneSnapshot, ControlPlaneStatus } from "@/types/agent-control-plane";

const STATUS: Record<ControlPlaneStatus, string> = { not_started: "시작 전", received: "지시 수신", in_progress: "진행 중", review: "검수 중", approval_waiting: "승인 대기", completed: "완료", blocked: "막힘", failed: "실패" };

export default function DemoAgentControlPlane({ mode = "operational" }: { mode?: "operational" | "demo" }) {
  const [snapshot, setSnapshot] = useState<ControlPlaneSnapshot | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState("CP-OPS-001");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"work" | "detail" | "events">("work");
  const load = useCallback(async (cursor: number) => {
    try {
      const endpoint = mode === "demo" ? `/api/admin/marketing/control-plane-preview?cursor=${cursor}` : "/api/dev/agent-control-plane";
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
  const connected = mode === "operational" ? Boolean(snapshot?.nodes.length) : snapshot?.sources.codex === "connected" || snapshot?.sources.mastra === "connected";
  const connectionLabel = mode === "demo" ? "데모 데이터" : error || snapshot?.nodes.length === 0 ? "데모 관리자 · 연결 안 됨" : "데모 관리자 · 실제 업무 상태 연결";
  const roots = useMemo(() => snapshot?.nodes.filter((node) => !node.parentWorkId) ?? [], [snapshot]);
  const children = useCallback((id: string) => snapshot?.nodes.filter((node) => node.parentWorkId === id) ?? [], [snapshot]);

  return <main className={`${ADMIN_SURFACE} h-[100dvh] overflow-hidden !bg-white py-3 !text-[#171717] md:py-4`}><div className="mx-auto flex h-full w-full max-w-[1380px] flex-col">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d4d4d4] pb-3"><div><p className={`${T.badge} font-medium text-[#525252]`}>{connectionLabel}</p><h1 className="mt-0.5 text-[clamp(24px,2.2vw,30px)] font-bold leading-tight text-[#171717]">마케팅 워크룸</h1></div><Link href={mode === "demo" ? "/admin/marketing" : "/admin/marketing?view=details"} className={`${T.button} inline-flex items-center gap-2 rounded-md border border-[#d4d4d4] bg-white px-3 font-medium text-[#262626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black`}><ArrowLeft className="h-4 w-4" />{mode === "demo" ? "마케팅 워크룸" : "세부 단계 보기"}</Link></header>
      <div className={`${T.secondary} mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d4d4d4] bg-white px-3 py-2`}><div className="flex flex-wrap gap-x-4 gap-y-1"><span>현재 업무 · <span className="font-medium">{snapshot?.nodes.length ?? "확인 중"}</span></span><span>{error ? "연결 끊김" : "마지막 확인"} · <span className="font-medium">{snapshot ? formatTime(snapshot.checkedAt) : "확인 중"}</span></span><span>막힘 · <span className="font-medium">{connected ? "없음" : "자동 상태 연결 대기"}</span></span><span>외부 실행 · <span className="font-medium">꺼짐</span></span></div><div className="flex gap-1.5"><button type="button" onClick={() => setPaused((value) => !value)} className={`${T.button} min-h-11 rounded-md border border-[#d4d4d4] px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-black`}>{paused ? "재개" : "일시정지"}</button><button type="button" onClick={() => { setSnapshot(null); void load(0); }} className={`${T.button} inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[#d4d4d4] px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-black`}><RefreshCw className="h-4 w-4" />{mode === "demo" ? "Replay" : "새로고침"}</button></div></div>
    {error ? <p className={`${T.body} mt-3 flex items-center gap-2 rounded-md border border-[#d4d4d4] bg-white p-3 text-[#404040]`}><AlertTriangle className="h-5 w-5" />{error} · 이전 상태는 오래됨으로 취급합니다.</p> : null}
    <nav className="mt-2 grid min-h-11 grid-cols-3 overflow-hidden rounded-lg border border-[#dbe2ea] bg-white md:hidden" aria-label="워크룸 보기"><MobileTab label="업무" active={mobileTab === "work"} onClick={() => setMobileTab("work")} /><MobileTab label="상세" active={mobileTab === "detail"} onClick={() => setMobileTab("detail")} /><MobileTab label="이벤트" active={mobileTab === "events"} onClick={() => setMobileTab("events")} /></nav>
    <section className="mt-2 grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(300px,.85fr)_minmax(280px,.75fr)]">
      <div className={`${mobileTab === "work" ? "block" : "hidden"} min-h-0 overflow-auto rounded-md border border-[#d4d4d4] bg-white p-3 md:block`}><div className="mb-2 flex items-center justify-between"><h2 className="text-[20px] font-medium leading-7">업무 계보</h2><span className={`${T.badge} rounded-full border border-[#e5e5e5] bg-white px-2.5 py-0.5 font-medium text-[#525252]`}>{snapshot?.timeline.length ?? 0}개 이벤트</span></div><div className="space-y-2">{roots.map((root) => <div key={root.workId}><NodeCard node={root} selected={selected?.workId === root.workId} onSelect={(id) => { setSelectedWorkId(id); setMobileTab("detail"); }} /><div className="ml-4 mt-2 grid gap-2 border-l border-[#d4d4d4] pl-3">{children(root.workId).map((child) => <NodeCard key={child.workId} node={child} selected={selected?.workId === child.workId} onSelect={(id) => { setSelectedWorkId(id); setMobileTab("detail"); }} />)}</div></div>)}</div></div>
      <div className={`${mobileTab === "detail" ? "block" : "hidden"} min-h-0 overflow-auto md:block`}><Detail node={selected} /></div>
      <div className={`${mobileTab === "events" ? "block" : "hidden"} min-h-0 overflow-auto rounded-md border border-[#d4d4d4] bg-white p-3 md:block`}><h2 className="text-[20px] font-medium leading-7">최근 이벤트</h2><ol className="mt-2 space-y-1.5">{[...(snapshot?.timeline ?? [])].reverse().map((event) => <li key={event.eventId} className="grid grid-cols-[16px_1fr] gap-2"><span className="mt-1.5 h-2 w-2 rounded-full bg-[#525252]" /><div className="border-b border-[#e5e5e5] pb-2"><div className="flex flex-wrap items-center justify-between gap-1"><span className={`${T.body} font-medium`}>{event.role} · {STATUS[event.status]}</span><time className={`${T.secondary} text-[#737373]`}>{formatTime(event.sourceEventAt)}</time></div><p className={`${T.secondary} truncate text-[#525252]`}>{event.title}</p></div></li>)}</ol></div>
    </section>
  </div></main>;
}

function MobileTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`${T.button} min-h-11 border-r border-[#e5e5e5] px-2 font-medium last:border-r-0 ${active ? "bg-[#171717] text-white" : "bg-white text-[#525252]"}`}>{label}</button>; }

function NodeCard({ node, selected, onSelect }: { node: ControlPlaneNode; selected: boolean; onSelect: (id: string) => void }) {
  return <button type="button" onClick={() => onSelect(node.workId)} aria-label={`${senderLabel(node)}의 ${node.title} 보고 상세 열기`} className={`flex min-h-11 w-full items-center gap-2 rounded-md border bg-white px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-black ${selected ? "border-[#171717]" : "border-[#d4d4d4]"}`}><span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base"><span className="font-medium">{senderLabel(node)}</span> · {node.title} {STATUS[node.status]}</span></button>;
}

function senderLabel(node: ControlPlaneNode) { if (node.source === "growth") return "펫매니저 성장팀"; if (node.source === "analysis") return "펫매니저 마케팅 분석팀"; if (node.source === "operations") return node.role === "구현팀" ? "Codex 구현팀" : "운영팀"; if (node.role === "구현팀") return "Codex 구현팀"; return "발신팀 확인 불가"; }

function Detail({ node }: { node: ControlPlaneNode | null }) {
  if (!node) return <aside className={`${T.body} rounded-xl border border-dashed border-[#cbd5e1] bg-white p-5 text-[#64748b]`}>이벤트 수신 대기</aside>;
  const rows = [["원지시", node.originalDirectiveSummary], ["운영팀 지시", node.operationsDirectiveSummary], ["담당", node.role], ["현재 단계", STATUS[node.status]], ["완료", node.completedSummary ?? "아직 없음"], ["막힘", node.blockerSummary ?? "없음"], ["다음 행동", node.nextAction], ["승인", node.approvalRequired ? "대표 승인 필요" : "현재 승인 불필요"], ["갱신", formatTime(node.sourceEventAt)]];
  return <aside className="rounded-md border border-[#d4d4d4] bg-white p-3 xl:sticky xl:top-3 xl:h-fit"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className={`${T.badge} font-medium text-[#525252]`}>선택된 업무</p><h2 className="mt-0.5 text-[18px] font-medium leading-6">{node.title}</h2></div><Status status={node.status} /></div><dl className="mt-2 divide-y divide-[#e5e5e5]">{rows.map(([label, value]) => <div key={label} className="grid gap-0.5 py-2 sm:grid-cols-[78px_1fr]"><dt className={`${T.secondary} text-[#737373]`}>{label}</dt><dd className={`${T.body} text-[#404040]`}>{value}</dd></div>)}</dl>{node.artifact ? <Link href={node.artifact.url as never} className={`${T.button} mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#171717] px-3 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black`}><Link2 className="h-4 w-4" />{node.artifact.title}</Link> : <p className={`${T.secondary} mt-3 text-[#737373]`}>안전한 산출물 링크 없음</p>}<p className={`${T.secondary} mt-3 flex items-center gap-2 text-[#737373]`}>{node.freshness === "fresh" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}{node.freshness === "fresh" ? "원장 갱신 최신" : "오래됨"}</p></aside>;
}

function Status({ status }: { status: ControlPlaneStatus }) { const tone = status === "completed" ? "border-[#a3a3a3] text-[#525252]" : status === "blocked" || status === "failed" ? "border-[#171717] text-[#171717]" : "border-[#d4d4d4] text-[#404040]"; return <span className={`${T.badge} shrink-0 rounded-full border bg-white px-3 py-1 font-medium ${tone}`}>{STATUS[status]}</span>; }
function formatTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Seoul", hour12: false }).format(new Date(value)); }
