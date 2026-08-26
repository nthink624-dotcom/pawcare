"use client";

import { AlertTriangle, ArrowLeft, Check, LockKeyhole, Pause, RotateCcw, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import type { MarketingApprovalDecision, MarketingNodeStatus, MarketingWarRoomNode, MarketingWarRoomSnapshot } from "@/types/marketing-war-room";

const STATUS_LABELS: Record<MarketingNodeStatus, string> = { not_started: "시작 전", in_progress: "진행 중", blocked: "막힘", review: "검토 중", approval_waiting: "승인 대기", approved: "승인됨", rejected: "거절", completed: "완료" };
const FILTERS = ["전체", "운영팀", "분석팀", "성장팀", "승인 대기", "막힘"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminMarketingWarRoom({ sessionLoginId, representative }: { sessionLoginId: string; representative: boolean }) {
  const [snapshot, setSnapshot] = useState<MarketingWarRoomSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("SOURCING_APPROVAL");
  const [filter, setFilter] = useState<Filter>("전체");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setSnapshot(await fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { cache: "no-store" })); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "워룸 상태를 확인하지 못했습니다."); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(timer); }, [load]);

  const visibleNodes = useMemo(() => (snapshot?.nodes ?? []).filter((node) => {
    if (filter === "전체") return true;
    if (filter === "승인 대기") return node.status === "approval_waiting";
    if (filter === "막힘") return node.status === "blocked" || node.status === "rejected" || Boolean(node.safetyViolation);
    return node.team === filter;
  }), [filter, snapshot]);
  const selected = snapshot?.nodes.find((node) => node.id === selectedId) ?? visibleNodes[0] ?? null;

  async function decide(decision: MarketingApprovalDecision) {
    if (!selected?.approvalActionVisible || busy) return;
    setBusy(true);
    try {
      setSnapshot(await fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gateId: selected.id, decision }) }));
      setError(null);
    } catch (decisionError) { setError(decisionError instanceof Error ? decisionError.message : "결정을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f4f6f5] px-3 py-4 text-[#172033] md:px-6"><div className="mx-auto w-full max-w-[1480px]">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-[13px] font-semibold text-[#1f6b5b]">마케팅 운영 관제</p><span className="rounded-full border border-[#cfe3dc] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1f6b5b]">FAIL-CLOSED</span></div><h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-[#0f172a]">성장 흐름 워룸</h1><p className="mt-1 text-[12px] text-[#64748b]">{sessionLoginId} · {representative ? "대표 권한" : "조회 권한"}</p></div><Link href="/admin" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-semibold text-[#334155]"><ArrowLeft className="h-4 w-4" />관리자 메인</Link></header>
    {error ? <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] text-[#a04455]"><AlertTriangle className="h-4 w-4" />{error}</div> : null}
    <SafetyBanner violations={snapshot?.nodes.filter((node) => node.safetyViolation) ?? []} />
    <ApprovalGroups snapshot={snapshot} />
    <MarketingPlanCard snapshot={snapshot} />
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="보기 필터">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${filter === item ? "border-[#1f6b5b] bg-[#1f6b5b] text-white" : "border-[#dbe2ea] bg-white text-[#607080]"}`}>{item}</button>)}</div>
    <section className="mt-3 grid min-h-[620px] gap-3 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="overflow-x-auto rounded-[12px] border border-[#dfe6e3] bg-[#eef2f0] p-4"><div className="grid min-w-[280px] gap-3 md:min-w-[900px] md:grid-cols-4">{visibleNodes.map((node, index) => <div key={node.id} className="relative">{index > 0 ? <span className="absolute -left-3 top-1/2 hidden h-px w-3 bg-[#94a3b8] md:block" aria-hidden /> : null}<WorkflowCard node={node} selected={selected?.id === node.id} onSelect={() => setSelectedId(node.id)} /></div>)}</div>{!visibleNodes.length ? <p className="py-20 text-center text-[13px] text-[#64748b]">이 보기에 해당하는 단계가 없습니다.</p> : null}</div><DetailPanel node={selected} snapshot={snapshot} busy={busy} onDecision={decide} /></section>
  </div></main>;
}

function WorkflowCard({ node, selected, onSelect }: { node: MarketingWarRoomNode; selected: boolean; onSelect: () => void }) {
  const locked = !node.prerequisitesSatisfied;
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`min-h-40 w-full rounded-[10px] border bg-white p-4 text-left transition ${selected ? "border-[#1f6b5b] ring-2 ring-[#cfe3dc]" : "border-[#dbe2ea] hover:border-[#9fb9b0]"}`}><div className="flex items-start justify-between gap-2"><span className="font-mono text-[10px] text-[#94a3b8]">{node.workId}</span><StatusBadge status={node.status} /></div><h2 className="mt-3 text-[14px] font-semibold text-[#172033]">{node.title}</h2><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#64748b]">{node.purpose}</p><div className="mt-3 flex items-center justify-between text-[11px]"><span className="font-semibold text-[#607080]">{node.team}</span><span className={locked ? "text-[#b98121]" : "text-[#1f9d55]"}>{locked ? <span className="inline-flex items-center gap-1"><LockKeyhole className="h-3 w-3" />선행 단계 대기</span> : node.progressLabel}</span></div></button>;
}

function DetailPanel({ node, snapshot, busy, onDecision }: { node: MarketingWarRoomNode | null; snapshot: MarketingWarRoomSnapshot | null; busy: boolean; onDecision: (value: MarketingApprovalDecision) => void }) {
  if (!node) return <aside className="rounded-[12px] border border-[#dbe2ea] bg-white p-5 text-[13px] text-[#64748b]">카드를 선택해 상세를 확인하세요.</aside>;
  const rows = [["작업명", node.title], ["목적", node.purpose], ["담당 팀", node.team], ["상태", STATUS_LABELS[node.status]], ["진행 단계", node.progressLabel], ["기한", nullable(node.dueAt, "미입력")], ["완료 내용", nullable(node.completedSummary, "미입력")], ["막힘", nullable(node.blocker, "없음")], ["다음 행동", node.nextAction], ["work_id", node.workId], ["승인 필요", node.approvalRequired ? "필요" : "불필요"], ["승인 범위", nullable(node.approvalScope, "해당 없음")], ["최종 갱신", nullable(node.lastUpdatedAt, "미연결")], ["연결·신선도", freshnessLabel(node.freshness)]];
  return <aside className="rounded-[12px] border border-[#dbe2ea] bg-white p-5 xl:sticky xl:top-4 xl:h-fit"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-[#1f6b5b]">선택 작업 상세</p><h2 className="mt-1 text-[18px] font-semibold">{node.title}</h2></div><StatusBadge status={node.status} /></div>{node.safetyViolation ? <div className="mt-3 rounded-[8px] border border-[#e2bdc4] bg-[#fff7f7] p-3 text-[12px] font-semibold text-[#a04455]">안전 위반 · {node.safetyViolation}</div> : null}<dl className="mt-4 divide-y divide-[#eef2f5]">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[88px_1fr] gap-3 py-2.5"><dt className="text-[11px] text-[#94a3b8]">{label}</dt><dd className="break-words text-[12px] leading-5 text-[#334155]">{value}</dd></div>)}</dl>{node.approvalActionVisible ? <div className="mt-4 border-t border-[#e2e8f0] pt-4"><p className="mb-2 text-[11px] text-[#607080]">결정은 상태와 감사 이력만 변경합니다.</p><div className="grid grid-cols-2 gap-2"><DecisionButton icon={Check} label="승인" disabled={busy} onClick={() => onDecision("approve")} /><DecisionButton icon={RotateCcw} label="수정 요청" disabled={busy} onClick={() => onDecision("revise")} /><DecisionButton icon={Pause} label="보류" disabled={busy} onClick={() => onDecision("hold")} /><DecisionButton icon={X} label="거절" disabled={busy} onClick={() => onDecision("reject")} /></div></div> : <div className="mt-4 rounded-[8px] bg-[#f8fafc] p-3 text-[11px] leading-5 text-[#64748b]">승인 버튼 미노출 · 권한, 상태, 선행 단계, 범위 유효성, 신선도, 안전 조건을 모두 충족해야 합니다.</div>}<p className="mt-3 text-[10px] text-[#94a3b8]">감사 이력 {snapshot?.auditHistory.length ?? 0}건 · 외부 실행 항상 꺼짐</p></aside>;
}

function ApprovalGroups({ snapshot }: { snapshot: MarketingWarRoomSnapshot | null }) { return <section className="mt-3 grid gap-2 md:grid-cols-3">{snapshot?.approvalGroups.map((gate) => <div key={gate.gateId} className="rounded-[9px] border border-[#dbe2ea] bg-white px-3 py-3"><div className="flex items-center justify-between gap-2"><p className="font-mono text-[11px] font-semibold text-[#334155]">{gate.gateId}</p><StatusBadge status={gate.status} /></div><p className="mt-1 text-[11px] text-[#64748b]">{gate.scope} · {gate.version}</p></div>) ?? [0, 1, 2].map((key) => <div key={key} className="h-[66px] animate-pulse rounded-[9px] bg-[#e8ecea]" />)}</section>; }
function MarketingPlanCard({ snapshot }: { snapshot: MarketingWarRoomSnapshot | null }) { const plan = snapshot?.plans[0]; if (!plan) return null; const fields = [["가설", plan.hypothesis], ["대상", plan.icp], ["핵심 메시지", plan.message], ["체험 제안", plan.offer], ["유입 채널", plan.channel], ["핵심 지표", plan.primaryKpi], ["퍼널 집계 기준", plan.funnelUnits], ["현재 판단", "학습 전용 · 결론 유보"], ["담당", plan.owner], ["다음 행동", plan.nextAction]]; return <section className="mt-3 rounded-[10px] border border-[#ddd6fe] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-[#7c3aed]">마케팅 계획 · 읽기 전용</p><h2 className="mt-1 text-[16px] font-semibold text-[#172033]">{plan.title}</h2><p className="mt-1 font-mono text-[10px] text-[#94a3b8]">{plan.workId} · R1</p></div><div className="flex gap-1.5"><StatusBadge status={plan.status} /><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">분석 계약 {plan.analysisContractReview}</span><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">대표 승인 {plan.representativeApproval}</span></div></div><dl className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2 xl:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="rounded-[7px] bg-[#f8fafc] px-3 py-2"><dt className="text-[10px] text-[#94a3b8]">{label}</dt><dd className="mt-0.5 text-[11px] leading-5 text-[#334155]">{value}</dd></div>)}</dl><p className="mt-3 text-[10px] text-[#b98121]">승인 필요 · 분석팀 최종 확인 전에는 검토 중이며 승인 버튼과 외부 실행이 비활성입니다.</p></section>; }
function SafetyBanner({ violations }: { violations: MarketingWarRoomNode[] }) { return <div className={`mt-3 rounded-[9px] border px-4 py-3 ${violations.length ? "border-[#d8aab3] bg-[#fff4f5] text-[#a04455]" : "border-[#cfe3dc] bg-[#f5faf8] text-[#1f6b5b]"}`}><div className="flex items-center gap-2 text-[12px] font-semibold"><ShieldCheck className="h-4 w-4" />{violations.length ? `안전 위반 ${violations.length}건 — 승인 잠금` : "안전 경계 정상 · 실제 실행 도구 없음"}</div><p className="mt-1 text-[11px] opacity-80">execution_enabled=false · external_execution=false</p></div>; }
function StatusBadge({ status }: { status: MarketingNodeStatus }) { const tone = status === "completed" || status === "approved" ? "bg-[#e9f7ef] text-[#1f9d55]" : status === "blocked" || status === "rejected" ? "bg-[#faecef] text-[#a04455]" : status === "approval_waiting" || status === "review" ? "bg-[#fff6e8] text-[#b98121]" : status === "in_progress" ? "bg-[#eaf1ff] text-[#2563eb]" : "bg-[#f1f5f9] text-[#64748b]"; return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{STATUS_LABELS[status]}</span>; }
function DecisionButton({ icon: Icon, label, disabled, onClick }: { icon: typeof Check; label: string; disabled: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className="inline-flex h-9 items-center justify-center gap-1 rounded-[7px] border border-[#dbe2ea] bg-white text-[11px] font-semibold text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"><Icon className="h-3.5 w-3.5" />{label}</button>; }
function nullable(value: string | null, fallback: string) { return value?.trim() ? value : fallback; }
function freshnessLabel(value: MarketingWarRoomNode["freshness"]) { return ({ fresh: "연결됨 · 최신", stale: "오래됨", source_unavailable: "소스 사용 불가", unconnected: "미연결", calculation_pending: "산정 대기" } as const)[value]; }
