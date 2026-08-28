import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildAdminAoDashboardSnapshot, mapAdminAoLane } from "../../src/server/admin-ao-dashboard.ts";

test("AO statuses map to exactly one of the five fixed lanes", () => {
  assert.equal(mapAdminAoLane("queued"), "queued");
  assert.equal(mapAdminAoLane("in_progress"), "working");
  assert.equal(mapAdminAoLane("running"), "working");
  assert.equal(mapAdminAoLane("blocked"), "action");
  assert.equal(mapAdminAoLane("approval_waiting"), "action");
  assert.equal(mapAdminAoLane("review"), "review");
  assert.equal(mapAdminAoLane("completed"), "completed");
});

test("representative directive appears only on the first queued card", () => {
  const snapshot = buildAdminAoDashboardSnapshot({
    checkedAt: "2026-08-29T10:00:00+09:00",
    sourceAvailable: true,
    items: [
      item("one", "queued", "첫 지시", "2026-08-29T09:00:00+09:00"),
      item("two", "queued", "둘째 지시", "2026-08-29T08:00:00+09:00"),
      item("three", "review", "검수 지시", "2026-08-29T07:00:00+09:00"),
    ],
  });
  const cards = snapshot.lanes.flatMap((lane) => lane.cards);
  assert.equal(cards.filter((card) => card.representativeDirective).length, 1);
  assert.equal(snapshot.lanes.find((lane) => lane.id === "queued")?.cards[0].representativeDirective, "첫 지시");
});

test("unsafe source text and internal identifiers never enter card output", () => {
  const snapshot = buildAdminAoDashboardSnapshot({
    checkedAt: "2026-08-29T10:00:00+09:00",
    sourceAvailable: true,
    items: [{ ...item("SECRET-WORK-ID", "in_progress", "D:\\private\\log.txt", "2026-08-29T09:00:00+09:00"), title: "user@example.com" }],
  });
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /SECRET-WORK-ID|private|user@example\.com/);
  assert.match(serialized, /확인 불가/);
});

test("admin source removes the retired three-section flow and defers detail fetch", () => {
  const page = fs.readFileSync("src/components/admin/admin-home.tsx", "utf8");
  const adminSource = fs
    .readdirSync("src/components/admin")
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => fs.readFileSync(`src/components/admin/${name}`, "utf8"))
    .join("\n");
  for (const retired of ["업무지시 · 계획 · 현황", "오늘 먼저 볼 것", "상세 워룸", "상세 대기"]) {
    assert.equal(adminSource.includes(retired), false, `${retired} must stay removed`);
  }
  assert.equal((page.match(/\/api\/admin\/ao-dashboard\//g) ?? []).length, 1);
  assert.ok(page.indexOf("/api/admin/ao-dashboard/${card.key}") > page.indexOf("async function openDetail"));
});

function item(workId, status, directive, updatedAt) {
  return {
    work_id: workId,
    title: `${status} 업무`,
    role_label: "구현팀",
    status,
    original_directive_summary: directive,
    operations_directive_summary: "안전한 목적 요약",
    completed_summary: null,
    blocker_summary: null,
    next_action: "다음 단계 확인",
    approval_required: false,
    source_system: "operations",
    source_updated_at: updatedAt,
    sync_state: "connected",
    updated_at: updatedAt,
  };
}
