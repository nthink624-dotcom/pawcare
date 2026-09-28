import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pcRegistryPath = new URL("../../src/lib/notification-registry.ts", import.meta.url);
const mobileRegistryPath = new URL("../../../petmanager-app/src/lib/notification-registry.ts", import.meta.url);

test("PC와 모바일 알림톡 registry는 고객 흐름의 공통 템플릿 alias를 유지한다", async () => {
  const [pc, mobile] = await Promise.all([
    readFile(pcRegistryPath, "utf8"),
    readFile(mobileRegistryPath, "utf8"),
  ]);
  const aliases = [
    "booking_confirmed",
    "booking_manage_link_requested",
    "booking_cancelled",
    "booking_time_proposed",
    "booking_rescheduled_confirmed",
    "visit_schedule_notice",
    "visit_reminder_notice",
    "appointment_reminder_10m",
    "grooming_started",
    "grooming_almost_done",
    "grooming_completed",
    "revisit_notice",
  ];

  for (const alias of aliases) {
    assert.match(pc, new RegExp(`"${alias}"`), `PC ${alias}`);
    assert.match(mobile, new RegExp(`"${alias}"`), `mobile ${alias}`);
  }

  for (const registry of [pc, mobile]) {
    assert.match(registry, /제안 일정: #\{제안일시\}/);
    assert.match(registry, /방문 전 준비사항: #\{방문준비사항\}/);
    assert.match(registry, /케어리포트/);
    assert.match(registry, /마지막 방문: #\{마지막방문일\}/);
    assert.doesNotMatch(registry, /\(방긋\)/);
  }
});
