import type { ControlPlaneEvent, ControlPlaneNode, ControlPlaneSnapshot } from "@/types/agent-control-plane";

const STALE_AFTER_MS = 5 * 60 * 1000;

export function projectControlPlaneEvents(input: {
  events: ControlPlaneEvent[];
  now: string;
  cursor?: number;
  hasMore?: boolean;
}): ControlPlaneSnapshot {
  const unique = new Map<string, ControlPlaneEvent>();
  for (const event of input.events) {
    if (!unique.has(event.eventId)) unique.set(event.eventId, event);
  }
  const timeline = [...unique.values()].sort((a, b) => a.sequence - b.sequence || a.sourceEventAt.localeCompare(b.sourceEventAt));
  const latest = new Map<string, ControlPlaneEvent>();
  for (const event of timeline) {
    const previous = latest.get(event.workId);
    const eventRank = sourceRank(event.eventSource);
    const previousRank = sourceRank(previous?.eventSource);
    if (!previous || eventRank > previousRank || (eventRank === previousRank && (event.sourceEventAt > previous.sourceEventAt || (event.sourceEventAt === previous.sourceEventAt && event.sequence > previous.sequence)))) {
      latest.set(event.workId, event);
    }
  }
  const nowMs = Date.parse(input.now);
  const nodes: ControlPlaneNode[] = [...latest.values()].map((event) => ({
    workId: event.workId,
    parentWorkId: event.parentWorkId,
    source: event.source,
    sourceThreadRef: event.sourceThreadRef,
    role: event.role,
    status: event.status,
    title: event.title,
    originalDirectiveSummary: event.originalDirectiveSummary,
    operationsDirectiveSummary: event.operationsDirectiveSummary,
    completedSummary: event.completedSummary,
    blockerSummary: event.blockerSummary,
    nextAction: event.nextAction,
    approvalRequired: event.approvalRequired,
    artifact: event.artifact,
    category: event.category,
    detailRows: event.detailRows,
    eventSource: event.eventSource,
    sourceEventAt: event.sourceEventAt,
    lastEventId: event.eventId,
    freshness: Number.isFinite(nowMs) && nowMs - Date.parse(event.receivedAt) > STALE_AFTER_MS ? "stale" : "fresh",
  }));
  return {
    mode: "demo",
    checkedAt: input.now,
    cursor: input.cursor ?? timeline.at(-1)?.sequence ?? 0,
    hasMore: input.hasMore ?? false,
    sources: { codex: "sync_limited", mastra: "poc_only" },
    nodes,
    timeline,
    executionEnabled: false,
    externalExecution: false,
  };
}

function sourceRank(source: ControlPlaneEvent["eventSource"]) {
  return source === "codex_live" ? 4 : source === "local_snapshot" ? 3 : source === "manual" ? 2 : source === "fixture" ? 1 : 0;
}

export const CONTROL_PLANE_FIXTURE_EVENTS: ControlPlaneEvent[] = [
  event(1, "CP-OPS-001", null, "operations", "운영팀", "directive_created", "in_progress", "실시간 관제 구축", "대표 지시를 안전한 작업 계보로 정리", "성장팀과 디자인팀에 검수 가능한 작업을 배정", null, null, "하위 작업 수신 확인", false, null, "2026-08-26T21:00:00+09:00"),
  event(2, "CP-GROWTH-001", "CP-OPS-001", "mastra", "성장팀", "directive_received", "received", "캠페인 문안 정리", "대표 확정 문안으로 체험 페이지 준비", "확정 문안과 안전 잠금을 구현팀에 전달", null, null, "문안 패킷 작성", false, null, "2026-08-26T21:00:05+09:00"),
  event(3, "CP-DESIGN-001", "CP-OPS-001", "mastra", "디자인팀", "directive_received", "received", "체험 페이지 화면 검수", "PC·모바일에서 대표 문안을 확인", "비식별 Preview 화면을 검수", null, null, "화면 구성 시작", false, null, "2026-08-26T21:00:07+09:00"),
  event(4, "CP-GROWTH-001", "CP-OPS-001", "mastra", "성장팀", "status_changed", "in_progress", "캠페인 문안 정리", "대표 확정 문안으로 체험 페이지 준비", "확정 문안과 안전 잠금을 구현팀에 전달", "가격·CTA·선택 동의 문구 정리", null, "디자인팀에 문안 전달", false, null, "2026-08-26T21:00:12+09:00"),
  event(5, "CP-DESIGN-001", "CP-OPS-001", "codex", "디자인팀", "artifact_ready", "review", "체험 페이지 화면 검수", "PC·모바일에서 대표 문안을 확인", "비식별 Preview 화면을 검수", "PC·모바일 시안 준비", null, "운영팀 검수 요청", false, { title: "체험 페이지 Preview", url: "/campaign/solo-grooming-trial" }, "2026-08-26T21:00:18+09:00"),
  event(6, "CP-GROWTH-001", "CP-OPS-001", "mastra", "성장팀", "review_requested", "review", "캠페인 문안 정리", "대표 확정 문안으로 체험 페이지 준비", "확정 문안과 안전 잠금을 구현팀에 전달", "문안 전달 완료", null, "운영팀 최종 검수", false, null, "2026-08-26T21:00:20+09:00"),
  event(7, "CP-OPS-001", null, "operations", "운영팀", "approval_waiting", "approval_waiting", "실시간 관제 구축", "대표 지시를 안전한 작업 계보로 정리", "성장팀과 디자인팀에 검수 가능한 작업을 배정", "하위 작업 산출물 수신", null, "대표 Preview 확인", true, null, "2026-08-26T21:00:25+09:00"),
];

function event(sequence: number, workId: string, parentWorkId: string | null, source: ControlPlaneEvent["source"], role: ControlPlaneEvent["role"], eventType: ControlPlaneEvent["eventType"], status: ControlPlaneEvent["status"], title: string, originalDirectiveSummary: string, operationsDirectiveSummary: string, completedSummary: string | null, blockerSummary: string | null, nextAction: string, approvalRequired: boolean, artifact: ControlPlaneEvent["artifact"], sourceEventAt: string): ControlPlaneEvent {
  return { eventId: `CP-EVT-${sequence.toString().padStart(3, "0")}`, sequence, workId, parentWorkId, source, sourceThreadRef: source === "codex" ? "desktop-sync-limited" : null, role, eventType, status, title, originalDirectiveSummary, operationsDirectiveSummary, completedSummary, blockerSummary, nextAction, approvalRequired, artifact, sourceEventAt, receivedAt: sourceEventAt };
}
