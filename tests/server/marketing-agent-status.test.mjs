import assert from "node:assert/strict";
import test from "node:test";

import {
  parseWorkflowRuns,
  resolveMarketingDeployment,
  resolveMarketingStudioUrl,
} from "../../src/lib/marketing-agent-runtime.ts";

test("marketing Studio defaults to localhost only in development", () => {
  assert.equal(
    resolveMarketingStudioUrl({ NODE_ENV: "development" }),
    "http://localhost:4111",
  );
  assert.equal(resolveMarketingStudioUrl({ NODE_ENV: "production" }), null);
  assert.equal(
    resolveMarketingStudioUrl({
      NODE_ENV: "production",
      MASTRA_MARKETING_URL: "https://marketing-agent.example.com/",
    }),
    "https://marketing-agent.example.com",
  );
  assert.equal(
    resolveMarketingStudioUrl({
      NODE_ENV: "production",
      MASTRA_MARKETING_URL: "http://marketing-agent.example.com",
    }),
    null,
  );
  assert.equal(
    resolveMarketingStudioUrl({ NODE_ENV: "development", MASTRA_MARKETING_URL: "file:///tmp/mastra" }),
    null,
  );
});

test("marketing Studio deployment distinguishes local and cloud URLs", () => {
  assert.equal(resolveMarketingDeployment(null), "unconfigured");
  assert.equal(resolveMarketingDeployment("http://localhost:4111"), "local");
  assert.equal(resolveMarketingDeployment("http://127.0.0.1:4111"), "local");
  assert.equal(resolveMarketingDeployment("http://[::1]:4111"), "local");
  assert.equal(
    resolveMarketingDeployment("https://petmanager-marketing.mastra.cloud"),
    "cloud",
  );
});

test("a suspended Mastra run becomes one sanitized approval work item", () => {
  assert.deepEqual(
    parseWorkflowRuns({
      runs: [
        {
          runId: "run-001",
          snapshot: {
            status: "suspended",
            context: {
              input: {
                workItemId: "growth-001",
                goal: "가입 전환 측정 계약 검토",
                signalSummary: "이 값은 관리자 UI로 노출하지 않습니다.",
              },
            },
          },
          updatedAt: "2026-08-25T09:00:00.000Z",
        },
        { runId: "malformed-run", snapshot: { status: "running" } },
      ],
    }),
    [
      {
        runId: "run-001",
        workItemId: "growth-001",
        goal: "가입 전환 측정 계약 검토",
        status: "suspended",
        lastChangedAt: "2026-08-25T09:00:00.000Z",
      },
    ],
  );
});
