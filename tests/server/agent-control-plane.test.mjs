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

test("codex live state supersedes a later manual snapshot for the same work", () => {
  const manual = { ...CONTROL_PLANE_FIXTURE_EVENTS[0], eventId: "manual-later", workId: "same-work", sequence: 20, sourceEventAt: "2026-08-27T01:10:00+09:00", eventSource: "manual", status: "in_progress" };
  const live = { ...manual, eventId: "live-earlier", sequence: 10, sourceEventAt: "2026-08-27T01:03:00+09:00", eventSource: "codex_live", status: "completed" };
  const snapshot = projectControlPlaneEvents({ events: [live, manual], now: "2026-08-27T01:11:00+09:00" });
  assert.equal(snapshot.nodes[0]?.eventSource, "codex_live");
  assert.equal(snapshot.nodes[0]?.status, "completed");
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

test("the removed alternate-port visual route cannot become a production fallback", () => {
  const page = readFileSync(new URL("../../src/app/admin/marketing/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /\/dev\/agent-control-plane-preview|3015/);
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

test("operational UI polls runtime data within five seconds without fixture fallback", () => {
  const ui = readFileSync(new URL("../../src/components/admin/agent-control-plane-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /control-plane-preview\?cursor=/);
  assert.match(ui, /"\/api\/admin\/marketing\/control-plane"/);
  assert.match(ui, /3_000/);
  assert.match(ui, /연결 끊김/);
  assert.match(ui, /마지막 확인/);
  assert.match(ui, /연결 안 됨/);
  assert.match(ui, /일부 연결 · 자동 동기화 대기/);
  assert.doesNotMatch(ui, /Codex 기존 작업|Mastra ·/);
});

test("gateway uses stdio, authenticated outbound ingest, and never enables external execution", () => {
  const gateway = readFileSync(new URL("../../scripts/control-plane-gateway.mjs", import.meta.url), "utf8");
  assert.match(gateway, /spawn\("codex", \["app-server", "--stdio"\]/);
  assert.match(gateway, /MARKETING_WORK_EVENT_TOKEN/);
  assert.match(gateway, /sourceType: "operational"/);
  assert.match(gateway, /externalExecution: false/);
  assert.doesNotMatch(gateway, /listen\(|createServer\(|0\.0\.0\.0/);
});

test("local Codex bridge is allowlisted, bounded, metadata-only, and uses no extra HTTP listener", () => {
  const bridge = readFileSync(new URL("../../scripts/codex-workroom-readonly-bridge.mjs", import.meta.url), "utf8");
  assert.match(bridge, /allowlist = new Map/);
  assert.match(bridge, /32 \* 1024 \* 1024/);
  assert.match(bridge, /task_started.*task_complete.*turn_aborted/);
  assert.match(bridge, /eventSource: "codex_live"/);
  assert.doesNotMatch(bridge, /payload\.message|payload\.text|listen\(|createServer\(|3015/);
});

test("demo workroom subscribes to the same-origin SSE stream and labels mixed sources honestly", () => {
  const ui = readFileSync(new URL("../../src/components/admin/demo-agent-control-plane.tsx", import.meta.url), "utf8");
  assert.match(ui, /new EventSource\("\/api\/admin\/marketing\/demo-control-plane\/stream"\)/);
  assert.match(ui, /새 이벤트 자동 반영 · 이전 기록 병행/);
  assert.match(ui, /실시간 연결 안 됨 · 마지막 수동 동기화/);
  assert.match(ui, /timeline\.length/);
  assert.doesNotMatch(ui, /3015|https?:\/\//);
});

test("local workroom ledger uses authenticated SQLite WAL and changed-event SSE", () => {
  const ledger = readFileSync(new URL("../../src/lib/demo-control-plane-ledger.ts", import.meta.url), "utf8");
  const api = readFileSync(new URL("../../src/app/api/admin/marketing/demo-control-plane/route.ts", import.meta.url), "utf8");
  const stream = readFileSync(new URL("../../src/app/api/admin/marketing/demo-control-plane/stream/route.ts", import.meta.url), "utf8");
  assert.match(ledger, /DatabaseSync/);
  assert.match(ledger, /journal_mode=WAL/);
  assert.match(ledger, /INSERT OR IGNORE/);
  assert.match(api, /verifyDemoControlPlaneToken/);
  assert.match(api, /requireAdminSession/);
  assert.match(stream, /requireAdminSession/);
  assert.match(stream, /signature === previousPayload/);
});

test("global route recovery returns admin failures to admin and performs a fresh render", () => {
  const boundary = readFileSync(new URL("../../src/app/error.tsx", import.meta.url), "utf8");
  assert.match(boundary, /pathname\.startsWith\("\/admin"\) \? "\/admin"/);
  assert.match(boundary, /reset\(\); router\.refresh\(\)/);
  assert.doesNotMatch(boundary, /href="\/owner"/);
});

test("growth approval opens a focused D1-D7 review with fail-closed decisions", () => {
  const workroom = readFileSync(new URL("../../src/components/admin/demo-agent-control-plane.tsx", import.meta.url), "utf8");
  const focus = readFileSync(new URL("../../src/components/admin/content-approval-focus.tsx", import.meta.url), "utf8");
  const api = readFileSync(new URL("../../src/app/api/admin/marketing/content-review/route.ts", import.meta.url), "utf8");
  const asset = readFileSync(new URL("../../src/app/api/admin/marketing/content-review/assets/[file]/route.ts", import.meta.url), "utf8");
  assert.match(workroom, /GROWTH-CONTENT-D1-D7-REVIEW/);
  assert.match(workroom, /<ContentApprovalFocus/);
  assert.match(focus, /성장팀 · D1~D7 마케팅 콘텐츠 재검수 · 승인 대기/);
  assert.match(focus, /\["승인", "수정 요청", "보류"\]/);
  assert.match(focus, /disabled=\{!reviewable\}/);
  assert.match(focus, /외부 공개·게시·자동 실행 없음/);
  assert.match(focus, /customerCopy/);
  assert.match(focus, /changeReasons/);
  assert.match(api, /requireAdminSession/);
  assert.match(api, /NODE_ENV !== "development"/);
  assert.match(api, /externalExecution: false/);
  assert.match(asset, /allowed = \/\^d\[1-7\]/);
  assert.doesNotMatch(focus + api, /method:\s*["']POST|supabase|localStorage|sessionStorage/);
});
