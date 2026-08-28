import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../../src/components/admin/admin-dashboard.tsx", import.meta.url),
  "utf8",
);
const adminRoute = readFileSync(
  new URL("../../src/app/admin/page.tsx", import.meta.url),
  "utf8",
);

test("admin route renders the integrated dashboard", () => {
  assert.match(adminRoute, /import AdminDashboard from "@\/components\/admin\/admin-dashboard"/);
  assert.match(adminRoute, /<AdminDashboard sessionLoginId=\{session\.loginId\}/);
  assert.doesNotMatch(adminRoute, /AdminHome/);
});

test("admin home prioritizes instruction, plan, and status", () => {
  const instruction = dashboard.indexOf('label="업무지시"');
  const plan = dashboard.indexOf('label="계획"');
  const status = dashboard.indexOf('label="현황"');
  assert.ok(instruction > 0);
  assert.ok(instruction < plan && plan < status);
  assert.match(dashboard, /title=\{currentWork\?\.goal/);
  assert.match(dashboard, /owner="성장팀"/);
  assert.match(dashboard, /nextAction=\{nextAction\}/);
});

test("overview uses only live admin APIs and moves evidence into details", () => {
  for (const endpoint of [
    "/api/admin/session",
    "/api/admin/support-requests?limit=50",
    "/api/admin/revenue-summary",
    "/api/admin/marketing/status",
  ]) {
    assert.match(dashboard, new RegExp(endpoint.replace(/[?]/g, "\\?")));
  }
  assert.match(dashboard, /<DetailEntry title="문의 상세"/);
  assert.match(dashboard, /<DetailEntry title="매출 상세"/);
  assert.doesNotMatch(dashboard, /\/admin\/operations|\/admin\/owners|수동 원장 2026/);
});

test("home keeps compact typography and canonical status indicators", () => {
  assert.match(dashboard, /getWrapIndicatorClass/);
  assert.match(dashboard, /getDotIndicatorClass/);
  assert.doesNotMatch(dashboard, /font-bold|text-\[24px\]|rounded-\[12px\]|rounded-xl/);
});

test("home includes a live instruction-to-status graph", () => {
  assert.match(dashboard, /<WorkflowGraph/);
  assert.match(dashboard, /aria-label="업무 진행 그래프"/);
  assert.match(dashboard, /hasInstruction=\{Boolean\(currentWork\)\}/);
  assert.match(dashboard, /planConnected=\{Boolean\(marketingStatus\?\.studio\.connected\)\}/);
  assert.match(dashboard, /statusReady=\{loadState === "ready"\}/);
});

test("canonical left edge establishes a positioned parent", () => {
  const globals = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
  assert.match(globals, /\.pm-wrap-indicator\s*\{[^}]*position:\s*relative;/s);
});
