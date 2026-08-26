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
    nextAction: "분석팀 최종 계약 확인";
    approvalRequired: true;
    analysisContractReview: "검토 중";
    representativeApproval: "검토 전";
    approvalActionVisible: false;
    executionEnabled: false;
    externalExecution: false;
  }>;
  auditHistory: MarketingAuditEntry[];
};
