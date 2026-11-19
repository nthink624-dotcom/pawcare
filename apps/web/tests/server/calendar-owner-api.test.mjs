import assert from "node:assert/strict";
import test from "node:test";

import { replaceScheduleRangeInBootstrap } from "../../src/components/owner-web/calendar-owner-api.ts";

test("schedule range refresh replaces moved entities by id without duplicates", () => {
  const data = {
    appointments: [
      { id: "moved", appointment_date: "2026-09-02", start_at: "2026-09-02T10:00:00+09:00" },
      { id: "kept", appointment_date: "2026-07-30", start_at: "2026-07-30T09:00:00+09:00" },
      { id: "stale", appointment_date: "2026-08-03", start_at: "2026-08-03T12:00:00+09:00" },
    ],
    groomingRecords: [
      { id: "record-moved", groomed_at: "2026-09-02T10:00:00+09:00" },
      { id: "record-stale", groomed_at: "2026-08-03T12:00:00+09:00" },
    ],
    notifications: [],
  };
  const range = {
    shopId: "shop-1",
    from: "2026-08-01",
    to: "2026-08-31",
    appointments: [
      { id: "moved", appointment_date: "2026-08-04", start_at: "2026-08-04T11:00:00+09:00" },
    ],
    groomingRecords: [
      { id: "record-moved", groomed_at: "2026-08-04T11:00:00+09:00" },
    ],
    notifications: [],
  };

  const result = replaceScheduleRangeInBootstrap(data, range);

  assert.deepEqual(result.appointments.map((item) => item.id), ["kept", "moved"]);
  assert.equal(result.appointments.filter((item) => item.id === "moved").length, 1);
  assert.deepEqual(result.groomingRecords.map((item) => item.id), ["record-moved"]);
});

test("a repeated range with identical values retains the existing schedule, but nested edits and deletions still apply", () => {
  const appointment = { id: "a1", appointment_date: "2026-08-04", start_at: "2026-08-04T11:00:00+09:00", booking_notes: { flags: ["first"], note: "기존 메모" } };
  const record = { id: "g1", groomed_at: "2026-08-04T12:00:00+09:00" };
  const notification = { id: "n1", created_at: "2026-08-04T12:00:00+09:00", sent_at: null };
  const data = { appointments: [appointment], groomingRecords: [record], notifications: [notification] };
  const range = { ...structuredClone(data), shopId: "shop-1", from: "2026-08-04", to: "2026-08-04" };
  range.appointments[0].booking_notes = { note: "기존 메모", flags: ["first"] };
  assert.equal(replaceScheduleRangeInBootstrap(data, range), data);

  range.appointments[0].booking_notes.note = "수정된 메모";
  const changed = replaceScheduleRangeInBootstrap(data, range);
  assert.notEqual(changed, data);
  assert.equal(changed.appointments[0].booking_notes.note, "수정된 메모");
  assert.equal(changed.groomingRecords, data.groomingRecords);
  assert.equal(changed.notifications, data.notifications);

  range.appointments = [];
  assert.equal(replaceScheduleRangeInBootstrap(data, range).appointments.length, 0);
});
