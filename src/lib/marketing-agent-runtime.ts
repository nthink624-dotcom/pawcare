import type { MarketingWorkStatus, MarketingWorkSummary } from "@/types/marketing-agent";

const LOCAL_MASTRA_STUDIO_URL = "http://localhost:4111";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type MarketingEnvironment = {
  NODE_ENV?: string;
  MASTRA_MARKETING_URL?: string;
  MASTRA_MARKETING_STUDIO_URL?: string;
};

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

function normalizeMarketingUrl(candidate: string) {
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

export function resolveMarketingApiUrl(environment: MarketingEnvironment = process.env) {
  const configuredUrl = environment.MASTRA_MARKETING_URL?.trim();
  const candidate = configuredUrl || (environment.NODE_ENV === "development" ? LOCAL_MASTRA_STUDIO_URL : "");
  return normalizeMarketingUrl(candidate);
}

export function resolveMarketingStudioUrl(environment: MarketingEnvironment = process.env) {
  const configuredStudioUrl = environment.MASTRA_MARKETING_STUDIO_URL?.trim();
  if (configuredStudioUrl) return normalizeMarketingUrl(configuredStudioUrl);

  const apiUrl = resolveMarketingApiUrl(environment);
  if (!apiUrl || resolveMarketingDeployment(apiUrl) === "local") return apiUrl;

  try {
    const derivedStudioUrl = new URL(apiUrl);
    if (derivedStudioUrl.hostname.endsWith(".server.mastra.cloud")) {
      derivedStudioUrl.hostname = derivedStudioUrl.hostname.replace(
        /\.server\.mastra\.cloud$/,
        ".studio.mastra.cloud",
      );
      return derivedStudioUrl.toString().replace(/\/$/, "");
    }
  } catch {
    return null;
  }

  return apiUrl;
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
