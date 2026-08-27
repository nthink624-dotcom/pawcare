"use client";

import { AlertTriangle, ChevronDown, Link2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import ContentApprovalFocus from "@/components/admin/content-approval-focus";
import SecurityApprovalFocus from "@/components/admin/security-approval-focus";
import { fetchApiJson } from "@/lib/api";
import type { ControlPlaneNode, ControlPlaneSnapshot, ControlPlaneStatus } from "@/types/agent-control-plane";

const STATUS: Record<ControlPlaneStatus, string> = { not_started: "시작 전", received: "요청", in_progress: "진행 중", review: "검수 중", approval_waiting: "승인 대기", approved: "승인", rejected: "거절", completed: "완료", blocked: "막힘", failed: "실패" };

export default function DemoAgentControlPlane({ mode = "operational" }: { mode?: "operational" | "demo" }) {
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ControlPlaneSnapshot | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(() => searchParams.get("work"));
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setSnapshot(await fetchApiJson<ControlPlaneSnapshot>(mode === "demo" ? "/api/admin/marketing/control-plane-preview?cursor=0" : "/api/admin/marketing/demo-control-plane", { cache: "no-store" })); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "연결 상태를 확인하지 못했습니다."); }
  }, [mode]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (mode !== "operational" || paused) return; const stream = new EventSource("/api/admin/marketing/demo-control-plane/stream"); stream.onmessage = (message) => { try { setSnapshot(JSON.parse(message.data) as ControlPlaneSnapshot); setError(null); } catch { setError("업무 상태 형식을 확인하지 못했습니다."); } }; stream.onerror = () => setError("실시간 연결 안 됨"); return () => stream.close(); }, [mode, paused]);
  const selected = snapshot?.nodes.find((node) => node.workId === selectedWorkId) ?? snapshot?.nodes.find((node) => node.status !== "completed") ?? snapshot?.nodes[0] ?? null;
  const activeNodes = useMemo(() => snapshot?.nodes.filter((node) => node.status !== "completed") ?? [], [snapshot]);
  const roots = activeNodes.filter((node) => !node.parentWorkId);
  const children = (id: string) => activeNodes.filter((node) => node.parentWorkId === id);
  const liveCount = snapshot?.nodes.filter((node) => node.eventSource === "codex_live").length ?? 0;
  const connectionLabel = liveCount > 0 ? "데모 관리자 · 새 이벤트 자동 반영" : "데모 관리자 · 실시간 연결 안 됨 · 마지막 수동 동기화";

  if (selectedWorkId === "GROWTH-CONTENT-D1-D7-REVIEW") return <ContentApprovalFocus />;
  if (selectedWorkId === "SECURITY-PRICE-SOURCE-RETENTION" && selected) return <SecurityApprovalFocus node={selected} />;

  return <main className={`${ADMIN_SURFACE} h-[100dvh] overflow-hidden !bg-white py-3 !text-[#171717]`}><div className="mx-auto flex h-full w-full max-w-[1380px] flex-col">
    <header className="flex min-h-12 items-center justify-between border-b border-[#d4d4d4]"><div className="min-w-0"><p className={`${T.secondary} truncate text-[#6b7280]`}>{connectionLabel}</p><h1 className="text-[26px] font-bold">마케팅 워크룸</h1></div><div className="flex gap-2"><button type="button" onClick={() => setPaused((value) => !value)} className="min-h-11 border border-[#d4d4d4] px-3 text-[15px]">{paused ? "갱신 재개" : "갱신 정지"}</button><button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-1 border border-[#d4d4d4] px-3 text-[15px]"><RefreshCw className="h-4 w-4" />새로고침</button></div></header>
    {error ? <p className="mt-2 flex items-center gap-2 border border-[#d4d4d4] px-3 py-2 text-[15px]"><AlertTriangle className="h-4 w-4" />연결 불가 · 마지막 상태는 최신으로 간주하지 않습니다.</p> : null}
    <section className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-0 overflow-auto border border-[#d4d4d4] bg-white p-4" aria-label="업무 오케스트레이션 그래프"><div className="flex items-center justify-between border-b border-[#e5e7eb] pb-3"><h2 className="text-[19px] font-medium">업무 흐름</h2><span className="text-[13px] text-[#6b7280]">목록 보기는 보조 기능</span></div><div className="mt-4 grid gap-5">{roots.map((root) => <div key={root.workId} className="relative grid items-center gap-3 md:grid-cols-[minmax(180px,.7fr)_32px_minmax(220px,1fr)]"><GraphNode node={root} selected={selected?.workId === root.workId} onSelect={setSelectedWorkId} /><div className="hidden h-px bg-[#9ca3af] md:block" /><div className="grid gap-2">{children(root.workId).length ? children(root.workId).map((child) => <GraphNode key={child.workId} node={child} selected={selected?.workId === child.workId} onSelect={setSelectedWorkId} />) : <span className="text-[14px] text-[#9ca3af]">하위 지시 없음</span>}</div></div>)}</div></div>
      <aside className="min-h-0 overflow-auto border border-[#d4d4d4] bg-white p-4"><Inspector node={selected} /><details className="mt-4 border-t border-[#e5e7eb] pt-3"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-[15px] font-medium">활동 기록 <ChevronDown className="h-4 w-4" /></summary><ol className="divide-y divide-[#e5e7eb]">{[...(snapshot?.timeline ?? [])].reverse().slice(0, 30).map((event) => <li key={event.eventId} className="py-2 text-[14px]"><span className="block truncate">{senderLabel(event)} · {event.title}</span><span className="text-[13px] text-[#6b7280]">{STATUS[event.status]} · {formatTime(event.sourceEventAt)}</span></li>)}</ol></details></aside>
    </section>
  </div></main>;
}

function GraphNode({ node, selected, onSelect }: { node: ControlPlaneNode; selected: boolean; onSelect: (id: string) => void }) { return <button type="button" onClick={() => onSelect(node.workId)} className={`min-h-[64px] w-full border bg-white px-3 py-2 text-left ${selected ? "border-2 border-black" : "border-[#d4d4d4] opacity-70"}`}><span className="block truncate text-[15px] font-medium">{senderLabel(node)} · {node.title}</span><span className="mt-1 flex items-center justify-between text-[13px] text-[#6b7280]"><span>{STATUS[node.status]}</span><span>{sourceLabel(node.eventSource)}</span></span></button>; }
function Inspector({ node }: { node: ControlPlaneNode | null }) { if (!node) return <p className="text-[15px] text-[#6b7280]">업무를 선택하세요.</p>; const rows = node.detailRows?.map(({ label, value }) => [label, value]) ?? [["요청", node.originalDirectiveSummary], ["운영팀 지시", node.operationsDirectiveSummary], ["현재 단계", STATUS[node.status]], ["완료", node.completedSummary ?? "아직 없음"], ["막힘", node.blockerSummary ?? "없음"], ["다음 행동", node.nextAction]]; return <><p className="text-[13px] text-[#6b7280]">{senderLabel(node)} · {STATUS[node.status]}</p><h2 className="mt-1 text-[18px] font-medium">{node.title}</h2><dl className="mt-3 divide-y divide-[#e5e7eb]">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[86px_1fr] gap-2 py-2"><dt className="text-[13px] text-[#6b7280]">{label}</dt><dd className="text-[15px]">{value}</dd></div>)}</dl>{node.artifact ? <Link href={node.artifact.url as never} className="mt-3 inline-flex min-h-11 items-center gap-2 bg-black px-3 text-[15px] text-white"><Link2 className="h-4 w-4" />{node.artifact.title}</Link> : null}</>; }
function sourceLabel(source: ControlPlaneNode["eventSource"]) { return source === "codex_live" ? "자동 연결" : source === "local_snapshot" ? "이전 기록" : source === "fixture" ? "데모 데이터" : source === "unavailable" ? "연결 불가" : "수동 기록"; }
function senderLabel(node: Pick<ControlPlaneNode, "role">) { if (node.role === "성장팀") return "성장팀"; if (node.role === "마케팅 분석팀" || node.role === "분석팀") return "마케팅 분석팀"; if (node.role === "구현팀") return "Codex 구현팀"; return node.role; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "시각 확인 불가" : new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul", hour12: false }).format(date); }
