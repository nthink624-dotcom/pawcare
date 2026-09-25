import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { computeAvailableSlots } = await import("../../src/lib/availability.ts");
const { buildRuleBasedSlotRecommendations } = await import("../../src/lib/booking-slot-recommendations.ts");
const { findCustomerBreedPricingGroup } = await import("../../src/lib/customer-breed-pricing-group.ts");
const { buildCustomerServiceMenuOptions, buildCustomerServiceSourceOptions } = await import("../../src/lib/customer-service-options.ts");
const { getStaffBookingLoads } = await import("../../src/lib/staff-booking-load.ts");
const { addDate, currentDateInTimeZone } = await import("../../src/lib/utils.ts");
const {
  defaultBookingSlotIntervalMinutes,
  normalizeBookingSlotIntervalMinutes,
  normalizeBookingSlotOffsetMinutes,
  normalizeConcurrentCapacity,
} = await import("../../src/lib/booking-slot-settings.ts");
const { normalizeReservationPolicySettings } = await import("../../src/lib/reservation-policy-settings.ts");
const {
  getLatestBookingEndMinute,
  isBookingWithinCanonicalWindow,
} = await import("../../src/lib/booking-last-start-cutoff.ts");

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

describe("product-wide booking defaults", () => {
  it("ignores legacy shop choices and keeps the fixed booking policy", () => {
    assert.equal(defaultBookingSlotIntervalMinutes, 15);
    assert.equal(normalizeBookingSlotIntervalMinutes(30), 15);
    assert.equal(normalizeBookingSlotOffsetMinutes(10, 15), 0);
    assert.equal(normalizeConcurrentCapacity(5), 1);

    const policy = normalizeReservationPolicySettings({
      cancel_window: "24h",
      customer_change_enabled: false,
      ai_booking_time_optimization_enabled: false,
      ai_booking_recommendation_mode: "custom",
      ai_booking_custom_instruction: "빈 시간을 모두 보여주세요",
    });

    assert.equal(policy.cancel_window, "2h");
    assert.equal(policy.customer_change_enabled, true);
    assert.equal(policy.ai_booking_time_optimization_enabled, true);
    assert.equal(policy.ai_booking_recommendation_mode, "continuity");
    assert.equal(policy.ai_booking_custom_instruction, "");
  });
});

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
  it("treats booking availability as an inclusive start window while enforcing the close boundary", () => {
    const date = futureDate(13);
    const bookingShop = makeShop({
      business_hours: Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, { open: "09:00", close: "19:00", enabled: true }])),
      booking_available_start_time: "09:00",
      booking_available_end_time: "17:00",
      booking_slot_interval_minutes: 15,
      reservation_policy_settings: { booking_blocked_windows: [], booking_close_grace_minutes: 0 },
    });
    const slots = computeAvailableSlots({
      date,
      durationMinutesOverride: 120,
      shop: bookingShop,
      services: [service],
      appointments: [],
      staffId: "staff-1",
      staffMembers: [makeStaff("staff-1", { startTime: "09:00", endTime: "19:00" })],
    });

    assert.equal(slots.includes("16:00"), true);
    assert.equal(slots.includes("17:00"), true);
    assert.equal(slots.includes("17:15"), false);
    assert.equal(isBookingWithinCanonicalWindow({
      startMinute: 17 * 60,
      durationMinutes: 120,
      bookingStartMinute: 9 * 60,
      bookingEndMinute: 17 * 60,
      businessOpenMinute: 9 * 60,
      businessCloseMinute: 19 * 60,
      staffStartMinute: 9 * 60,
      staffEndMinute: 19 * 60,
      closeGraceMinutes: 0,
    }), true);
  });

  it("allows 17:15 only when the start window and close grace both cover it", () => {
    const date = futureDate(14);
    const baseShop = makeShop({
      business_hours: Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, { open: "09:00", close: "19:00", enabled: true }])),
      booking_available_start_time: "09:00",
      booking_available_end_time: "17:15",
      booking_slot_interval_minutes: 15,
    });
    const staff = makeStaff("staff-1", { startTime: "09:00", endTime: "19:00" });
    const graceFifteen = computeAvailableSlots({
      date,
      durationMinutesOverride: 120,
      shop: { ...baseShop, reservation_policy_settings: { booking_blocked_windows: [], booking_close_grace_minutes: 15 } },
      services: [service],
      appointments: [],
      staffId: staff.id,
      staffMembers: [staff],
    });
    const noGrace = computeAvailableSlots({
      date,
      durationMinutesOverride: 120,
      shop: { ...baseShop, reservation_policy_settings: { booking_blocked_windows: [], booking_close_grace_minutes: 0 } },
      services: [service],
      appointments: [],
      staffId: staff.id,
      staffMembers: [staff],
    });

    assert.equal(graceFifteen.includes("17:15"), true);
    assert.equal(noGrace.includes("17:15"), false);
  });

  it("extends staff time only when the staff close exactly equals the business close", () => {
    const date = futureDate(15);
    const shop = makeShop({
      business_hours: Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, { open: "09:00", close: "19:00", enabled: true }])),
      booking_available_start_time: "09:00",
      booking_available_end_time: "17:15",
      booking_slot_interval_minutes: 15,
      reservation_policy_settings: { booking_blocked_windows: [], booking_close_grace_minutes: 15 },
    });
    const matchingClose = computeAvailableSlots({
      date,
      durationMinutesOverride: 120,
      shop,
      services: [service],
      appointments: [],
      staffId: "staff-1",
      staffMembers: [makeStaff("staff-1", { startTime: "09:00", endTime: "19:00" })],
    });
    const earlyClose = computeAvailableSlots({
      date,
      durationMinutesOverride: 120,
      shop,
      services: [service],
      appointments: [],
      staffId: "staff-2",
      staffMembers: [makeStaff("staff-2", { startTime: "09:00", endTime: "18:45" })],
    });

    assert.equal(matchingClose.includes("17:15"), true);
    assert.equal(earlyClose.includes("17:15"), false);
    assert.equal(getLatestBookingEndMinute({ businessCloseMinute: 19 * 60, staffEndMinute: 19 * 60, closeGraceMinutes: 15 }), 19 * 60 + 15);
    assert.equal(getLatestBookingEndMinute({ businessCloseMinute: 19 * 60, staffEndMinute: 18 * 60 + 45, closeGraceMinutes: 15 }), 18 * 60 + 45);
  });

  it("keeps a 15-minute inclusive start at the KST date boundary", () => {
    assert.equal(isBookingWithinCanonicalWindow({
      startMinute: 23 * 60 + 45,
      durationMinutes: 15,
      bookingStartMinute: 9 * 60,
      bookingEndMinute: 23 * 60 + 45,
      businessOpenMinute: 9 * 60,
      businessCloseMinute: 23 * 60 + 59,
      staffStartMinute: 9 * 60,
      staffEndMinute: 23 * 60 + 59,
      closeGraceMinutes: 15,
    }), true);
    assert.equal(isBookingWithinCanonicalWindow({
      startMinute: 23 * 60 + 46,
      durationMinutes: 15,
      bookingStartMinute: 9 * 60,
      bookingEndMinute: 23 * 60 + 45,
      businessOpenMinute: 9 * 60,
      businessCloseMinute: 23 * 60 + 59,
      staffStartMinute: 9 * 60,
      staffEndMinute: 23 * 60 + 59,
      closeGraceMinutes: 15,
    }), false);
  });

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
    assert.equal(slots.includes("17:00"), true);
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

  it("immediately reopens a cancelled appointment time", () => {
    const date = futureDate(15);
    const slots = computeAvailableSlots({
      date,
      serviceId: service.id,
      shop: makeShop(),
      services: [service],
      appointments: [makeAppointment(date, { status: "cancelled" })],
      staffId: "staff-1",
      staffMembers: [makeStaff()],
      staffScheduleOverrides: [],
    });

    assert.equal(slots.includes("10:00"), true);
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

describe("getStaffBookingLoads", () => {
  it("counts only active assigned appointments for the selected date", () => {
    const date = futureDate(19);
    const loads = getStaffBookingLoads({
      date,
      staffMembers: [makeStaff("staff-1"), makeStaff("staff-2")],
      services: [service],
      appointments: [
        makeAppointment(date, { staff_id: "staff-1" }),
        makeAppointment(date, {
          id: "appt-cancelled",
          staff_id: "staff-1",
          appointment_time: "12:00",
          start_at: `${date}T12:00:00+09:00`,
          end_at: `${date}T13:00:00+09:00`,
          status: "cancelled",
        }),
      ],
    });

    assert.deepEqual(loads, [
      { staffId: "staff-1", bookingCount: 1, bookedMinutes: 60 },
      { staffId: "staff-2", bookingCount: 0, bookedMinutes: 0 },
    ]);
  });
});

describe("customer breed pricing group", () => {
  function canonicalPriceGuide(rows) {
    return {
      schemaVersion: 2,
      source: "owner_confirmed",
      overallNote: null,
      rows,
      surcharges: [],
      aiReview: [],
    };
  }

  function canonicalRow({ serviceName, species = "dog", breedGroup, breedNames, minKg = null, maxKg, price, duration }) {
    return {
      serviceName,
      species,
      breedNames,
      breedGroup,
      sizeClass: species === "cat" ? "all" : "small",
      minKg,
      maxKg,
      weightBandLabel: minKg === null ? `${maxKg}kg 이하` : `${minKg}~${maxKg}kg`,
      priceKind: "fixed",
      priceMinKrw: price,
      priceMaxKrw: null,
      durationMinutes: duration,
      note: null,
    };
  }

  it("deduplicates the default customer menu by canonical service label while keeping ids stable", () => {
    const groupedService = {
      ...service,
      price_guide: canonicalPriceGuide([
        canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈"], maxKg: 4, price: 30000, duration: 60 }),
        canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈"], minKg: 4, maxKg: 6, price: 35000, duration: 75 }),
        canonicalRow({ serviceName: "클리핑", breedGroup: "베이직", breedNames: ["말티즈"], maxKg: 4, price: 45000, duration: 90 }),
        canonicalRow({ serviceName: "목욕", breedGroup: "플러스", breedNames: ["푸들"], maxKg: 6, price: 50000, duration: 100 }),
        canonicalRow({ serviceName: "목욕", species: "cat", breedGroup: "고양이 단모", breedNames: ["코리안숏헤어"], maxKg: 6, price: 60000, duration: 90 }),
      ]),
    };

    const defaults = buildCustomerServiceMenuOptions(buildCustomerServiceSourceOptions([groupedService]));

    assert.equal(defaults.length, 2);
    const bath = defaults.find((option) => option.name === "목욕");
    const clipping = defaults.find((option) => option.name === "클리핑");
    assert.ok(bath);
    assert.ok(clipping);
    assert.equal(bath.price, 30000);
    assert.equal(bath.priceType, "starting");
    assert.equal(bath.durationMinutes, 60);
    assert.equal(bath.durationMinutesMax, 100);

    const exactDogBath = buildCustomerServiceMenuOptions(
      buildCustomerServiceSourceOptions([groupedService], { priceGuideGroupKey: "dog:플러스", weightKg: 5.5 }),
    ).find((option) => option.displayName === "목욕");

    assert.ok(exactDogBath);
    assert.equal(exactDogBath.id, bath.id);
    assert.equal(exactDogBath.price, 50000);
    assert.equal(exactDogBath.durationMinutes, 100);
    assert.equal(exactDogBath.durationMinutesMax, undefined);
  });

  it("uses representative breeds to expose only the matching detailed price-guide group", () => {
    const groupedService = {
      ...service,
      price_guide: canonicalPriceGuide([
        canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈", "포메라니안"], maxKg: 4, price: 30000, duration: 60 }),
        canonicalRow({ serviceName: "목욕", breedGroup: "플러스", breedNames: ["비숑프리제", "푸들"], maxKg: 6, price: 50000, duration: 90 }),
      ]),
    };

    const group = findCustomerBreedPricingGroup([groupedService], "토이푸들");
    assert.deepEqual(group, { key: "dog:플러스", title: "플러스", matchedBreed: "푸들" });

    const options = buildCustomerServiceSourceOptions([groupedService], {
      priceGuideOnly: true,
      priceGuideGroupKey: group?.key,
    });
    assert.equal(options.length, 1);
    assert.equal(options[0].name.includes("플러스"), true);
    assert.equal(options[0].displayName, "목욕");
    assert.equal(options[0].price, 50000);
  });

  it("resolves price and duration from the matching detailed weight cell", () => {
    const groupedService = {
      ...service,
      price_guide: canonicalPriceGuide([
        canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈"], maxKg: 4, price: 30000, duration: 60 }),
        canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈"], maxKg: 6, price: 35000, duration: 75 }),
        canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈"], maxKg: 8, price: 40000, duration: 90 }),
      ]),
    };

    const options = buildCustomerServiceSourceOptions([groupedService], {
      priceGuideOnly: true,
      priceGuideGroupKey: "dog:베이직",
      weightKg: 5.2,
    });

    assert.equal(options.length, 1);
    assert.equal(options[0].weightBand, "6kg 이하");
    assert.equal(options[0].price, 35000);
    assert.equal(options[0].durationMinutes, 75);
  });

  it("does not invent a price when weight is outside every registered band", () => {
    const options = buildCustomerServiceSourceOptions([
      {
        ...service,
        price_guide: canonicalPriceGuide([
          canonicalRow({ serviceName: "목욕", breedGroup: "베이직", breedNames: ["말티즈"], maxKg: 4, price: 30000, duration: 60 }),
        ]),
      },
    ], { priceGuideOnly: true, priceGuideGroupKey: "dog:베이직", weightKg: 7 });

    assert.deepEqual(options, []);
  });
});

describe("AI booking slot recommendation fallback", () => {
  it("always returns valid recommended slots even when there is no adjacent booking", () => {
    const availableSlots = ["09:00", "11:00", "14:30", "18:00"];
    const recommended = buildRuleBasedSlotRecommendations({
      availableSlots,
      recommendationMode: "continuity",
    });

    assert.equal(recommended.length, 4);
    assert.equal(recommended.every((slot) => availableSlots.includes(slot)), true);
  });

  it("keeps a gap-minimizing baseline first in continuity mode", () => {
    const recommended = buildRuleBasedSlotRecommendations({
      availableSlots: ["10:00", "11:30", "14:30"],
      baselineRecommendedSlots: ["11:30"],
      recommendationMode: "continuity",
    });

    assert.equal(recommended[0], "11:30");
  });

  it("prefers a slot handled by the less-loaded eligible staff member", () => {
    const recommended = buildRuleBasedSlotRecommendations({
      availableSlots: ["11:00", "14:30"],
      recommendationMode: "staff_balance",
      staffLoads: [
        { staffId: "busy", bookingCount: 4, bookedMinutes: 360 },
        { staffId: "open", bookingCount: 0, bookedMinutes: 0 },
      ],
      eligibleStaffBySlot: [
        { slot: "11:00", staffIds: ["busy"] },
        { slot: "14:30", staffIds: ["open"] },
      ],
    });

    assert.equal(recommended[0], "14:30");
  });
});
