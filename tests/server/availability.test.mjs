import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { computeAvailableSlots } = await import("../../src/lib/availability.ts");
const { addDate, currentDateInTimeZone } = await import("../../src/lib/utils.ts");

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function futureDate(offset = 14) {
  return addDate(currentDateInTimeZone(), offset);
}

function makeShop(overrides = {}) {
  return {
    id: "shop-test",
    name: "테스트샵",
    phone: "01000000000",
    address: "서울",
    description: "",
    business_hours: Object.fromEntries(
      Array.from({ length: 7 }, (_, weekday) => [
        weekday,
        { open: "09:00", close: "20:00", enabled: true },
      ]),
    ),
    regular_closed_days: [],
    regular_closed_cycle: "weekly",
    regular_closed_anchor_date: null,
    temporary_closed_dates: [],
    concurrent_capacity: 1,
    booking_slot_interval_minutes: 30,
    booking_slot_offset_minutes: 0,
    booking_available_start_time: "10:00",
    booking_available_end_time: "17:00",
    approval_mode: "auto",
    reservation_policy_settings: {
      cancel_window: "2h",
      customer_change_enabled: true,
      booking_blocked_windows: [],
    },
    notification_settings: {},
    customer_page_settings: {},
    created_at: "2026-01-01T00:00:00+09:00",
    updated_at: "2026-01-01T00:00:00+09:00",
    ...overrides,
  };
}

function makeStaff(id = "staff-1", overrides = {}) {
  return {
    id,
    shop_id: "shop-test",
    name: "원장",
    role: "원장",
    services: ["전체 미용"],
    phone: "01000000000",
    startTime: "10:00",
    endTime: "19:00",
    defaultDays: weekdayKeys,
    status: "active",
    color: "#607080",
    created_at: "2026-01-01T00:00:00+09:00",
    updated_at: "2026-01-01T00:00:00+09:00",
    ...overrides,
  };
}

const service = {
  id: "svc-60",
  shop_id: "shop-test",
  name: "목욕",
  price: 30000,
  price_type: "fixed",
  duration_minutes: 60,
  is_active: true,
  category: "미용",
  description: "",
  sort_order: 1,
  capacity_label: "동일 시간 1건",
  staff_selection_mode: "all",
  price_guide: {},
  created_at: "2026-01-01T00:00:00+09:00",
  updated_at: "2026-01-01T00:00:00+09:00",
};

function makeAppointment(date, overrides = {}) {
  return {
    id: "appt-1",
    shop_id: "shop-test",
    guardian_id: "guardian-1",
    pet_id: "pet-1",
    service_id: service.id,
    staff_id: "staff-1",
    appointment_date: date,
    appointment_time: "10:00",
    status: "confirmed",
    memo: "",
    rejection_reason: null,
    start_at: `${date}T10:00:00+09:00`,
    end_at: `${date}T11:00:00+09:00`,
    visit_reminder_offset_minutes: 10,
    pickup_ready_eta_minutes: 5,
    source: "owner",
    created_at: "2026-01-01T00:00:00+09:00",
    updated_at: "2026-01-01T00:00:00+09:00",
    ...overrides,
  };
}

describe("computeAvailableSlots", () => {
  it("uses the intersection of business hours and customer booking hours", () => {
    const date = futureDate();
    const slots = computeAvailableSlots({
      date,
      serviceId: service.id,
      shop: makeShop(),
      services: [service],
      appointments: [],
    });

    assert.equal(slots[0], "10:00");
    assert.ok(slots.includes("16:00"));
    assert.equal(slots.includes("09:30"), false);
    assert.equal(slots.includes("17:00"), false);
  });

  it("blocks overlapping confirmed appointments for the same staff member", () => {
    const date = futureDate(15);
    const slots = computeAvailableSlots({
      date,
      serviceId: service.id,
      shop: makeShop(),
      services: [service],
      appointments: [makeAppointment(date)],
      staffId: "staff-1",
      staffMembers: [makeStaff()],
      staffScheduleOverrides: [],
    });

    assert.equal(slots.includes("10:00"), false);
    assert.equal(slots.includes("11:00"), true);
  });

  it("allows the same time when a different staff member is available", () => {
    const date = futureDate(16);
    const slots = computeAvailableSlots({
      date,
      serviceId: service.id,
      shop: makeShop(),
      services: [service],
      appointments: [makeAppointment(date, { staff_id: "staff-1" })],
      staffId: "staff-2",
      staffMembers: [makeStaff("staff-1"), makeStaff("staff-2")],
      staffScheduleOverrides: [],
    });

    assert.equal(slots.includes("10:00"), true);
  });

  it("does not expose slots when the selected staff member is off", () => {
    const date = futureDate(17);
    const slots = computeAvailableSlots({
      date,
      serviceId: service.id,
      shop: makeShop(),
      services: [service],
      appointments: [],
      staffId: "staff-1",
      staffMembers: [makeStaff()],
      staffScheduleOverrides: [
        {
          id: "override-1",
          shop_id: "shop-test",
          staff_id: "staff-1",
          work_date: date,
          status: "off",
          period: null,
          start_time: null,
          end_time: null,
          created_at: "2026-01-01T00:00:00+09:00",
          updated_at: "2026-01-01T00:00:00+09:00",
        },
      ],
    });

    assert.deepEqual(slots, []);
  });

  it("does not expose slots on temporary shop closure dates", () => {
    const date = futureDate(18);
    const slots = computeAvailableSlots({
      date,
      serviceId: service.id,
      shop: makeShop({ temporary_closed_dates: [date] }),
      services: [service],
      appointments: [],
    });

    assert.deepEqual(slots, []);
  });
});
