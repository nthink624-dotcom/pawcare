import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const {
  getActualGroomingDurationMinutes,
  getAppointmentEffectiveWindow,
  isOvernightActualGroomingSession,
  isStaleGroomingSession,
} = await import("../../src/lib/appointment-time.ts");
const { isSlotAvailable } = await import("../../src/lib/availability.ts");
const { buildServiceDurationRecommendations } = await import("../../src/lib/service-duration-recommendations.ts");

const service = {
  id: "service-120",
  shop_id: "shop-a",
  name: "전체 미용",
  price: 100_000,
  duration_minutes: 120,
  is_active: true,
  created_at: "2026-09-01T00:00:00+09:00",
  updated_at: "2026-09-01T00:00:00+09:00",
};

function appointment(overrides = {}) {
  return {
    id: "appointment-a",
    shop_id: "shop-a",
    guardian_id: "guardian-a",
    pet_id: "pet-a",
    service_id: service.id,
    staff_id: "staff-a",
    appointment_date: "2026-09-07",
    appointment_time: "17:00",
    status: "in_progress",
    memo: "",
    rejection_reason: null,
    start_at: "2026-09-07T17:00:00+09:00",
    end_at: "2026-09-07T19:00:00+09:00",
    actual_started_at: "2026-09-07T19:02:00+09:00",
    actual_completed_at: null,
    source: "owner",
    created_at: "2026-09-01T00:00:00+09:00",
    updated_at: "2026-09-07T19:02:00+09:00",
    ...overrides,
  };
}

const shop = {
  business_hours: Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => [weekday, { open: "10:00", close: "19:00", enabled: weekday !== 0 }]),
  ),
  reservation_policy_settings: { booking_close_grace_minutes: 15 },
};

test("scheduled appointment date and duration remain the only board and availability geometry", () => {
  const completedNextDay = appointment({
    status: "completed",
    actual_completed_at: "2026-09-08T10:04:00+09:00",
  });

  assert.deepEqual(getAppointmentEffectiveWindow(completedNextDay, [service]), {
    date: "2026-09-07",
    startMinute: 17 * 60,
    endMinute: 19 * 60,
    durationMinutes: 120,
    usesActualTime: false,
  });
  assert.equal(
    isSlotAvailable({ date: "2026-09-07", startMinute: 17 * 60 + 30, durationMinutes: 30, appointments: [completedNextDay], services: [service] }),
    false,
  );
  assert.equal(
    isSlotAvailable({ date: "2026-09-08", startMinute: 10 * 60, durationMinutes: 30, appointments: [completedNextDay], services: [service] }),
    true,
  );
});

test("business close grace and KST midnight classify active grooming as stale without moving it", () => {
  const inProgress = appointment();
  assert.equal(isStaleGroomingSession({ appointment: inProgress, shop, now: "2026-09-07T19:15:00+09:00" }), false);
  assert.equal(isStaleGroomingSession({ appointment: inProgress, shop, now: "2026-09-07T19:16:00+09:00" }), true);
  assert.equal(isStaleGroomingSession({ appointment: inProgress, shop, now: "2026-09-08T00:00:00+09:00" }), true);
  assert.equal(
    isStaleGroomingSession({ appointment: appointment({ status: "completed" }), shop, now: "2026-09-08T10:04:00+09:00" }),
    false,
  );
});

test("next-day completion keeps status truth but is excluded from actual-duration statistics", () => {
  const startedAt = "2026-09-07T19:02:00+09:00";
  const nextDayCompletedAt = "2026-09-08T10:04:00+09:00";
  assert.equal(isOvernightActualGroomingSession(startedAt, nextDayCompletedAt), true);
  assert.equal(getActualGroomingDurationMinutes(startedAt, nextDayCompletedAt), null);
  assert.equal(getActualGroomingDurationMinutes("2026-09-07T17:00:00+09:00", "2026-09-07T19:00:00+09:00"), 120);

  const overnightAppointments = Array.from({ length: 3 }, (_, index) => ({
    ...appointment({
      id: `appointment-${index}`,
      status: "completed",
      actual_completed_at: nextDayCompletedAt,
    }),
  }));
  const overnightRecords = overnightAppointments.map((item, index) => ({
    id: `record-${index}`,
    appointment_id: item.id,
    service_id: service.id,
    actual_duration_minutes: 902,
    pet_weight_snapshot: 5,
  }));
  assert.deepEqual(
    buildServiceDurationRecommendations({
      shopId: "shop-a",
      records: overnightRecords,
      appointments: overnightAppointments,
      services: [service],
    }),
    [],
  );
});

test("owner board source cannot use actual timestamps for date membership, position, height, or primary time", () => {
  const management = readFileSync("src/components/owner-web/calendar-management-screen.tsx", "utf8");
  const grid = readFileSync("src/components/owner-web/calendar-daily-schedule-grid.tsx", "utf8");
  const mutations = readFileSync("src/server/owner-mutations.ts", "utf8");
  const profitability = readFileSync("src/server/profitability-analytics.ts", "utf8");

  assert.doesNotMatch(management, /getActualAppointmentWindowForDate|hasActualAppointmentWindowOnDate/);
  assert.match(management, /\.filter\(\(appointment\) => appointment\.appointment_date === selectedDate\)/);
  assert.match(management, /const startMinute = timeToHour\(appointment\.appointment_time\) \* 60;/);
  assert.match(management, /const durationMinutes = scheduledDurationMinutes;/);
  assert.match(management, /return currentMinutesInTimeZone\(\) \/ 60;/);
  assert.match(grid, /const displayTimeLabel = booking\.scheduledTimeLabel \?\? timeLabel;/);
  assert.doesNotMatch(grid, /displayTimeLabel = booking\.actualTimeLabel/);
  assert.match(mutations, /actualDurationMinutes: getActualGroomingDurationMinutes/);
  assert.match(mutations, /actual_duration_minutes: getActualGroomingDurationMinutes/);
  assert.match(profitability, /actualMinutes: isOvernightActualGroomingSession\([\s\S]*?\)\s*\? null\s*:\s*nullablePositive/);
});
