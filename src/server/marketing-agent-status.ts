import "server-only";

import {
  parseWorkflowRuns,
  resolveMarketingDeployment,
  resolveMarketingStudioUrl,
} from "@/lib/marketing-agent-runtime";
import type { MarketingAgentStatus, MarketingWorkSummary } from "@/types/marketing-agent";

const LOCAL_PROBE_TIMEOUT_MS = 1_500;
const CLOUD_PROBE_TIMEOUT_MS = 6_000;
const MASTRA_WORKFLOW_RESOURCE_KEY = "petmanagerGrowthReviewWorkflow";

async function fetchWithTimeout(
  url: string,
  options: { authorization?: string; timeoutMs: number },
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",
      headers: options.authorization
        ? {
            Authorization: options.authorization,
          }
        : undefined,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveMarketingAuthorization(studioUrl: string) {
  const apiToken = process.env.MASTRA_MARKETING_API_TOKEN?.trim();
  const explicitlyConfiguredStudioUrl = resolveMarketingStudioUrl({
    NODE_ENV: "production",
    MASTRA_MARKETING_URL: process.env.MASTRA_MARKETING_URL,
  });

  if (
    !apiToken ||
    !explicitlyConfiguredStudioUrl ||
    explicitlyConfiguredStudioUrl !== studioUrl ||
    resolveMarketingDeployment(studioUrl) !== "cloud"
  ) {
    return undefined;
  }

  return `Bearer ${apiToken}`;
}

async function readStudioState(studioUrl: string) {
  const deployment = resolveMarketingDeployment(studioUrl);
  const requestOptions = {
    authorization: resolveMarketingAuthorization(studioUrl),
    timeoutMs: deployment === "cloud" ? CLOUD_PROBE_TIMEOUT_MS : LOCAL_PROBE_TIMEOUT_MS,
  };
  const runsUrl = `${studioUrl}/api/workflows/${MASTRA_WORKFLOW_RESOURCE_KEY}/runs?limit=20&offset=0`;
  const runsResponse = await fetchWithTimeout(runsUrl, requestOptions);

  if (runsResponse?.ok) {
    try {
      return {
        apiConnected: true,
        reachable: true,
        apiMessage: "Mastra 워크플로 API에 연결되었습니다.",
        runs: parseWorkflowRuns(await runsResponse.json()),
      };
    } catch {
      return {
        apiConnected: false,
        reachable: true,
        apiMessage: "Mastra 응답 형식을 확인해야 합니다.",
        runs: [] as MarketingWorkSummary[],
      };
    }
  }

  const studioResponse = await fetchWithTimeout(studioUrl, requestOptions);
  const reachable = Boolean(
    runsResponse ||
      (studioResponse &&
        (studioResponse.ok || (studioResponse.status >= 300 && studioResponse.status < 400))),
  );

  return {
    apiConnected: false,
    reachable,
    apiMessage:
      runsResponse?.status === 401 || runsResponse?.status === 403
        ? "Studio에는 도달했지만 워크플로 API 인증이 필요합니다."
        : reachable
          ? "Studio에는 도달했지만 워크플로 API를 확인하지 못했습니다."
          : "Mastra Studio에 연결하지 못했습니다.",
    runs: [] as MarketingWorkSummary[],
  };
}

export async function getMarketingAgentStatus(): Promise<MarketingAgentStatus> {
  const studioUrl = resolveMarketingStudioUrl();
  const deployment = resolveMarketingDeployment(studioUrl);
  const studioState = studioUrl
    ? await readStudioState(studioUrl)
    : {
        apiConnected: false,
        reachable: false,
        apiMessage: "Mastra 주소가 설정되지 않았습니다.",
        runs: [] as MarketingWorkSummary[],
      };
  const pendingRuns = studioState.runs.filter((run) => run.status === "suspended");
  const currentWork =
    pendingRuns[0] ?? studioState.runs.find((run) => run.status === "running") ?? studioState.runs[0] ?? null;

  return {
    checkedAt: new Date().toISOString(),
    mode:
      deployment === "cloud"
        ? "cloud-poc"
        : deployment === "local"
          ? "local-poc"
          : "unconfigured",
    studio: {
      configured: Boolean(studioUrl),
      connected: studioState.apiConnected,
      reachable: studioState.reachable,
      deployment,
      url: studioUrl,
      message: studioState.apiMessage,
    },
    workflow: {
      id: "petmanager-growth-review",
      label: "측정 신호 → Codex 검토 → 사람 승인",
      currentWork,
      pendingApprovals: pendingRuns.length,
      recentRunCount: studioState.runs.length,
    },
    codexBridge: {
      mode: "structured-manual-handoff",
      connected: false,
      packetReady: pendingRuns.length > 0,
      message: pendingRuns.length > 0
        ? "Codex 검토 패킷이 준비됐습니다. Codex 작업 간 자동 전송은 아직 연결 전입니다."
        : "워크플로가 Codex 검토 패킷을 만들지만 Codex 작업 간 자동 전송은 아직 연결 전입니다.",
    },
    ai: {
      keyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      executionEnabled: false,
    },
    externalActionsEnabled: false,
  };
}
