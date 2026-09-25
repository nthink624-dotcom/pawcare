import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminAoCardDetail, buildAdminAoDashboardSnapshot, mapAdminAoLane } from "../../src/server/admin-ao-dashboard.ts";

const item = (workId, status, sourceSystem = "codex") => ({ work_id: workId, title: `${status} 업무`, role_label: "구현팀", status, original_directive_summary: "관리자 홈을 정리해 주세요", operations_directive_summary: "원장 연결 후 독립 검수", completed_summary: "검수 통과", blocker_summary: null, next_action: "화면 검수", approval_required: false, source_system: sourceSystem, source_updated_at: "2026-08-29T09:00:00+09:00", sync_state: "connected", updated_at: "2026-08-29T09:00:00+09:00" });

test("실제 원장 상태는 정확히 다섯 단계 중 하나로 매핑된다", () => {
  assert.deepEqual(["received", "in_progress", "blocked", "review", "completed"].map(mapAdminAoLane), ["queued", "working", "action", "review", "completed"]);
  const snapshot = buildAdminAoDashboardSnapshot({ checkedAt: "2026-08-29T10:00:00+09:00", sourceAvailable: true, items: [item("WORK-1", "in_progress"), item("WORK-2", "review")] });
  assert.equal(snapshot.lanes.reduce((count, lane) => count + lane.cards.length, 0), 2);
  assert.deepEqual(snapshot.lanes.map((lane) => lane.title), ["지시사항", "작업중", "조치필요", "검수필요", "완료"]);
});

test("카드 상세는 실제 지시·계획·담당·다음 순서와 출처만 반환한다", () => {
  const detail = buildAdminAoCardDetail(item("WORK-1", "in_progress"));
  assert.equal(detail.directiveSummary, "관리자 홈을 정리해 주세요");
  assert.equal(detail.planSummary, "원장 연결 후 독립 검수");
  assert.equal(detail.assignee, "구현팀");
  assert.equal(detail.nextAction, "화면 검수");
  assert.equal(detail.source, "codex_live");
  assert.doesNotMatch(JSON.stringify(detail), /WORK-1/);
});

test("개인정보·경로와 연결 불가 출처는 화면에 노출되지 않는다", () => {
  const unsafe = { ...item("SECRET-ID", "in_progress"), title: "user@example.com", original_directive_summary: "D:\\private\\log.txt", sync_state: "source_unavailable" };
  const serialized = JSON.stringify(buildAdminAoCardDetail(unsafe));
  assert.doesNotMatch(serialized, /SECRET-ID|user@example\.com|private/);
  assert.match(serialized, /unavailable/);
});
