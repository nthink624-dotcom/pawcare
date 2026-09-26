import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const { computeAvailableSlots } = await import("../../src/lib/availability.ts");

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const monday = "2026-09-07";

function makeShop(overrides = {}) {
  return {
    id: "shop-availability",
    name: "예약 테스트샵",
    business_hours: Object.fromEntries(weekdayKeys.map((_, weekday) => [weekday, { open: "09:00", close: "18:00", enabled: true }])),
    regular_closed_days: [],
    regular_closed_cycle: "weekly",
    regular_closed_anchor_date: null,
    temporary_closed_dates: [],
    concurrent_capacity: 1,
    booking_slot_interval_minutes: 30,
    booking_slot_offset_minutes: 0,
    booking_available_start_time: "09:00",
    booking_available_end_time: "18:00",
    reservation_policy_settings: { booking_blocked_windows: [] },
    customer_page_settings: {},
    ...overrides,
  };
}

function makeStaff(id, defaultDays = weekdayKeys) {
  return {
    id,
    shop_id: "shop-availability",
    name: id,
    role: "디자이너",
    services: ["목욕"],
    startTime: "09:00",
    endTime: "18:00",
    defaultDays,
    status: "active",
  };
}

const service = {
  id: "bath",
  shop_id: "shop-availability",
  name: "목욕",
  duration_minutes: 60,
  is_active: true,
};

function slots({ shop = makeShop(), staffId = null, staffMembers, appointments = [] }) {
  return computeAvailableSlots({
    date: monday,
    serviceId: service.id,
    shop,
    services: [service],
    appointments,
    staffId,
    staffMembers,
  });
}

describe("customer booking availability truth", () => {
  it("keeps a Monday off designer unavailable while another designer keeps the date available", () => {
    const mondayOff = makeStaff("monday-off", weekdayKeys.filter((day) => day !== "mon"));
    const mondayOn = makeStaff("monday-on");

    assert.equal(slots({ staffId: mondayOff.id, staffMembers: [mondayOff, mondayOn] }).length, 0);
    assert.ok(slots({ staffId: mondayOn.id, staffMembers: [mondayOff, mondayOn] }).length > 0);
    assert.ok(slots({ staffMembers: [mondayOff, mondayOn] }).length > 0);
  });

  it("uses the same slot predicate for closure, break, cutoff, and capacity", () => {
    const staff = makeStaff("available");
    assert.equal(slots({ shop: makeShop({ temporary_closed_dates: [monday] }), staffMembers: [staff] }).length, 0);
    assert.equal(
      slots({ shop: makeShop({ reservation_policy_settings: { booking_blocked_windows: [{ days: ["mon"], start: "09:00", end: "18:00" }] } }), staffMembers: [staff] }).length,
      0,
    );
    assert.equal(slots({ shop: makeShop({ reservation_policy_settings: { booking_blocked_windows: [], booking_close_grace_minutes: 0 } }), staffMembers: [staff] }).includes("18:00"), false);
    assert.equal(
      slots({
        staffId: staff.id,
        staffMembers: [staff],
        appointments: [{ id: "occupied", appointment_date: monday, appointment_time: "09:00", staff_id: staff.id, status: "confirmed", service_id: service.id }],
      }).includes("09:00"),
      false,
    );
  });

  it("keeps customer date labels, disabled staff cards, and AI-ranked slots on server-authoritative paths", () => {
    const route = fs.readFileSync(new URL("../../src/app/api/availability/route.ts", import.meta.url), "utf8");
    const page = fs.readFileSync(new URL("../../src/components/customer/customer-booking-page.tsx", import.meta.url), "utf8");
    const flow = fs.readFileSync(new URL("../../src/components/customer/customer-first-visit-claude-flow.tsx", import.meta.url), "utf8");

    assert.match(route, /availabilityByDate/);
    assert.match(route, /includeStaffAvailability/);
    assert.match(route, /fullSlots/);
    assert.match(page, /dates:\s*dateOptions\.map/);
    assert.doesNotMatch(page, /fullSlots:\s*true/);
    assert.match(page, /includeStaffAvailability:\s*true/);
    assert.match(flow, /disabled=\{availability !== true\}/);
    assert.match(flow, /disabled=\{!firstVisit\.date \|\| isUnavailable \|\| isChecking/);
    assert.doesNotMatch(flow, /shuffleStaffMembers/);
  });
});
