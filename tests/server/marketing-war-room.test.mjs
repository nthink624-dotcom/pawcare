import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applyMarketingDecision, buildMarketingWarRoomSnapshot, resolveMarketingWorkSelection } from "../../src/lib/marketing-war-room-contract.ts";

test("keeps the canonical flow, three independent gates, and fail-closed flags", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true, now: "2026-08-26T00:00:00.000Z" });
  assert.deepEqual(snapshot.nodes.map((node) => node.id), [
    "SOURCING_APPROVAL", "target_sourced", "target_qualified", "TARGET_LIST_APPROVAL",
    "OUTREACH_APPROVAL", "outreach_attempted", "delivery", "response", "trial", "signup", "activation", "analysis",
  ]);
  assert.deepEqual(snapshot.approvalGroups.map((gate) => gate.gateId), ["SOURCING_APPROVAL", "TARGET_LIST_APPROVAL", "OUTREACH_APPROVAL"]);
  assert.equal(snapshot.approvalGroups[2].scope, "prepare_queue_only");
  assert.equal(snapshot.executionEnabled, false);
  assert.equal(snapshot.externalExecution, false);
  assert.ok(snapshot.nodes.every((node) => !node.executionEnabled && !node.externalExecution));
  assert.equal(snapshot.plans[0].workId, "PM-GROWTH-20260826-006");
  assert.equal(snapshot.plans[0].analysisContractReview, "검토 완료");
  assert.equal(snapshot.plans[0].approvalActionVisible, false);
  assert.equal(snapshot.plans[0].externalExecution, false);
});

test("resolves growth and analysis home deep links to team work details", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true });
  assert.equal(resolveMarketingWorkSelection(snapshot, "PM-GROWTH-20260826-006"), "team:PM-GROWTH-20260826-006");
  assert.equal(resolveMarketingWorkSelection(snapshot, "PM-GROWTH-20260826-006-ANALYSIS"), "team:PM-GROWTH-20260826-006-ANALYSIS");
});

test("admin typography and operations preserve readable controls and support actions", () => {
  const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
  const operations = readFileSync(new URL("../../src/components/admin/admin-operations-summary.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../../src/components/admin/admin-dashboard.tsx", import.meta.url), "utf8");
  assert.match(css, /font-size: 16px !important/);
  assert.match(css, /min-height: 44px/);
  assert.match(operations, /AdminSupportInbox/);
  assert.match(operations, /method: "PATCH"/);
  assert.match(dashboard, /href="\/admin"/);
  assert.match(dashboard, /넘친데이 펫매니저 관리자 홈/);
  assert.match(dashboard, /관리 현황/);
  assert.match(dashboard, /관리 메뉴/);
  assert.match(dashboard, /href="\/admin\/operations"/);
  assert.match(dashboard, /label="운영 관리" description="문의·운영 처리"/);
  assert.match(dashboard, /href="\/admin\/owners"/);
  assert.match(dashboard, /label="업체 관리" description="가입 업체·계정"/);
  assert.match(dashboard, /href="\/admin\/marketing"/);
  assert.match(dashboard, /label="마케팅 워크룸" description="프로젝트·승인"/);
  assert.match(dashboard, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(dashboard, /min-h-11/);
  assert.doesNotMatch(dashboard, /label="운영 상세"/);
  assert.doesNotMatch(dashboard, /label="오너·매장"/);
  assert.match(dashboard, /StatusRow/);
  assert.doesNotMatch(dashboard, /최근 7일/);
  assert.doesNotMatch(dashboard, /marketing\/kpis\?days=7/);
  assert.doesNotMatch(dashboard, /min-h-40/);
  assert.match(dashboard, /demo-control-plane/);
  assert.match(dashboard, /category === "approval"/);
  assert.match(dashboard, /category === "team_progress"/);
  assert.match(dashboard, /category === "user_action"/);
  assert.doesNotMatch(dashboard, /item\.workId/);
  assert.doesNotMatch(dashboard, /item\.stageLabel/);
  assert.doesNotMatch(dashboard, /currentAccount|sessionLoginId|fullName|loginId/);
  assert.doesNotMatch(dashboard, /\/api\/admin\/session/);
});

test("marketing workroom opens with the representative visual flow and keeps detailed gates behind a control", () => {
  const workroom = readFileSync(new URL("../../src/components/admin/admin-marketing-war-room.tsx", import.meta.url), "utf8");
  assert.match(workroom, /\["기획", "검토", "대표 승인", "제작", "배포·실행", "결과 확인"\]/);
  assert.match(workroom, /현재 · 신청 페이지 제작 준비/);
  assert.match(workroom, /세부 단계 보기/);
  assert.match(workroom, /aria-expanded=\{showDetails\}/);
  assert.match(workroom, /else if \(!work\) setShowDetails\(false\)/);
});

test("partial live API failures discard stale source values", () => {
  const source = readFileSync(new URL("../../src/components/admin/admin-marketing-war-room.tsx", import.meta.url), "utf8");
  assert.match(source, /setAgentStatus\(null\)/);
  assert.match(source, /setKpis\(null\)/);
  assert.match(source, /이전 값을 폐기했습니다/);
  assert.match(source, /실제 API 자동 새로고침/);
  assert.match(source, /팀 업무 원장 · 수동 동기화/);
});

test("locks successors and never enables outreach without a run-scoped receipt", () => {
  const initial = buildMarketingWarRoomSnapshot({ representative: true });
  assert.equal(initial.nodes.find((node) => node.id === "target_sourced").actionEnabled, false);
  assert.equal(initial.nodes.find((node) => node.id === "target_sourced").progressLabel, "선행 단계 대기");
  const progressed = buildMarketingWarRoomSnapshot({ representative: true, statuses: { SOURCING_APPROVAL: "approved", target_sourced: "completed", target_qualified: "completed", TARGET_LIST_APPROVAL: "approved", OUTREACH_APPROVAL: "approved" } });
  const outreach = progressed.nodes.find((node) => node.id === "outreach_attempted");
  assert.equal(outreach.actionEnabled, false);
  assert.match(outreach.blocker, /execution receipt/);
});

test("approval visibility requires representative, safe freshness, waiting state, and prerequisites", () => {
  const waiting = { SOURCING_APPROVAL: "approval_waiting" };
  assert.equal(buildMarketingWarRoomSnapshot({ representative: false, statuses: waiting }).nodes[0].approvalActionVisible, false);
  assert.equal(buildMarketingWarRoomSnapshot({ representative: true, statuses: waiting, freshness: { SOURCING_APPROVAL: "stale" } }).nodes[0].approvalActionVisible, false);
  assert.equal(buildMarketingWarRoomSnapshot({ representative: true, statuses: waiting, safetyViolations: { SOURCING_APPROVAL: "unsafe" } }).nodes[0].approvalActionVisible, false);
  assert.equal(buildMarketingWarRoomSnapshot({ representative: true, statuses: waiting }).nodes[0].approvalActionVisible, true);
});

test("puts a safety violation first and suppresses its approval control", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true, safetyViolations: { TARGET_LIST_APPROVAL: "금지 식별자 감지" } });
  assert.equal(snapshot.nodes[0].id, "TARGET_LIST_APPROVAL");
  assert.equal(snapshot.nodes[0].approvalActionVisible, false);
});

test("a decision preserves gate id, scope, version, decision maker, time, and remains non-executing", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true, statuses: { SOURCING_APPROVAL: "approval_waiting" } });
  const result = applyMarketingDecision({ snapshot, gateId: "SOURCING_APPROVAL", decision: "approve", now: "2026-08-26T01:02:03.000Z" });
  assert.deepEqual({ gateId: result.audit.gateId, scope: result.audit.scope, version: result.audit.gateVersion, decidedBy: result.audit.decidedBy, decidedAt: result.audit.decidedAt }, { gateId: "SOURCING_APPROVAL", scope: "sourcing_criteria_only", version: "v1", decidedBy: "대표", decidedAt: "2026-08-26T01:02:03.000Z" });
  assert.equal(result.externalExecution, false);
});

test("representative projection removes superseded approvals and keeps completed analysis as history", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true });
  const growth = snapshot.teamWorkItems.find((item) => item.workId === "PM-GROWTH-20260826-006");
  const analysis = snapshot.teamWorkItems.find((item) => item.workId.endsWith("-ANALYSIS"));
  assert.equal(growth.status, "review");
  assert.match(growth.stageLabel, /Preview 준비/);
  assert.equal(growth.connectionState, "manual_sync");
  assert.equal(analysis.status, "completed");
  assert.equal(analysis.measurementState, "not_measured");
  assert.equal(snapshot.pendingRepresentativeDecisions.length, 0);
  assert.doesNotMatch(JSON.stringify(snapshot.teamWorkItems), /progress|percent/i);
});

test("marketing ledger migration is append-only, idempotent, RLS protected, and fail-closed", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260826110517_marketing_work_ledger.sql", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../src/app/api/internal/marketing/work-events/route.ts", import.meta.url), "utf8");
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /marketing_work_events/);
  assert.match(migration, /marketing_work_approvals/);
  assert.match(migration, /marketing_work_artifacts/);
  assert.match(migration, /marketing_work_outbox/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all .* from anon, authenticated/g);
  assert.match(migration, /alter publication supabase_realtime add table public\.marketing_work_items/);
  assert.match(migration, /source_type text not null default 'operational' check \(source_type = 'operational'\)/);
  assert.match(migration, /parent_work_id text references public\.marketing_work_items/);
  assert.match(migration, /source_sequence bigint not null/);
  assert.match(route, /MARKETING_WORK_EVENT_TOKEN/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /externalExecution: false/);
  assert.match(route, /containsForbiddenIdentifier/);
  assert.match(route, /sourceType: z\.literal\("operational"\)/);
  assert.doesNotMatch(route, /console\./);
});

test("work details expose three safe design artifacts and preserve missing-result semantics", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true });
  const artifacts = new Map(snapshot.teamWorkItems.map((item) => [item.workId, item.artifact]));
  assert.equal(artifacts.get("PM-ADMIN-HOME-R2")?.previewUrl, "/admin");
  assert.equal(artifacts.get("PM-GROWTH-20260826-006")?.previewUrl, "/previews/campaign-solo-grooming-trial-r2.png");
  assert.equal(artifacts.get("PM-CALL-ID-P0")?.previewUrl, "/previews/call-id-p0.png");
  assert.equal(artifacts.get("PM-MOBILE-CONNECTION")?.previewUrl, "/demo/owner-mobile");
  for (const artifact of artifacts.values()) {
    if (artifact.previewUrl) assert.match(artifact.previewUrl, /^\/[a-z0-9/.-]+$/);
  }
  const ui = readFileSync(new URL("../../src/components/admin/admin-marketing-war-room.tsx", import.meta.url), "utf8");
  assert.match(ui, /디자인·결과물/);
  assert.match(ui, /디자인 미제출/);
  assert.match(ui, /미리보기 열기/);
});

test("null and unconnected values stay explicit and forbidden identifiers do not enter the contract or URL query", () => {
  const snapshot = buildMarketingWarRoomSnapshot({ representative: true, freshness: { signup: "calculation_pending" } });
  assert.equal(snapshot.nodes.find((node) => node.id === "signup").freshness, "calculation_pending");
  assert.equal(snapshot.nodes.find((node) => node.id === "signup").dueAt, null);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /phone|email|appointment_id|payment_id|contact_id|shop_id|user_id|batch_id|https?:\/\//i);
  const ui = readFileSync(new URL("../../src/components/admin/admin-marketing-war-room.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /\?(?:[^"']*)(?:user|shop|contact|payment|appointment|batch)(?:Id|_id)=/i);
  const route = readFileSync(new URL("../../src/app/api/admin/marketing/work-room/route.ts", import.meta.url), "utf8");
  assert.match(route, /!account\.isSuperAdmin/);
  assert.match(route, /403/);
});
