import assert from "node:assert/strict";
import test from "node:test";

const { hasLaterRebooking } = await import("../../src/lib/revisit-reminder.ts");

const record = {
  pet_id: "pet-1",
  groomed_at: "2026-08-21T03:00:00.000Z",
};

test("a later active appointment cancels the revisit reminder", () => {
  assert.equal(hasLaterRebooking(record, [
    { pet_id: "pet-1", start_at: "2026-09-10T03:00:00.000Z", status: "confirmed" },
  ]), true);
});

test("cancelled appointments and another pet do not cancel the reminder", () => {
  assert.equal(hasLaterRebooking(record, [
    { pet_id: "pet-1", start_at: "2026-09-10T03:00:00.000Z", status: "cancelled" },
    { pet_id: "pet-2", start_at: "2026-09-10T03:00:00.000Z", status: "confirmed" },
  ]), false);
});

test("an appointment before the completed grooming does not cancel the reminder", () => {
  assert.equal(hasLaterRebooking(record, [
    { pet_id: "pet-1", start_at: "2026-08-20T03:00:00.000Z", status: "completed" },
  ]), false);
});
