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
  node("SOURCING_APPROVAL", "소싱 기준 승인", "안전한 후보 탐색 기준을 확정합니다.", "운영팀", "not_started", [], { scope: "sourcing_criteria_only", version: "v1" }),
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
    artifact: { artifactType: "none", artifactTitle: null, thumbnailUrl: null, previewUrl: null, version: null, updatedAt: null, reviewStatus: "준비 중" },
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
      title: "1인 미용샵 체험 모집",
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
      nextAction: "전용 캠페인 페이지 Preview 확인",
      approvalRequired: true,
      analysisContractReview: "검토 완료",
      representativeApproval: "확정 완료",
      approvalActionVisible: false,
      executionEnabled: false,
      externalExecution: false,
    }],
    teamWorkItems: [
      {
        workId: "PM-GROWTH-20260826-006",
        title: "1인 미용샵 체험 모집",
        team: "펫매니저 성장팀",
        status: "review",
        stageLabel: "전용 캠페인 페이지 Preview 준비",
        completedSummary: "캠페인 기획, 타이틀·CTA·오퍼 확정, 측정·정책 계약 검토 완료",
        blocker: "Preview 검수 전 공개 불가",
        nextAction: "PC·모바일 Preview 확인",
        dueLabel: "Preview 검수 대기",
        sourceUpdatedAt: "2026-08-26T20:30:00+09:00",
        connectionState: "manual_sync",
        measurementState: "not_applicable",
        approvalRequired: true,
        artifact: { artifactType: "image", artifactTitle: "전용 체험 페이지", thumbnailUrl: "/previews/campaign-solo-grooming-trial-r2.png", previewUrl: "/previews/campaign-solo-grooming-trial-r2.png", version: "R2 Preview", updatedAt: "2026-08-26T18:30:00+09:00", reviewStatus: "검토 가능" },
      },
      {
        workId: "PM-GROWTH-20260826-006-ANALYSIS",
        title: "펫매니저 마케팅 계획 R1 분석 계약 검토",
        team: "펫매니저 마케팅 분석팀",
        status: "completed",
        stageLabel: "측정·정책 계약 검토 완료",
        completedSummary: "Hero 노출 세션 KPI, A/B·보호지표·관찰기간, 세션/매장 분리, 3개 승인 게이트 계약 적합 확인",
        blocker: "없음",
        nextAction: "완료 이력 보존",
        dueLabel: "검토 완료",
        sourceUpdatedAt: "2026-08-26T20:30:00+09:00",
        connectionState: "manual_sync",
        measurementState: "not_measured",
        approvalRequired: true,
        artifact: { artifactType: "none", artifactTitle: null, thumbnailUrl: null, previewUrl: null, version: null, updatedAt: null, reviewStatus: "준비 중" },
      },
      {
        workId: "PM-COMPETITOR-TEEPEE",
        title: "경쟁사 Teepee 분석",
        team: "펫매니저 마케팅 분석팀",
        status: "completed",
        stageLabel: "완료 보고서 링크 상태 확인",
        completedSummary: "비식별 완료 보고서 링크 상태만 확인 가능",
        blocker: "원시 문서 미연결",
        nextAction: "필요 시 안전한 요약본 연결",
        dueLabel: "완료",
        sourceUpdatedAt: "2026-08-26T15:48:13+09:00",
        connectionState: "manual_sync",
        measurementState: "not_applicable",
        approvalRequired: true,
        artifact: { artifactType: "document", artifactTitle: "Teepee 비식별 완료 보고서", thumbnailUrl: null, previewUrl: null, version: "R1", updatedAt: "2026-08-26T15:48:13+09:00", reviewStatus: "준비 중" },
      },
      {
        workId: "PM-ADMIN-HOME-R2", title: "관리자 홈 R2", team: "펫매니저 운영팀", status: "completed", stageLabel: "Preview 검증 완료",
        completedSummary: "관리자 운영 요약·큰 글씨·브랜드 홈 링크 Production 반영", blocker: "없음", nextAction: "배포 후 불편한 부분 점검", dueLabel: "배포 완료",
        sourceUpdatedAt: "2026-08-26T20:00:00+09:00", connectionState: "manual_sync", measurementState: "not_applicable", approvalRequired: true,
        artifact: { artifactType: "screen_preview", artifactTitle: "관리자 홈", thumbnailUrl: null, previewUrl: "/admin", version: "Production", updatedAt: "2026-08-26T20:00:00+09:00", reviewStatus: "확정" },
      },
      {
        workId: "PM-MOBILE-CONNECTION", title: "모바일 앱 연결", team: "펫매니저 운영팀", status: "completed", stageLabel: "운영 화면 연결 완료",
        completedSummary: "localhost 이동 제거·운영 HTTPS 모바일 화면·비식별 앱 데모 연결", blocker: "없음", nextAction: "실제 기기에서 화면 확인", dueLabel: "웹 배포 완료",
        sourceUpdatedAt: "2026-08-26T20:00:00+09:00", connectionState: "manual_sync", measurementState: "not_applicable", approvalRequired: true,
        artifact: { artifactType: "screen_preview", artifactTitle: "모바일 운영 데모", thumbnailUrl: null, previewUrl: "/demo/owner-mobile", version: "Production", updatedAt: "2026-08-26T20:00:00+09:00", reviewStatus: "확정" },
      },
      {
        workId: "PM-CALL-ID-P0", title: "CALL_ID P0", team: "펫매니저 운영팀", status: "review", stageLabel: "독립 POC 커밋 검토",
        completedSummary: "전화 접수·예약 초안·콜백·알림톡 미리보기 POC", blocker: "관리자 릴리스와 분리 · 실제 전화 미연결", nextAction: "독립 Preview 검수", dueLabel: "일정 미정",
        sourceUpdatedAt: "2026-08-26T18:00:00+09:00", connectionState: "manual_sync", measurementState: "not_applicable", approvalRequired: true,
        artifact: { artifactType: "image", artifactTitle: "CALL_ID P0", thumbnailUrl: "/previews/call-id-p0.png", previewUrl: "/previews/call-id-p0.png", version: "P0", updatedAt: "2026-08-26T18:00:00+09:00", reviewStatus: "검토 가능" },
      },
    ],
    pendingRepresentativeDecisions: [],
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

export function resolveMarketingWorkSelection(snapshot: MarketingWarRoomSnapshot, workId: string) {
  const node = snapshot.nodes.find((item) => item.workId === workId);
  if (node) return node.id;
  return snapshot.teamWorkItems.some((item) => item.workId === workId) ? `team:${workId}` : null;
}
