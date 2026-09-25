import assert from "node:assert/strict";
import test from "node:test";
import { adaptAdminWorkItems, ADMIN_WORK_STAGES } from "../../src/components/admin/admin-kanban.ts";

const work = (stage) => ({ id: `work-${stage}`, title: "관리자 홈 재구성", directiveSummary: "대표 업무 흐름을 정확히 보여준다.", breakdown: ["UI 구현", "독립 검수"], owner: "구현 담당", stage, actualStatus: "작업 중", blocker: null, nextAction: "검수 요청", ownerDecision: null, checkedAt: "2026-08-29 10:00", source: "codex_live", sourceLabel: "Codex 작업", completionCriteria: ["5단계 표시"], verificationResults: [] });

test("실제 WorkItem 다섯 상태는 정확히 한 칸의 UI 카드로 변환된다", () => {
  const stages = ["directive", "in_progress", "action_required", "review_required", "complete"];
  const cards = adaptAdminWorkItems(stages.map(work));
  assert.deepEqual(cards.map((item) => item.stage), stages);
  assert.equal(new Set(cards.map((item) => item.id)).size, cards.length);
  assert.deepEqual(ADMIN_WORK_STAGES.map((item) => item.label), ["지시사항", "작업중", "조치필요", "검수필요", "완료"]);
});
test("업무 원장 연결 전에는 합성 카드 없이 빈 배열을 반환한다", () => { assert.deepEqual(adaptAdminWorkItems(null), []); });
test("화면 계약은 3개 메인·5단계·상세 패널·44px 타깃을 유지한다", async () => {
  const source = await import("node:fs/promises").then(async (fs) => `${await fs.readFile(new URL("../../src/components/admin/admin-home.tsx", import.meta.url), "utf8")}\n${await fs.readFile(new URL("../../src/components/admin/admin-kanban.ts", import.meta.url), "utf8")}`);
  for (const label of ["계정 관리", "워크룸", "고객 문의", "지시사항", "작업중", "조치필요", "검수필요", "완료"]) assert.match(source, new RegExp(label));
  for (const label of ["원 지시 요약", "계획·업무 분해", "담당", "실제 상태", "막힘", "다음 순서", "대표 판단 필요", "확인 시각", "출처", "완료 조건", "검수 결과"]) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /오늘 먼저 볼 것/);
  assert.match(source, /등록된 업무가 없습니다/);
  assert.match(source, /업무 원장 연결 전/);
  assert.match(source, /setWorkSnapshot\(\{/);
  assert.match(source, /일부 출처 확인 불가/);
  assert.doesNotMatch(source, /connection === "limited" \? "local_snapshot"/);
  assert.match(source, /\/api\/admin\/ao-dashboard/);
  assert.doesNotMatch(source, /fullName|loginId|sessionLoginId\}/);
  assert.match(source, /min-h-11/);
  assert.match(source, /data-kanban-item-id/);
});
