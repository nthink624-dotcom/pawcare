import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminKanbanItems } from "../../src/components/admin/admin-kanban.ts";

const request = (id, status) => ({ id, status, title: `문의 ${id}`, shopId: "shop-1", shopName: "테스트 매장" });
const marketing = (status, connected = false, pendingApprovals = 1) => ({
  studio: { connected },
  workflow: {
    label: "로컬 계획",
    pendingApprovals,
    currentWork: { workItemId: "work-1", runId: "run-1", goal: "관리자 화면 검수", status, lastChangedAt: null },
  },
});

test("관리자 업무는 조치·검수·완료 중 정확히 한 칸에 배치된다", () => {
  const items = buildAdminKanbanItems(
    [request("open", "open"), request("review", "reviewing"), request("done", "resolved")],
    marketing("running"),
  );
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.ok(items.every((item) => ["action", "review", "complete"].includes(item.column)));
  assert.equal(items.find((item) => item.id === "support:open")?.column, "action");
  assert.equal(items.find((item) => item.id === "support:review")?.column, "review");
  assert.equal(items.find((item) => item.id === "support:done")?.column, "complete");
  assert.equal(items.find((item) => item.id === "work:work-1")?.column, "review");
});

test("업무와 연결 상태의 완료·조치 분류가 서로 중복되지 않는다", () => {
  const complete = buildAdminKanbanItems([], marketing("success", true, 0));
  assert.deepEqual(complete.map((item) => item.column), ["complete", "complete"]);
  const action = buildAdminKanbanItems([], marketing("failed", false, 0));
  assert.deepEqual(action.map((item) => item.column), ["action", "action"]);
});

test("화면 계약은 세 명시 구분과 기존 lazy·44px 계약을 유지한다", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../../src/components/admin/admin-home.tsx", import.meta.url), "utf8"));
  for (const label of ["조치 필요", "검수 필요", "완료"]) assert.match(source, new RegExp(label));
  assert.match(source, /if \(!activated\) return;/);
  assert.match(source, /min-h-11/);
  assert.match(source, /data-kanban-item-id/);
});
