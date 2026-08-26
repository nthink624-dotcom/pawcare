export type MarketingNodeStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "review"
  | "approval_waiting"
  | "approved"
  | "rejected"
  | "completed";

export type MarketingTeam = "운영팀" | "분석팀" | "성장팀";
export type MarketingApprovalGateId =
  | "SOURCING_APPROVAL"
  | "TARGET_LIST_APPROVAL"
  | "OUTREACH_APPROVAL";

export type MarketingApprovalDecision = "approve" | "revise" | "hold" | "reject";
export type MarketingArtifact = {
  artifactType: "screen_preview" | "image" | "document" | "none";
  artifactTitle: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  version: string | null;
  updatedAt: string | null;
  reviewStatus: "준비 중" | "검토 가능" | "수정 필요" | "확정";
};

export type MarketingAuditEntry = {
  auditId: string;
  gateId: MarketingApprovalGateId;
  gateVersion: string;
  scope: string;
  decision: MarketingApprovalDecision;
  decidedBy: "대표";
  decidedAt: string;
};

export type MarketingWarRoomNode = {
  id: string;
  workId: string;
  title: string;
  purpose: string;
  team: MarketingTeam;
  status: MarketingNodeStatus;
  progressLabel: string;
  dueAt: string | null;
  completedSummary: string | null;
  blocker: string | null;
  nextAction: string;
  approvalRequired: boolean;
  approvalScope: string | null;
  approvalVersion: string | null;
  scopeValidation: "valid" | "invalid" | "not_applicable";
  lastUpdatedAt: string | null;
  freshness: "fresh" | "stale" | "source_unavailable" | "unconnected" | "calculation_pending";
  safetyViolation: string | null;
  prerequisites: string[];
  prerequisitesSatisfied: boolean;
  actionEnabled: boolean;
  approvalActionVisible: boolean;
  executionEnabled: false;
  externalExecution: false;
  artifact: MarketingArtifact;
};

export type MarketingWarRoomSnapshot = {
  checkedAt: string;
  viewer: { representative: boolean };
  executionEnabled: false;
  externalExecution: false;
  nodes: MarketingWarRoomNode[];
  approvalGroups: Array<{
    gateId: MarketingApprovalGateId;
    scope: string;
    version: string;
    status: MarketingNodeStatus;
  }>;
  plans: Array<{
    workId: string;
    title: string;
    hypothesis: string;
    icp: string;
    message: string;
    offer: string;
    channel: string;
    primaryKpi: string;
    funnelUnits: string;
    judgment: "LEARNING_ONLY | INCONCLUSIVE";
    status: "review";
    owner: "펫매니저 성장팀";
    nextAction: string;
    approvalRequired: true;
    analysisContractReview: "검토 완료";
    representativeApproval: "확정 완료";
    approvalActionVisible: false;
    executionEnabled: false;
    externalExecution: false;
  }>;
  teamWorkItems: Array<{
    workId: string;
    title: string;
    team: "펫매니저 성장팀" | "펫매니저 마케팅 분석팀" | "펫매니저 운영팀";
    status: "review" | "approval_waiting" | "completed";
    stageLabel: string;
    completedSummary: string;
    blocker: string;
    nextAction: string;
    dueLabel: string;
    sourceUpdatedAt: string;
    connectionState: "manual_sync";
    measurementState: "not_measured" | "not_applicable";
    approvalRequired: true;
    artifact: MarketingArtifact;
  }>;
  pendingRepresentativeDecisions: string[];
  auditHistory: MarketingAuditEntry[];
};
