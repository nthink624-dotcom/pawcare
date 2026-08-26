"use client";

import { AlertTriangle, ArrowLeft, Check, ChevronDown, LockKeyhole, Pause, RotateCcw, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import { resolveMarketingWorkSelection } from "@/lib/marketing-war-room-contract";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import type { MarketingAgentStatus } from "@/types/marketing-agent";
import type { MarketingKpiSnapshot } from "@/types/marketing-kpi";
import type { MarketingApprovalDecision, MarketingArtifact, MarketingNodeStatus, MarketingWarRoomNode, MarketingWarRoomSnapshot } from "@/types/marketing-war-room";

const STATUS_LABELS: Record<MarketingNodeStatus, string> = { not_started: "시작 전", in_progress: "진행 중", blocked: "막힘", review: "검토 중", approval_waiting: "승인 대기", approved: "승인됨", rejected: "거절", completed: "완료" };
const FILTERS = ["전체", "성장팀", "분석팀", "승인 대기", "막힘"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminMarketingWarRoom({ sessionLoginId, representative }: { sessionLoginId: string; representative: boolean }) {
  const [snapshot, setSnapshot] = useState<MarketingWarRoomSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("SOURCING_APPROVAL");
  const [filter, setFilter] = useState<Filter>("전체");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState<MarketingAgentStatus | null>(null);
  const [kpis, setKpis] = useState<MarketingKpiSnapshot | null>(null);
  const [agentConnectionFailed, setAgentConnectionFailed] = useState(false);
  const [kpiConnectionFailed, setKpiConnectionFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const searchParams = useSearchParams();
  const load = useCallback(async () => {
    try {
      const [roomResult, agentResult, kpiResult] = await Promise.allSettled([
        fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { cache: "no-store" }),
        fetchApiJson<MarketingAgentStatus>("/api/admin/marketing/status", { cache: "no-store" }),
        fetchApiJson<MarketingKpiSnapshot>("/api/admin/marketing/kpis?days=7", { cache: "no-store" }),
      ]);
      if (roomResult.status === "fulfilled") setSnapshot(roomResult.value);
      if (agentResult.status === "fulfilled") { setAgentStatus(agentResult.value); setAgentConnectionFailed(false); }
      else { setAgentStatus(null); setAgentConnectionFailed(true); }
      if (kpiResult.status === "fulfilled") { setKpis(kpiResult.value); setKpiConnectionFailed(false); }
      else { setKpis(null); setKpiConnectionFailed(true); }
      if (roomResult.status === "rejected") throw roomResult.reason;
      setError(null);
    }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "워크룸 상태를 확인하지 못했습니다."); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    const work = searchParams.get("work");
    if (work && snapshot) { const resolved = resolveMarketingWorkSelection(snapshot, work); if (resolved) { setSelectedId(resolved); setShowDetails(true); } }
    const view = searchParams.get("view");
    if (view === "approval") { setFilter("승인 대기"); setShowDetails(true); }
    else if (view === "blocked") { setFilter("막힘"); setShowDetails(true); }
    else if (!work) setShowDetails(false);
  }, [searchParams, snapshot]);

  const visibleNodes = useMemo(() => (snapshot?.nodes ?? []).filter((node) => {
    if (filter === "전체") return true;
    if (filter === "승인 대기") return node.status === "approval_waiting";
    if (filter === "막힘") return node.status === "blocked" || node.status === "rejected" || Boolean(node.safetyViolation);
    return node.team === filter;
  }), [filter, snapshot]);
  const selected = snapshot?.nodes.find((node) => node.id === selectedId) ?? visibleNodes[0] ?? null;
  const selectedTeamWork = selectedId.startsWith("team:") ? snapshot?.teamWorkItems.find((item) => item.workId === selectedId.slice(5)) ?? null : null;

  async function decide(decision: MarketingApprovalDecision) {
    if (!selected?.approvalActionVisible || busy) return;
    setBusy(true);
    try {
      setSnapshot(await fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gateId: selected.id, decision }) }));
      setError(null);
    } catch (decisionError) { setError(decisionError instanceof Error ? decisionError.message : "결정을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <main className={ADMIN_SURFACE}><div className="mx-auto w-full max-w-[1480px]">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><p className={`${T.badge} font-semibold text-[#1f6b5b]`}>마케팅 운영 관제</p><span className={`${T.badge} rounded-full border border-[#cfe3dc] bg-white px-3 py-1 font-semibold text-[#1f6b5b]`}>FAIL-CLOSED</span></div><h1 className={`${T.pageTitle} mt-1 font-bold text-[#0f172a]`}>마케팅 워크룸</h1><p className={`${T.body} mt-2 text-[#64748b]`}>{sessionLoginId} · {representative ? "대표 권한" : "조회 권한"}</p></div><Link href="/admin" className={`${T.button} inline-flex items-center gap-2 rounded-xl border border-[#dbe2ea] bg-white px-4 font-semibold text-[#334155]`}><ArrowLeft className="h-5 w-5" />관리자 홈</Link></header>
    {error ? <div className={`${T.secondary} mt-3 flex items-center gap-2 rounded-lg border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[#a04455]`}><AlertTriangle className="h-4 w-4" />{error}</div> : null}
    <RepresentativeFlow showDetails={showDetails} onToggleDetails={() => setShowDetails((value) => !value)} />
    {showDetails ? <><SafetyBanner violations={snapshot?.nodes.filter((node) => node.safetyViolation) ?? []} />
      <LiveConnectionBar agent={agentStatus} kpis={kpis} agentConnectionFailed={agentConnectionFailed} kpiConnectionFailed={kpiConnectionFailed} />
      <TeamLanes snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} />
      <ApprovalGroups snapshot={snapshot} />
      <MarketingPlanCard snapshot={snapshot} />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="보기 필터">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`${T.badge} min-h-11 shrink-0 rounded-full border px-4 font-semibold ${filter === item ? "border-[#1f6b5b] bg-[#1f6b5b] text-white" : "border-[#dbe2ea] bg-white text-[#607080]"}`}>{item}</button>)}</div>
      <section className="mt-3 grid min-h-[620px] gap-3 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="overflow-x-auto rounded-[12px] border border-[#dfe6e3] bg-[#eef2f0] p-4"><div className="grid min-w-[280px] gap-3 md:min-w-[900px] md:grid-cols-4">{visibleNodes.map((node, index) => <div key={node.id} className="relative">{index > 0 ? <span className="absolute -left-3 top-1/2 hidden h-px w-3 bg-[#94a3b8] md:block" aria-hidden /> : null}<WorkflowCard node={node} selected={!selectedTeamWork && selected?.id === node.id} onSelect={() => setSelectedId(node.id)} /></div>)}</div>{!visibleNodes.length ? <p className={`${T.secondary} py-20 text-center text-[#64748b]`}>이 보기에 해당하는 단계가 없습니다.</p> : null}</div>{selectedTeamWork ? <TeamWorkDetail item={selectedTeamWork} /> : <DetailPanel node={selected} snapshot={snapshot} busy={busy} onDecision={decide} />}</section>
    </> : null}
  </div></main>;
}

function RepresentativeFlow({ showDetails, onToggleDetails }: { showDetails: boolean; onToggleDetails: () => void }) {
  const steps = ["기획", "검토", "대표 승인", "제작", "배포·실행", "결과 확인"];
  return <section className="mt-5 overflow-hidden rounded-xl border border-[#d7dfdb] bg-white" aria-labelledby="representative-flow-title"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e9e6] bg-[#f8faf9] px-5 py-4"><div><h2 id="representative-flow-title" className={`${T.sectionTitle} font-bold text-[#172033]`}>전체 흐름</h2><p className={`${T.secondary} mt-1 text-[#64748b]`}>현재 · 신청 페이지 제작 준비</p></div><button type="button" onClick={onToggleDetails} aria-expanded={showDetails} className={`${T.button} inline-flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-4 font-bold text-[#334155]`}>세부 단계 보기<ChevronDown className={`h-5 w-5 transition-transform ${showDetails ? "rotate-180" : ""}`} /></button></div><ol className="grid gap-2 p-4 sm:grid-cols-3 xl:grid-cols-6">{steps.map((step, index) => { const current = step === "제작"; const complete = index < 3; return <li key={step} className={`relative flex min-h-[72px] items-center justify-center rounded-lg border px-3 text-center ${current ? "border-[#2563eb] bg-[#eaf1ff] text-[#1d4ed8]" : complete ? "border-[#b8d4ca] bg-[#f2faf7] text-[#1f6b5b]" : "border-[#dbe2ea] bg-white text-[#64748b]"}`}><span className={`${T.body} font-bold`}>{step}</span>{current ? <span className={`${T.badge} absolute right-2 top-2 rounded-full bg-[#2563eb] px-2 py-0.5 font-bold text-white`}>현재</span> : null}</li>; })}</ol></section>;
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

function LiveConnectionBar({ agent, kpis, agentConnectionFailed, kpiConnectionFailed }: { agent: MarketingAgentStatus | null; kpis: MarketingKpiSnapshot | null; agentConnectionFailed: boolean; kpiConnectionFailed: boolean }) {
  return <section className="mt-5 grid gap-3 md:grid-cols-3"><ConnectionCard label="Mastra 3단계 POC" value={agentConnectionFailed ? "연결 실패" : agent?.studio.connected ? "POC API 연결" : agent?.studio.reachable ? "Cloud 도달 · POC API 미연결" : "미연결"} detail="POC · 실제 팀 상태 미연결" /><ConnectionCard label="운영 KPI · 실제 API 자동 새로고침" value={kpiConnectionFailed ? "연결 실패" : kpis?.availability === "ready" ? "측정 연결됨" : kpis?.availability === "partial" ? "일부 측정 불가" : "미측정"} detail={kpiConnectionFailed ? "이전 값을 폐기했습니다" : kpis?.checkedAt ? `자동 새로고침 · ${formatTime(kpis.checkedAt)}` : "KPI API 집계 대기"} /><ConnectionCard label="팀 업무 원장 · 수동 동기화" value="수동 동기화" detail="20:30 KST 기준 · 실시간 원장 DB 적용 전" /></section>;
}

function ConnectionCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border border-[#dbe2ea] bg-white p-4"><p className={`${T.secondary} font-semibold text-[#64748b]`}>{label}</p><p className={`${T.cardTitle} mt-1 font-bold text-[#172033]`}>{value}</p><p className={`${T.secondary} mt-1 text-[#64748b]`}>{detail}</p></div>; }

function TeamLanes({ snapshot, selectedId, onSelect }: { snapshot: MarketingWarRoomSnapshot | null; selectedId: string; onSelect: (id: string) => void }) {
  if (!snapshot) return <div className={`${T.body} mt-4 rounded-xl border border-dashed border-[#cbd5e1] bg-white p-5 text-[#64748b]`}>팀 업무 원장 집계 대기</div>;
  return <section className="mt-5 space-y-4"><div><h2 className={`${T.sectionTitle} font-bold text-[#111827]`}>팀별 현재 업무</h2><p className={`${T.body} mt-1 text-[#64748b]`}>성과 백분율 없이 단계·완료·막힘·다음 행동만 표시합니다.</p></div>{["펫매니저 성장팀", "펫매니저 마케팅 분석팀", "펫매니저 운영팀"].map((team) => <div key={team} className="rounded-2xl border border-[#dbe2ea] bg-[#f8fafc] p-4"><h3 className={`${T.cardTitle} font-bold text-[#334155]`}>{team}</h3><div className="mt-3 grid gap-3 xl:grid-cols-2">{snapshot.teamWorkItems.filter((item) => item.team === team).map((item, index) => { const selected = selectedId === `team:${item.workId}`; return <button type="button" key={item.workId} onClick={() => onSelect(`team:${item.workId}`)} className={`rounded-xl border bg-white p-5 text-left ${selected ? "border-[#1f6b5b] ring-2 ring-[#cfe3dc]" : "border-[#dbe2ea]"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className={`${T.secondary} font-mono text-[#64748b]`}>{item.workId}</p><h4 className={`${T.cardTitle} mt-1 font-bold text-[#172033]`}>{item.title}</h4></div><div className="flex gap-2">{index === 0 ? <span className={`${T.badge} rounded-full bg-[#2563eb] px-3 py-1 font-bold text-white`}>현재</span> : null}{selected ? <span className={`${T.badge} rounded-full bg-[#e7f2ee] px-3 py-1 font-bold text-[#1f6b5b]`}>선택됨</span> : null}</div></div><p className={`${T.body} mt-3 font-semibold text-[#2563eb]`}>{item.stageLabel}</p><div className={`${T.secondary} mt-4 grid gap-2`}><p><strong>완료:</strong> {item.completedSummary}</p><p><strong>막힘:</strong> {item.blocker}</p><p><strong>다음:</strong> {item.nextAction}</p><p><strong>기한:</strong> {item.dueLabel}</p><p className="text-[#64748b]">{formatTime(item.sourceUpdatedAt)} 기준 · 수동 동기화 · {item.measurementState === "not_measured" ? "미측정" : "측정 대상 아님"}</p></div></button>; })}</div></div>)}</section>;
}

function TeamWorkDetail({ item }: { item: MarketingWarRoomSnapshot["teamWorkItems"][number] }) { const rows = [["작업명", item.title], ["담당", item.team], ["상태", STATUS_LABELS[item.status]], ["현재 단계", item.stageLabel], ["완료 내용", item.completedSummary], ["막힘", item.blocker], ["다음 행동", item.nextAction], ["기한", item.dueLabel], ["work_id", item.workId], ["승인 필요", item.approvalRequired ? "필요" : "불필요"], ["데이터 최신 시각", `${formatTime(item.sourceUpdatedAt)} 기준`], ["연결 상태", "수동 동기화 · 실시간 자동 연결 아님"]]; return <aside className="rounded-xl border border-[#1f6b5b] bg-white p-5 xl:sticky xl:top-4 xl:h-fit"><p className={`${T.badge} font-semibold text-[#1f6b5b]`}>선택된 팀 업무 상세</p><h2 className={`${T.cardTitle} mt-2 font-bold`}>{item.title}</h2><dl className="mt-4 divide-y divide-[#eef2f5]">{rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[112px_1fr]"><dt className={`${T.secondary} text-[#64748b]`}>{label}</dt><dd className={`${T.body} break-words text-[#334155]`}>{value}</dd></div>)}</dl><ArtifactSection artifact={item.artifact} /><p className={`${T.secondary} mt-4 rounded-lg bg-[#f8fafc] p-3 text-[#64748b]`}>읽기 전용 · 외부 실행 항상 꺼짐</p></aside>; }

function ArtifactSection({ artifact }: { artifact: MarketingArtifact }) {
  return <section className="mt-5 border-t border-[#e2e8f0] pt-4"><div className="flex items-center justify-between gap-3"><h3 className={`${T.cardTitle} font-bold text-[#172033]`}>디자인·결과물</h3><span className={`${T.badge} rounded-full bg-[#f1f5f9] px-3 py-1 font-bold text-[#64748b]`}>{artifact.reviewStatus}</span></div>{artifact.artifactType === "none" || !artifact.artifactTitle ? <p className={`${T.body} mt-3 text-[#64748b]`}>디자인 미제출</p> : <div className="mt-3 rounded-xl border border-[#dbe2ea] bg-[#f8fafc] p-4">{artifact.thumbnailUrl ? <Image src={artifact.thumbnailUrl} alt={`${artifact.artifactTitle} 비식별 미리보기`} width={640} height={360} className="mb-3 aspect-video w-full rounded-lg border border-[#dbe2ea] object-cover object-top" /> : null}<p className={`${T.body} font-bold text-[#334155]`}>{artifact.artifactTitle}</p><p className={`${T.secondary} mt-1 text-[#64748b]`}>{artifact.version ?? "버전 미입력"} · {artifact.updatedAt ? formatTime(artifact.updatedAt) : "갱신 시각 미입력"}</p>{artifact.previewUrl ? <Link href={artifact.previewUrl as never} target="_blank" rel="noreferrer" className={`${T.button} mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#1f6b5b] px-4 font-bold text-white`}>미리보기 열기</Link> : <p className={`${T.secondary} mt-3 font-semibold text-[#b98121]`}>안전한 Preview 링크 준비 중</p>}</div>}</section>;
}

function ApprovalGroups({ snapshot }: { snapshot: MarketingWarRoomSnapshot | null }) { return <section className="mt-3 grid gap-2 md:grid-cols-3">{snapshot?.approvalGroups.map((gate) => <div key={gate.gateId} className="rounded-[9px] border border-[#dbe2ea] bg-white px-3 py-3"><div className="flex items-center justify-between gap-2"><p className="font-mono text-[11px] font-semibold text-[#334155]">{gate.gateId}</p><StatusBadge status={gate.status} /></div><p className="mt-1 text-[11px] text-[#64748b]">{gate.scope} · {gate.version}</p></div>) ?? [0, 1, 2].map((key) => <div key={key} className="h-[66px] animate-pulse rounded-[9px] bg-[#e8ecea]" />)}</section>; }
function MarketingPlanCard({ snapshot }: { snapshot: MarketingWarRoomSnapshot | null }) { const plan = snapshot?.plans[0]; if (!plan) return null; const fields = [["가설", plan.hypothesis], ["대상", plan.icp], ["핵심 메시지", plan.message], ["체험 제안", plan.offer], ["유입 채널", plan.channel], ["핵심 지표", plan.primaryKpi], ["퍼널 집계 기준", plan.funnelUnits], ["현재 판단", "학습 전용 · 결론 유보"], ["담당", plan.owner], ["다음 행동", plan.nextAction]]; return <section className="mt-3 rounded-[10px] border border-[#ddd6fe] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-[#7c3aed]">마케팅 계획 · 읽기 전용</p><h2 className="mt-1 text-[16px] font-semibold text-[#172033]">{plan.title}</h2><p className="mt-1 font-mono text-[10px] text-[#94a3b8]">{plan.workId} · R1</p></div><div className="flex gap-1.5"><StatusBadge status={plan.status} /><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">분석 계약 {plan.analysisContractReview}</span><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">대표 승인 {plan.representativeApproval}</span></div></div><dl className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2 xl:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="rounded-[7px] bg-[#f8fafc] px-3 py-2"><dt className="text-[10px] text-[#94a3b8]">{label}</dt><dd className="mt-0.5 text-[11px] leading-5 text-[#334155]">{value}</dd></div>)}</dl><p className="mt-3 text-[10px] text-[#b98121]">승인 필요 · 분석팀 최종 확인 전에는 검토 중이며 승인 버튼과 외부 실행이 비활성입니다.</p></section>; }
function SafetyBanner({ violations }: { violations: MarketingWarRoomNode[] }) { return <div className={`mt-3 rounded-[9px] border px-4 py-3 ${violations.length ? "border-[#d8aab3] bg-[#fff4f5] text-[#a04455]" : "border-[#cfe3dc] bg-[#f5faf8] text-[#1f6b5b]"}`}><div className="flex items-center gap-2 text-[12px] font-semibold"><ShieldCheck className="h-4 w-4" />{violations.length ? `안전 위반 ${violations.length}건 · 승인 잠금` : "외부 실행 꺼짐"}</div></div>; }
function StatusBadge({ status }: { status: MarketingNodeStatus }) { const tone = status === "completed" || status === "approved" ? "bg-[#e9f7ef] text-[#1f9d55]" : status === "blocked" || status === "rejected" ? "bg-[#faecef] text-[#a04455]" : status === "approval_waiting" || status === "review" ? "bg-[#fff6e8] text-[#b98121]" : status === "in_progress" ? "bg-[#eaf1ff] text-[#2563eb]" : "bg-[#f1f5f9] text-[#64748b]"; return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{STATUS_LABELS[status]}</span>; }
function DecisionButton({ icon: Icon, label, disabled, onClick }: { icon: typeof Check; label: string; disabled: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className="inline-flex h-9 items-center justify-center gap-1 rounded-[7px] border border-[#dbe2ea] bg-white text-[11px] font-semibold text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"><Icon className="h-3.5 w-3.5" />{label}</button>; }
function nullable(value: string | null, fallback: string) { return value?.trim() ? value : fallback; }
function freshnessLabel(value: MarketingWarRoomNode["freshness"]) { return ({ fresh: "연결됨 · 최신", stale: "오래됨", source_unavailable: "소스 사용 불가", unconnected: "미연결", calculation_pending: "산정 대기" } as const)[value]; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "갱신 시각 미확인" : new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul", hour12: false }).format(date); }
