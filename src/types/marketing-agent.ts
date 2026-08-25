export type MarketingWorkStatus = "running" | "suspended" | "success" | "failed" | "unknown";

export type MarketingWorkSummary = {
  runId: string;
  workItemId: string;
  goal: string;
  status: MarketingWorkStatus;
  lastChangedAt: string | null;
};

export type MarketingAgentStatus = {
  checkedAt: string;
  mode: "local-poc" | "cloud-poc" | "unconfigured";
  studio: {
    configured: boolean;
    connected: boolean;
    reachable: boolean;
    deployment: "local" | "cloud" | "unconfigured";
    url: string | null;
    message: string;
  };
  workflow: {
    id: "petmanager-growth-review";
    label: "측정 신호 → Codex 검토 → 사람 승인";
    currentWork: MarketingWorkSummary | null;
    pendingApprovals: number;
    recentRunCount: number;
  };
  codexBridge: {
    mode: "structured-manual-handoff";
    connected: false;
    packetReady: boolean;
    message: string;
  };
  ai: {
    keyConfigured: boolean;
    executionEnabled: false;
  };
  externalActionsEnabled: false;
};
