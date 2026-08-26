import type {
  MarketingApprovalDecision,
  MarketingApprovalGateId,
  MarketingAuditEntry,
  MarketingNodeStatus,
  MarketingTeam,
  MarketingWarRoomNode,
  MarketingWarRoomSnapshot,
} from "@/types/marketing-war-room";

type NodeDefinition = Omit<
  MarketingWarRoomNode,
  "prerequisitesSatisfied" | "actionEnabled" | "approvalActionVisible"
>;

const GATE_IDS = new Set<MarketingApprovalGateId>([
  "SOURCING_APPROVAL",
  "TARGET_LIST_APPROVAL",
  "OUTREACH_APPROVAL",
]);

const DEFINITIONS: NodeDefinition[] = [
  node("SOURCING_APPROVAL", "소싱 기준 승인", "안전한 후보 탐색 기준을 확정합니다.", "운영팀", "approval_waiting", [], { scope: "sourcing_criteria_only", version: "v1" }),
  node("target_sourced", "후보군 탐색", "승인된 기준으로 후보 세그먼트 존재 여부만 확인합니다.", "성장팀", "not_started", ["SOURCING_APPROVAL"]),
  node("target_qualified", "후보 적합성 검토", "집계 세그먼트의 적합성을 검토합니다.", "분석팀", "not_started", ["target_sourced"]),
  node("TARGET_LIST_APPROVAL", "타깃 목록 승인", "비식별 타깃 범위의 준비 여부를 승인합니다.", "운영팀", "not_started", ["target_qualified"], { scope: "qualified_segments_only", version: "v1" }),
  node("OUTREACH_APPROVAL", "아웃리치 준비 승인", "연락 실행 없이 준비 큐 범위만 승인합니다.", "운영팀", "not_started", ["TARGET_LIST_APPROVAL"], { scope: "prepare_queue_only", version: "v1" }),
  node("outreach_attempted", "연락 시도 확인", "별도 실행 영수증이 있는 경우에만 시도 결과를 집계합니다.", "성장팀", "not_started", ["OUTREACH_APPROVAL"]),
  node("delivery", "전달 상태", "전달 여부를 비식별 집계로 확인합니다.", "성장팀", "not_started", ["outreach_attempted"]),
  node("response", "응답 상태", "응답 흐름을 집계 수준에서 확인합니다.", "성장팀", "not_started", ["delivery"]),
  node("trial", "체험 전환", "체험 진입 상태를 확인합니다.", "성장팀", "not_started", ["response"]),
  node("signup", "가입 전환", "가입 완료 집계를 확인합니다.", "분석팀", "not_started", ["trial"]),
  node("activation", "활성화", "첫 유효 예약 기반 활성화를 확인합니다.", "분석팀", "not_started", ["signup"]),
  node("analysis", "성과 분석", "완결 구간의 성과와 측정 한계를 정리합니다.", "분석팀", "not_started", ["activation"]),
];

function node(
  id: string,
  title: string,
  purpose: string,
  team: MarketingTeam,
  status: MarketingNodeStatus,
  prerequisites: string[],
  approval?: { scope: string; version: string },
): NodeDefinition {
  return {
    id,
    workId: `MW-${id.replaceAll("_", "-")}`,
    title,
    purpose,
    team,
    status,
    progressLabel: status === "approval_waiting" ? "대표 결정 대기" : "선행 단계 대기",
    dueAt: null,
    completedSummary: null,
    blocker: prerequisites.length ? "선행 단계 대기" : null,
    nextAction: status === "approval_waiting" ? "대표가 안전 범위를 검토합니다." : "선행 단계 완료 후 상태를 갱신합니다.",
    approvalRequired: Boolean(approval),
    approvalScope: approval?.scope ?? null,
    approvalVersion: approval?.version ?? null,
    scopeValidation: approval ? "valid" : "not_applicable",
    lastUpdatedAt: null,
    freshness: "unconnected",
    safetyViolation: null,
    prerequisites,
    executionEnabled: false,
    externalExecution: false,
  };
}

function prerequisiteIsSatisfied(status: MarketingNodeStatus) {
  return status === "approved" || status === "completed";
}

export function buildMarketingWarRoomSnapshot(input: {
  representative: boolean;
  statuses?: Partial<Record<string, MarketingNodeStatus>>;
  auditHistory?: MarketingAuditEntry[];
  safetyViolations?: Partial<Record<string, string>>;
  freshness?: Partial<Record<string, MarketingWarRoomNode["freshness"]>>;
  now?: string;
}): MarketingWarRoomSnapshot {
  const statuses = input.statuses ?? {};
  const resolvedStatuses = new Map(DEFINITIONS.map((item) => [item.id, statuses[item.id] ?? item.status]));
  const nodes = DEFINITIONS.map((definition) => {
    const status = resolvedStatuses.get(definition.id) ?? definition.status;
    const prerequisitesSatisfied = definition.prerequisites.every((id) =>
      prerequisiteIsSatisfied(resolvedStatuses.get(id) ?? "not_started"),
    );
    const safetyViolation = input.safetyViolations?.[definition.id] ?? null;
    const freshness = input.freshness?.[definition.id] ?? definition.freshness;
    const safeForApproval = !safetyViolation && freshness !== "stale" && freshness !== "source_unavailable";
    const executionReceiptMissing = definition.id === "outreach_attempted";
    const approvalActionVisible = Boolean(
      definition.approvalRequired &&
        status === "approval_waiting" &&
        input.representative &&
        prerequisitesSatisfied &&
        definition.scopeValidation === "valid" &&
        safeForApproval,
    );
    return {
      ...definition,
      status,
      progressLabel: !prerequisitesSatisfied
        ? "선행 단계 대기"
        : status === "approval_waiting"
          ? "대표 결정 대기"
          : definition.progressLabel,
      blocker: !prerequisitesSatisfied
        ? "선행 단계 대기"
        : executionReceiptMissing
          ? "별도 run-scoped execution receipt 필요"
          : safetyViolation ?? definition.blocker,
      freshness,
      safetyViolation,
      prerequisitesSatisfied,
      actionEnabled: prerequisitesSatisfied && safeForApproval && !executionReceiptMissing && status !== "blocked" && status !== "rejected",
      approvalActionVisible,
      executionEnabled: false as const,
      externalExecution: false as const,
    };
  });

  return {
    checkedAt: input.now ?? new Date().toISOString(),
    viewer: { representative: input.representative },
    executionEnabled: false,
    externalExecution: false,
    nodes: [...nodes].sort((a, b) => Number(Boolean(b.safetyViolation)) - Number(Boolean(a.safetyViolation))),
    approvalGroups: nodes.filter((item) => GATE_IDS.has(item.id as MarketingApprovalGateId)).map((item) => ({
      gateId: item.id as MarketingApprovalGateId,
      scope: item.approvalScope!,
      version: item.approvalVersion!,
      status: item.status,
    })),
    plans: [{
      workId: "PM-GROWTH-20260826-006",
      title: "1인 미용샵 10곳 14일 동행 체험 — Hero 메시지 탐색 R1",
      hypothesis: "고객 직접 예약 작동 방식을 명시하면 유효 Hero 노출 세션의 CTA 선택이 더 명확해질 것이라는 탐색 가설",
      icp: "전화·문자·DM 예약을 직접 처리하는 1인 반려동물 미용샵 오너",
      message: "미용 중 전화를 못 받아도 고객이 앱 설치 없이 직접 예약하고 정보가 한곳에 이어집니다.",
      offer: "카드 등록 없는 14일 동행 체험 + 기본 설정 지원, 운영 상한 10곳",
      channel: "Instagram inbound opt-in",
      primaryKpi: "유효 Hero 노출 세션 대비 CTA 클릭률",
      funnelUnits: "유입은 세션, 가입 이후는 매장 단위 · 연결 관계 미검증 및 분리",
      judgment: "LEARNING_ONLY | INCONCLUSIVE",
      status: "review",
      owner: "펫매니저 성장팀",
      nextAction: "분석팀 최종 계약 확인",
      approvalRequired: true,
      analysisContractReview: "검토 중",
      representativeApproval: "검토 전",
      approvalActionVisible: false,
      executionEnabled: false,
      externalExecution: false,
    }],
    auditHistory: input.auditHistory ?? [],
  };
}

export function applyMarketingDecision(input: {
  snapshot: MarketingWarRoomSnapshot;
  gateId: MarketingApprovalGateId;
  decision: MarketingApprovalDecision;
  now: string;
}) {
  const gate = input.snapshot.nodes.find((item) => item.id === input.gateId);
  if (!gate || !gate.approvalActionVisible || !gate.approvalScope || !gate.approvalVersion) {
    throw new Error("APPROVAL_NOT_ALLOWED");
  }
  const nextStatus: MarketingNodeStatus = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : "review";
  const audit: MarketingAuditEntry = {
    auditId: `AUD-${input.gateId}-${input.now}`,
    gateId: input.gateId,
    gateVersion: gate.approvalVersion,
    scope: gate.approvalScope,
    decision: input.decision,
    decidedBy: "대표",
    decidedAt: input.now,
  };
  return { nextStatus, audit, executionEnabled: false as const, externalExecution: false as const };
}
