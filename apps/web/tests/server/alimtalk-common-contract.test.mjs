import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pcRegistryPath = new URL("../../src/lib/notification-registry.ts", import.meta.url);
const mobileRegistryPath = new URL("../../../mobile/src/lib/notification-registry.ts", import.meta.url);
const sharedContractPath = new URL("../../../shared/contracts/alimtalk.ts", import.meta.url);

test("PC와 모바일 알림톡 registry는 고객 흐름의 공통 템플릿 alias를 유지한다", async () => {
  const [pc, mobile, shared] = await Promise.all([
    readFile(pcRegistryPath, "utf8"),
    readFile(mobileRegistryPath, "utf8"),
    readFile(sharedContractPath, "utf8"),
  ]);
  const aliases = [
    "booking_confirmed",
    "booking_cancelled",
    "appointment_reminder_10m",
    "visit_schedule_notice",
    "visit_reminder_notice",
    "grooming_started",
    "grooming_almost_done",
    "grooming_completed",
    "grooming_completed_without_report",
    "revisit_notice",
  ];

  for (const alias of aliases) {
    assert.match(pc, new RegExp(`"${alias}"`), `PC ${alias}`);
    assert.match(mobile, new RegExp(`"${alias}"`), `mobile ${alias}`);
  }

  assert.match(shared, /#\{보호자명\} 보호자님/);
  assert.match(shared, /#\{서비스명\}/);
  assert.match(shared, /#\{픽업예상시간\}분 후에 완료될 예정이에요/);
  assert.match(shared, /예뻐진 모습과/);
  assert.match(shared, /믿고 맡겨주셔서 감사해요/);

  for (const registry of [pc, mobile]) {
    assert.match(registry, /케어리포트/);
    assert.match(registry, /마지막 방문: #\{마지막방문일\}/);
    assert.doesNotMatch(registry, /\(방긋\)/);
  }
});
