"use client";

import { AlertTriangle, ChevronDown, GitBranch, Link2, List, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
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
  const [view, setView] = useState<"graph" | "list">("graph");
  const [inspectorWidth, setInspectorWidth] = useState(440);
  const [mobileInspectorExpanded, setMobileInspectorExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSelectedWorkId(searchParams.get("work"));
  }, [searchParams]);
  const load = useCallback(async () => {
    try { setSnapshot(await fetchApiJson<ControlPlaneSnapshot>(mode === "demo" ? "/api/admin/marketing/control-plane-preview?cursor=0" : "/api/admin/marketing/demo-control-plane", { cache: "no-store" })); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "연결 상태를 확인하지 못했습니다."); }
  }, [mode]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (mode !== "operational" || paused) return; const stream = new EventSource("/api/admin/marketing/demo-control-plane/stream"); stream.onmessage = (message) => { try { setSnapshot(JSON.parse(message.data) as ControlPlaneSnapshot); setError(null); } catch { setError("업무 상태 형식을 확인하지 못했습니다."); } }; stream.onerror = () => setError("실시간 연결 안 됨"); return () => stream.close(); }, [mode, paused]);
  const selected = snapshot?.nodes.find((node) => node.workId === selectedWorkId) ?? snapshot?.nodes.find((node) => node.status !== "completed") ?? snapshot?.nodes[0] ?? null;
  const allNodes = useMemo(() => snapshot?.nodes ?? [], [snapshot]);
  const activeNodes = useMemo(() => allNodes.filter((node) => node.status !== "completed"), [allNodes]);
  const selectedWorkflow = useMemo(() => selectedWorkId && selected?.workId === selectedWorkId ? projectSelectedWorkflow(selected) : [], [selected, selectedWorkId]);
  const visibleNodes = useMemo(() => {
    const visible = new Map(activeNodes.map((node) => [node.workId, node]));
    for (const node of selectedWorkflow) visible.set(node.workId, node);
    for (const node of allNodes) if (node.parentWorkId === selectedWorkId) visible.set(node.workId, node);
    return [...visible.values()];
  }, [activeNodes, allNodes, selectedWorkflow, selectedWorkId]);
  const nodeById = useMemo(() => new Map(visibleNodes.map((node) => [node.workId, node])), [visibleNodes]);
  const selectedLineage = useMemo(() => collectLineage(selectedWorkId, nodeById), [nodeById, selectedWorkId]);
  const roots = visibleNodes.filter((node) => !node.parentWorkId || !nodeById.has(node.parentWorkId));
  const selectedRoot = selectedLineage[0];
  const graphRoots = useMemo(() => {
    const connected = roots.filter((root) => visibleNodes.some((node) => node.parentWorkId === root.workId)).sort((a, b) => Date.parse(b.sourceEventAt) - Date.parse(a.sourceEventAt));
    if (!selectedRoot) return connected.slice(0, 1);
    const companion = connected.find((root) => root.workId !== selectedRoot.workId && graphDepth(root.workId, visibleNodes) >= 4);
    return companion ? [selectedRoot, companion] : [selectedRoot];
  }, [roots, selectedRoot, visibleNodes]);
  const pathIds = useMemo(() => {
    const ids = new Set<string>();
    let cursor: ControlPlaneNode | null | undefined = selectedWorkId ? nodeById.get(selectedWorkId) : null;
    while (cursor && !ids.has(cursor.workId)) { ids.add(cursor.workId); cursor = cursor.parentWorkId ? nodeById.get(cursor.parentWorkId) : undefined; }
    for (const node of visibleNodes) if (node.parentWorkId === selectedWorkId) ids.add(node.workId);
    return ids;
  }, [nodeById, selectedWorkId, visibleNodes]);
  const liveCount = snapshot?.nodes.filter((node) => node.eventSource === "codex_live").length ?? 0;
  const connectionLabel = liveCount > 0 ? "데모 관리자 · 새 이벤트 자동 반영" : "데모 관리자 · 실시간 연결 안 됨 · 마지막 수동 동기화";
  const resizeInspector = (event: ReactPointerEvent<HTMLButtonElement>) => { const startX = event.clientX; const startWidth = inspectorWidth; const move = (moveEvent: PointerEvent) => setInspectorWidth(Math.min(560, Math.max(380, startWidth + startX - moveEvent.clientX))); const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop); };

  if (selectedWorkId === "GROWTH-CONTENT-D1-D7-REVIEW") return <ContentApprovalFocus />;
  if (selectedWorkId === "SECURITY-PRICE-SOURCE-RETENTION" && selected) return <SecurityApprovalFocus node={selected} />;

  return <main className={`${ADMIN_SURFACE} h-[100dvh] overflow-hidden !bg-white px-2 pb-2 pt-[84px] !text-[#171717] sm:py-3`}><div className="mx-auto flex h-full w-full max-w-[1380px] flex-col overflow-hidden">
    <header className="flex min-h-12 items-center justify-between gap-2 border-b border-[#d4d4d4]"><div className="min-w-0"><p className={`${T.secondary} truncate text-[#6b7280]`}>{connectionLabel}</p><h1 className="truncate text-[22px] font-bold sm:text-[26px]">마케팅 워크룸</h1></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "갱신 재개" : "갱신 정지"} className="min-h-11 whitespace-nowrap border border-[#d4d4d4] px-2 text-[14px] sm:px-3 sm:text-[15px]"><span className="hidden sm:inline">{paused ? "갱신 재개" : "갱신 정지"}</span><span className="sm:hidden">{paused ? "재개" : "정지"}</span></button><button type="button" onClick={() => void load()} aria-label="새로고침" className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap border border-[#d4d4d4] px-2 text-[14px] sm:px-3 sm:text-[15px]"><RefreshCw className="h-4 w-4" /><span className="hidden sm:inline">새로고침</span></button></div></header>
    {error ? <p className="mt-2 flex items-center gap-2 border border-[#d4d4d4] px-3 py-2 text-[15px]"><AlertTriangle className="h-4 w-4" />연결 불가 · 마지막 상태는 최신으로 간주하지 않습니다.</p> : null}
    <section className="mt-3 grid min-h-0 flex-1 grid-rows-1 gap-3 xl:grid-cols-[minmax(0,1fr)_var(--inspector-width)]" style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}>
      <div className="flex min-h-0 flex-col overflow-hidden border border-[#d4d4d4] bg-white max-sm:-mx-[10px]" aria-label="업무 오케스트레이션 그래프">
        <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#e5e7eb] px-3"><div className="min-w-0"><h2 className="text-[18px] font-medium">업무 흐름</h2><p className="truncate text-[13px] text-[#6b7280]">대표 요청 → 운영팀 → 담당 팀 → 결과·승인</p></div><div className="flex shrink-0" aria-label="보기 전환"><button type="button" onClick={() => setView("graph")} className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap border px-2 text-[14px] sm:px-3 ${view === "graph" ? "bg-black text-white" : "border-[#d4d4d4] bg-white"}`}><GitBranch className="h-4 w-4" />그래프</button><button type="button" onClick={() => setView("list")} className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap border px-2 text-[14px] sm:px-3 ${view === "list" ? "bg-black text-white" : "border-[#d4d4d4] bg-white"}`}><List className="h-4 w-4" />목록</button></div></div>
        <details className="border-b border-[#e5e7eb] px-3"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-[14px]">선택 계보 미니맵 <ChevronDown className="h-4 w-4" /></summary><p className="truncate pb-2 text-[13px] text-[#6b7280]">{lineageLabel(selected, nodeById)}</p></details>
        {view === "graph" ? <div className={`min-h-0 flex-1 overflow-auto p-6 max-sm:p-3 ${selectedWorkId ? "sm:max-xl:pr-[440px]" : ""}`} data-testid="graph-canvas">{graphRoots.length ? <div className="flex min-h-full min-w-max snap-x flex-col items-center justify-center gap-8 xl:[zoom:0.82] max-xl:[zoom:0.46] max-sm:items-start max-sm:[zoom:1]">{graphRoots.map((root) => <div key={root.workId} className="snap-center"><GraphBranch node={root} nodes={visibleNodes} selectedId={selectedWorkId} pathIds={pathIds} onSelect={setSelectedWorkId} /></div>)}</div> : <div className="grid h-full place-items-center"><p className="w-[min(320px,100%)] text-center text-[15px] text-[#6b7280]">{snapshot === null && !error ? "업무 원장을 불러오는 중입니다." : "업무 원장을 불러올 수 없습니다."}</p></div>}</div> : <div className="min-h-0 flex-1 overflow-auto divide-y divide-[#e5e7eb]">{activeNodes.map((node) => <button key={node.workId} type="button" onClick={() => setSelectedWorkId(node.workId)} className="grid min-h-11 w-full grid-cols-[120px_1fr_90px] items-center gap-2 px-3 text-left text-[14px]"><span>{senderLabel(node)}</span><span className="truncate">{displayTitle(node)}</span><span>{STATUS[node.status]}</span></button>)}</div>}
      </div>
      {snapshot || error ? <aside className={`fixed inset-x-0 bottom-0 z-40 min-h-0 border border-[#d4d4d4] bg-white p-4 sm:left-auto sm:max-h-[72dvh] sm:w-[440px] sm:overflow-auto xl:relative xl:inset-auto xl:z-auto xl:max-h-none xl:w-auto ${mobileInspectorExpanded ? "max-sm:max-h-[72dvh] max-sm:overflow-auto" : "max-sm:max-h-[180px] max-sm:overflow-hidden"} ${selectedWorkId ? "" : "max-xl:hidden"}`}><button type="button" aria-label="Inspector 크기 조절" onPointerDown={resizeInspector} className="absolute -left-1 top-0 hidden h-full w-2 cursor-col-resize touch-none xl:block" /><div className="mb-2 flex gap-2"><button type="button" onClick={() => setMobileInspectorExpanded((value) => !value)} className="min-h-11 flex-1 border border-[#d4d4d4] px-3 text-[13px] sm:hidden">{mobileInspectorExpanded ? "상세 접기" : "상세 펼치기"}</button><button type="button" onClick={() => setSelectedWorkId(null)} className="min-h-11 border border-[#d4d4d4] px-3 text-[13px]">상세 닫기</button></div><Inspector node={selected} /><details className="mt-3 border-t border-[#e5e7eb] pt-2"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-[13px] font-medium">활동 기록 <ChevronDown className="h-4 w-4" /></summary><ol className="divide-y divide-[#e5e7eb]">{[...(snapshot?.timeline ?? [])].reverse().slice(0, 30).map((event) => <li key={event.eventId} className="py-2 text-[13px]"><span className="block truncate">{senderLabel(event)} · {displayTitle(event)}</span><span className="text-[12px] text-[#6b7280]">{STATUS[event.status]} · {formatTime(event.sourceEventAt)}</span></li>)}</ol></details></aside> : null}
    </section>
  </div></main>;
}

function GraphBranch({ node, nodes, selectedId, pathIds, onSelect }: { node: ControlPlaneNode; nodes: ControlPlaneNode[]; selectedId: string | null; pathIds: Set<string>; onSelect: (id: string) => void }) { const descendants = nodes.filter((candidate) => candidate.parentWorkId === node.workId); const emphasized = pathIds.has(node.workId); return <div className="flex items-center"><GraphNode node={node} selected={selectedId === node.workId} highlighted={emphasized} onSelect={onSelect} />{descendants.length ? <><div data-graph-edge data-highlighted={emphasized} className={`h-px w-11 shrink-0 max-sm:w-2.5 ${emphasized ? "h-0.5 bg-black" : "bg-[#c3c8cf]"}`} /><div className={`grid gap-6 ${descendants.length > 1 ? emphasized ? "border-l-2 border-black" : "border-l border-[#c3c8cf]" : ""}`}>{descendants.map((child) => <GraphBranch key={child.workId} node={child} nodes={nodes} selectedId={selectedId} pathIds={pathIds} onSelect={onSelect} />)}</div></> : null}</div>; }
function GraphNode({ node, selected, highlighted, onSelect }: { node: ControlPlaneNode; selected: boolean; highlighted: boolean; onSelect: (id: string) => void }) { return <button type="button" onClick={() => onSelect(node.workId)} aria-pressed={selected} data-graph-node={node.workId} data-highlighted={highlighted} className={`min-h-[66px] w-[168px] shrink-0 rounded-[6px] bg-white px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 max-sm:w-[108px] max-sm:px-2 ${highlighted ? "border-2 border-black shadow-sm" : "border border-[#c3c8cf]"}`}><span className="block truncate text-[14px] font-medium max-sm:text-[11px] max-sm:leading-[15px]">{senderLabel(node)}</span><span className="mt-1 line-clamp-2 text-[13px] leading-[17px] max-sm:text-[11px] max-sm:leading-[15px]">{displayTitle(node)}</span></button>; }
function Inspector({ node }: { node: ControlPlaneNode | null }) { if (!node) return <p className="text-[13px] text-[#6b7280]">업무를 선택하세요.</p>; const description = node.workId === "SETUP-SERVICE-PRICE-ONCE" ? "가입 첫 단계에서 서비스명과 가격을 입력하고, 가입 완료 시 매장 계정에 저장합니다." : node.originalDirectiveSummary; return <><p className="text-[12px] text-[#6b7280]">{sourceLabel(node.eventSource)} · {formatTime(node.sourceEventAt)}</p><h2 className="mt-1 text-[16px] font-medium leading-5">{displayTitle(node)}</h2><section className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3"><Info label="팀/에이전트" value={senderLabel(node)} /><Info label="현재 단계" value={STATUS[node.status]} /><Info label="승인 필요" value={node.approvalRequired ? "필요" : "없음"} /><Info label="연결 상태" value={sourceLabel(node.eventSource)} /></section><section className="mt-4 border-t border-[#e5e7eb] pt-3"><h3 className="text-[13px] font-medium">업무 내용</h3><p className="mt-1 text-[13px] leading-5">{description}</p><p className="mt-2 text-[13px] leading-5">{node.operationsDirectiveSummary}</p></section><section className="mt-4 grid gap-3 border-t border-[#e5e7eb] pt-3"><Info label="완료" value={node.completedSummary ?? "아직 없음"} /><Info label="막힘" value={node.blockerSummary ?? "없음"} /><Info label="다음 행동" value={node.nextAction} /></section><div className="mt-3 flex flex-wrap gap-2">{node.approvalRequired ? <Link href={`/admin/approvals/${node.workId}` as never} className="inline-flex min-h-11 items-center bg-black px-3 text-[13px] text-white">대표 승인 집중 보기</Link> : null}{node.artifact ? <Link href={node.artifact.url as never} className="inline-flex min-h-11 items-center gap-2 border border-black px-3 text-[13px]"><Link2 className="h-4 w-4" />{node.artifact.title}</Link> : null}</div></>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[12px] leading-4 text-[#6b7280]">{label}</p><p className="mt-0.5 text-[13px] leading-5">{value}</p></div>; }
function displayTitle(node: Pick<ControlPlaneNode, "workId" | "title">) { return node.workId === "SETUP-SERVICE-PRICE-ONCE" ? "회원가입 중 서비스·가격 최초 등록" : node.title; }
function projectSelectedWorkflow(node: ControlPlaneNode): ControlPlaneNode[] {
  const prefix = `GRAPH-${node.workId}`;
  const stage = (workId: string, parentWorkId: string | null, role: ControlPlaneNode["role"], eventType: ControlPlaneNode["eventType"], status: ControlPlaneStatus, title: string): ControlPlaneNode => ({ ...node, workId, parentWorkId, role, eventType, status, title, eventSource: "local_snapshot", approvalRequired: false, artifact: null, completedSummary: null, blockerSummary: null, lastEventId: `${node.lastEventId}-${workId}` });
  const ownerTitle = node.workId === "SETUP-SERVICE-PRICE-ONCE" ? "회원가입 중 서비스·가격 최초 등록 요청" : node.originalDirectiveSummary;
  const owner = stage(`${prefix}-OWNER`, null, "운영팀", "owner_request_received", "received", ownerTitle);
  const operations = stage(`${prefix}-OPERATIONS`, owner.workId, "운영팀", "operations_directive_sent", "received", node.operationsDirectiveSummary);
  const team = stage(`${prefix}-TEAM`, operations.workId, node.role, "agent_work_started", "in_progress", `${senderLabel(node)} 업무 착수`);
  const selectedTask = { ...node, parentWorkId: team.workId };
  const result = stage(`${prefix}-RESULT`, selectedTask.workId, node.role, "agent_result_submitted", "not_started", node.nextAction || "검수 결과 대기");
  return [owner, operations, team, selectedTask, result];
}
function collectLineage(workId: string | null, nodes: Map<string, ControlPlaneNode>) { const lineage: ControlPlaneNode[] = []; let cursor = workId ? nodes.get(workId) : undefined; const seen = new Set<string>(); while (cursor && !seen.has(cursor.workId)) { seen.add(cursor.workId); lineage.unshift(cursor); cursor = cursor.parentWorkId ? nodes.get(cursor.parentWorkId) : undefined; } return lineage; }
function graphDepth(rootId: string, nodes: ControlPlaneNode[]): number { const children = nodes.filter((node) => node.parentWorkId === rootId); return children.length ? 1 + Math.max(...children.map((node) => graphDepth(node.workId, nodes))) : 1; }
function lineageLabel(node: ControlPlaneNode | null, nodeById: Map<string, ControlPlaneNode>) { if (!node) return "선택된 업무 없음"; const labels: string[] = []; let cursor: ControlPlaneNode | undefined = node; const seen = new Set<string>(); while (cursor && !seen.has(cursor.workId)) { seen.add(cursor.workId); labels.unshift(senderLabel(cursor)); cursor = cursor.parentWorkId ? nodeById.get(cursor.parentWorkId) : undefined; } return `${labels.join(" › ")} › ${STATUS[node.status]}`; }
function sourceLabel(source: ControlPlaneNode["eventSource"]) { return source === "codex_live" ? "자동 연결" : source === "local_snapshot" ? "이전 기록" : source === "fixture" ? "데모 데이터" : source === "unavailable" ? "연결 불가" : "수동 기록"; }
function senderLabel(node: Pick<ControlPlaneNode, "role"> & Partial<Pick<ControlPlaneNode, "eventType">>) { if (node.eventType === "owner_request_received") return "대표 요청"; if (node.role === "성장팀") return "성장팀"; if (node.role === "마케팅 분석팀" || node.role === "분석팀") return "마케팅 분석팀"; if (node.role === "구현팀") return "Codex 구현팀"; return node.role; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "시각 확인 불가" : new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul", hour12: false }).format(date); }
