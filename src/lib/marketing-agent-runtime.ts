import type { MarketingWorkStatus, MarketingWorkSummary } from "@/types/marketing-agent";

const LOCAL_MASTRA_STUDIO_URL = "http://localhost:4111";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeRunStatus(value: unknown): MarketingWorkStatus {
  return value === "running" || value === "suspended" || value === "success" || value === "failed"
    ? value
    : "unknown";
}

export function resolveMarketingStudioUrl(
  environment: { NODE_ENV?: string; MASTRA_MARKETING_URL?: string } = process.env,
) {
  const configuredUrl = environment.MASTRA_MARKETING_URL?.trim();
  const candidate = configuredUrl || (environment.NODE_ENV === "development" ? LOCAL_MASTRA_STUDIO_URL : "");

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveMarketingDeployment(studioUrl: string | null) {
  if (!studioUrl) return "unconfigured" as const;

  try {
    const hostname = new URL(studioUrl).hostname;
    return isLoopbackHostname(hostname)
      ? ("local" as const)
      : ("cloud" as const);
  } catch {
    return "unconfigured" as const;
  }
}

export function parseWorkflowRuns(payload: unknown): MarketingWorkSummary[] {
  const root = asObject(payload);
  const runs = Array.isArray(root?.runs) ? root.runs : [];

  return runs.flatMap((value) => {
    const run = asObject(value);
    const snapshot = asObject(run?.snapshot);
    const context = asObject(snapshot?.context);
    const input = asObject(context?.input);
    const runId = typeof run?.runId === "string" ? run.runId : null;
    const workItemId = typeof input?.workItemId === "string" ? input.workItemId : null;
    const goal = typeof input?.goal === "string" ? input.goal : null;

    if (!runId || !workItemId || !goal) return [];

    return [{
      runId,
      workItemId,
      goal,
      status: normalizeRunStatus(snapshot?.status),
      lastChangedAt: typeof run?.updatedAt === "string" ? run.updatedAt : null,
    }];
  });
}
