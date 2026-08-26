export type ControlPlaneSource = "codex" | "mastra" | "operations" | "growth" | "analysis";
export type ControlPlaneStatus =
  | "not_started"
  | "received"
  | "in_progress"
  | "review"
  | "approval_waiting"
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
  role: "운영팀" | "성장팀" | "디자인팀" | "분석팀" | "구현팀";
  eventType: "directive_created" | "directive_received" | "status_changed" | "artifact_ready" | "review_requested" | "approval_waiting";
  status: ControlPlaneStatus;
  title: string;
  originalDirectiveSummary: string;
  operationsDirectiveSummary: string;
  completedSummary: string | null;
  blockerSummary: string | null;
  nextAction: string;
  approvalRequired: boolean;
  artifact: { title: string; url: string } | null;
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
