import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { CONTROL_PLANE_FIXTURE_EVENTS, projectControlPlaneEvents } from "../../src/lib/agent-control-plane.ts";

test("projects parent-child work and keeps all execution fail-closed", () => {
  const snapshot = projectControlPlaneEvents({ events: CONTROL_PLANE_FIXTURE_EVENTS, now: "2026-08-26T21:00:25+09:00" });
  assert.equal(snapshot.nodes.find((node) => node.workId === "CP-GROWTH-001")?.parentWorkId, "CP-OPS-001");
  assert.equal(snapshot.nodes.find((node) => node.workId === "CP-DESIGN-001")?.parentWorkId, "CP-OPS-001");
  assert.equal(snapshot.executionEnabled, false);
  assert.equal(snapshot.externalExecution, false);
  assert.equal(snapshot.mode, "demo");
  assert.equal(snapshot.sources.codex, "sync_limited");
  assert.equal(snapshot.sources.mastra, "poc_only");
});

test("deduplicates events and resolves out-of-order delivery by source time", () => {
  const duplicate = CONTROL_PLANE_FIXTURE_EVENTS[3];
  const reversed = [...CONTROL_PLANE_FIXTURE_EVENTS, duplicate].reverse();
  const snapshot = projectControlPlaneEvents({ events: reversed, now: "2026-08-26T21:00:25+09:00" });
  assert.equal(snapshot.timeline.length, CONTROL_PLANE_FIXTURE_EVENTS.length);
  assert.deepEqual(snapshot.timeline.map((event) => event.sequence), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(snapshot.nodes.find((node) => node.workId === "CP-OPS-001")?.status, "approval_waiting");
});

test("marks replayed old data stale and exposes no PII or raw thread id", () => {
  const snapshot = projectControlPlaneEvents({ events: CONTROL_PLANE_FIXTURE_EVENTS, now: "2026-08-26T22:00:00+09:00" });
  assert.ok(snapshot.nodes.every((node) => node.freshness === "stale"));
  assert.doesNotMatch(JSON.stringify(snapshot), /(?:01[016789][- ]?\d{3,4}[- ]?\d{4}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|appointment_id|payment_id|shop_id|user_id)/i);
});

test("preview API is admin protected, read-only, no-store, and does not mutate production", () => {
  const route = readFileSync(new URL("../../src/app/api/admin/marketing/control-plane-preview/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminSession/);
  assert.match(route, /NODE_ENV !== "development"/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /export async function POST|supabase|insert\(|update\(|upsert\(/i);
});

test("isolated visual route is development-only and production fail-closed", () => {
  const page = readFileSync(new URL("../../src/app/dev/agent-control-plane-preview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /NODE_ENV !== "development"/);
  assert.match(page, /notFound\(\)/);
});

test("operational read model is admin-only, operational-only, and keeps execution disabled", () => {
  const route = readFileSync(new URL("../../src/app/api/admin/marketing/control-plane/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminSession/);
  assert.match(route, /eq\("source_type", "operational"\)/);
  assert.match(route, /mode: "operational"/);
  assert.match(route, /externalExecution: false/);
  assert.doesNotMatch(route, /export async function POST/);
});

test("the real admin marketing entry defaults to the operational live model", () => {
  const page = readFileSync(new URL("../../src/app/admin/marketing/page.tsx", import.meta.url), "utf8");
  assert.match(page, /AgentControlPlanePreview mode="operational"/);
  assert.match(page, /view === "details"/);
  assert.doesNotMatch(page, /return <AdminMarketingWarRoom[^;]+;\s*}$/);
});

test("gateway uses stdio, authenticated outbound ingest, and never enables external execution", () => {
  const gateway = readFileSync(new URL("../../scripts/control-plane-gateway.mjs", import.meta.url), "utf8");
  assert.match(gateway, /spawn\("codex", \["app-server", "--stdio"\]/);
  assert.match(gateway, /MARKETING_WORK_EVENT_TOKEN/);
  assert.match(gateway, /sourceType: "operational"/);
  assert.match(gateway, /externalExecution: false/);
  assert.doesNotMatch(gateway, /listen\(|createServer\(|0\.0\.0\.0/);
});
