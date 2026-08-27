export type ControlPlaneSource = "codex" | "mastra" | "operations" | "growth" | "analysis";
export type ControlPlaneStatus =
  | "not_started"
  | "received"
  | "in_progress"
  | "review"
  | "approval_waiting"
  | "approved"
  | "rejected"
  | "completed"
  | "blocked"
  | "failed";

export type ControlPlaneEvent = {
  eventId: string;
  sequence: number;
  workId: string;
  parentWorkId: string | null;
  source: ControlPlaneSource;
  sourceThreadRef: string | null;
  role: "운영팀" | "보안팀" | "초기 세팅팀" | "성장팀" | "분석팀" | "마케팅 분석팀" | "경쟁사 분석팀" | "Android팀" | "디자인팀" | "UI 디자인팀" | "구현팀";
  eventType: "directive_created" | "directive_sent" | "directive_received" | "owner_request_received" | "operations_directive_sent" | "agent_work_started" | "agent_status_changed" | "agent_result_submitted" | "operations_reviewed" | "owner_approval_requested" | "owner_decided" | "status_changed" | "artifact_ready" | "review_requested" | "approval_waiting" | "request.received" | "instruction.dispatched" | "turn.started" | "progress.updated" | "task.completed" | "task.blocked" | "approval.waiting" | "next_action.assigned";
  status: ControlPlaneStatus;
  title: string;
  originalDirectiveSummary: string;
  operationsDirectiveSummary: string;
  completedSummary: string | null;
  blockerSummary: string | null;
  nextAction: string;
  approvalRequired: boolean;
  artifact: { title: string; url: string } | null;
  category?: "approval" | "team_progress" | "user_action";
  detailRows?: Array<{ label: string; value: string }>;
  eventSource?: "fixture" | "codex_live" | "local_snapshot" | "manual" | "unavailable";
  sourceEventAt: string;
  receivedAt: string;
};

export type ControlPlaneNode = Omit<ControlPlaneEvent, "eventId" | "sequence" | "eventType" | "receivedAt"> & {
  lastEventId: string;
  freshness: "fresh" | "stale" | "source_unavailable";
};

export type ControlPlaneSnapshot = {
  mode: "operational" | "demo";
  checkedAt: string;
  cursor: number;
  hasMore: boolean;
  sources: {
    codex: "sync_limited" | "connected" | "source_unavailable";
    mastra: "poc_only" | "connected" | "source_unavailable";
  };
  nodes: ControlPlaneNode[];
  timeline: ControlPlaneEvent[];
  executionEnabled: false;
  externalExecution: false;
};
