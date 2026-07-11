import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { maskGuardianPhone, scopeBootstrapForStaff } = await import("../../src/server/staff-privacy.ts");

const baseTimestamp = "2026-01-01T00:00:00+09:00";

function makeAppointment(id, staffId, guardianId, petId) {
  return {
    id,
    shop_id: "shop-test",
    guardian_id: guardianId,
    pet_id: petId,
    service_id: "svc-1",
    staff_id: staffId,
    appointment_date: "2026-01-10",
    appointment_time: "10:00",
    status: "confirmed",
    memo: "",
    rejection_reason: null,
    start_at: "2026-01-10T10:00:00+09:00",
    end_at: "2026-01-10T11:00:00+09:00",
    source: "owner",
    created_at: baseTimestamp,
    updated_at: baseTimestamp,
  };
}

function makeGuardian(id, phone) {
  return {
    id,
    shop_id: "shop-test",
    name: `guardian-${id}`,
    phone,
    memo: "",
    notification_settings: {},
    created_at: baseTimestamp,
    updated_at: baseTimestamp,
  };
}

function makePayload() {
  return {
    mode: "supabase",
    shop: {
      id: "shop-test",
      name: "테스트샵",
      phone: "01011112222",
      address: "서울",
      description: "",
      business_hours: {},
      regular_closed_days: [],
      regular_closed_cycle: "weekly",
      regular_closed_anchor_date: null,
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      booking_slot_interval_minutes: 30,
      booking_slot_offset_minutes: 0,
      booking_available_start_time: "10:00",
      booking_available_end_time: "19:00",
      approval_mode: "auto",
      notification_settings: {},
      customer_page_settings: {},
      created_at: baseTimestamp,
      updated_at: baseTimestamp,
    },
    ownerProfile: {
      user_id: "owner-user",
      shop_id: "shop-test",
      login_id: "owner",
      name: "원장",
      birth_date: null,
      phone_number: "01099998888",
      created_at: baseTimestamp,
      updated_at: baseTimestamp,
    },
    guardians: [makeGuardian("guardian-1", "01012345678"), makeGuardian("guardian-2", "01087654321")],
    deletedGuardians: [makeGuardian("guardian-deleted", "01000000000")],
    pets: [
      {
        id: "pet-1",
        shop_id: "shop-test",
        guardian_id: "guardian-1",
        name: "콩이",
        breed: "푸들",
        weight: null,
        age: null,
        notes: "",
        birthday: null,
        grooming_cycle_weeks: 4,
        avatar_seed: "pet-1",
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
      {
        id: "pet-2",
        shop_id: "shop-test",
        guardian_id: "guardian-2",
        name: "보리",
        breed: "말티즈",
        weight: null,
        age: null,
        notes: "",
        birthday: null,
        grooming_cycle_weeks: 4,
        avatar_seed: "pet-2",
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
    ],
    services: [],
    staffMembers: [
      {
        id: "staff-1",
        name: "민지",
        phone: "01022223333",
        role: "디자이너",
        defaultDays: ["mon"],
        startTime: "10:00",
        endTime: "19:00",
        regularOff: "일",
        annualRemain: 0,
        todayBookings: 0,
        weekBookings: 0,
      },
      {
        id: "staff-2",
        name: "하늘",
        phone: "01033334444",
        role: "디자이너",
        defaultDays: ["mon"],
        startTime: "10:00",
        endTime: "19:00",
        regularOff: "일",
        annualRemain: 0,
        todayBookings: 0,
        weekBookings: 0,
      },
    ],
    staffScheduleOverrides: [
      {
        id: "override-1",
        shop_id: "shop-test",
        staff_id: "staff-1",
        work_date: "2026-01-10",
        status: "work",
        start_time: "10:00",
        end_time: "19:00",
        period: null,
        reason: null,
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
      {
        id: "override-2",
        shop_id: "shop-test",
        staff_id: "staff-2",
        work_date: "2026-01-10",
        status: "work",
        start_time: "10:00",
        end_time: "19:00",
        period: null,
        reason: null,
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
    ],
    appointments: [
      makeAppointment("appt-1", "staff-1", "guardian-1", "pet-1"),
      makeAppointment("appt-2", "staff-2", "guardian-2", "pet-2"),
    ],
    appointmentChangeEvents: [
      {
        id: "event-1",
        shop_id: "shop-test",
        appointment_id: "appt-1",
        event_type: "status",
        previous_values: {},
        next_values: {},
        note: null,
        created_at: baseTimestamp,
      },
      {
        id: "event-2",
        shop_id: "shop-test",
        appointment_id: "appt-2",
        event_type: "status",
        previous_values: {},
        next_values: {},
        note: null,
        created_at: baseTimestamp,
      },
    ],
    groomingRecords: [
      {
        id: "record-1",
        shop_id: "shop-test",
        guardian_id: "guardian-1",
        pet_id: "pet-1",
        service_id: "svc-1",
        appointment_id: "appt-1",
        style_notes: "",
        memo: "",
        price_paid: 0,
        groomed_at: baseTimestamp,
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
    ],
    petStaffNotes: [
      {
        id: "note-1",
        shop_id: "shop-test",
        guardian_id: "guardian-1",
        pet_id: "pet-1",
        note: "주의",
        note_scope: "staff_shared",
        source: "owner_web",
        created_by_user_id: null,
        updated_by_user_id: null,
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
      {
        id: "note-private",
        shop_id: "shop-test",
        guardian_id: "guardian-1",
        pet_id: "pet-1",
        note: "오너 전용",
        note_scope: "owner_private",
        source: "owner_web",
        created_by_user_id: null,
        updated_by_user_id: null,
        created_at: baseTimestamp,
        updated_at: baseTimestamp,
      },
    ],
    notifications: [
      {
        id: "notification-1",
        shop_id: "shop-test",
        appointment_id: "appt-1",
        pet_id: "pet-1",
        guardian_id: "guardian-1",
        type: "booking_confirmed",
        channel: "alimtalk",
        message: "예약 확정",
        status: "sent",
        recipient_phone: "01012345678",
        sent_at: baseTimestamp,
        created_at: baseTimestamp,
      },
    ],
    alimtalkCreditSummary: null,
    landingInterests: [],
    landingFeedback: [],
  };
}

describe("staff privacy scope", () => {
  it("masks guardian phone numbers without exposing the original number", () => {
    assert.equal(maskGuardianPhone("010-1234-5678"), "****-5678");
  });

  it("returns only assigned appointments and masked customer contact data for staff", () => {
    const scoped = scopeBootstrapForStaff(makePayload(), {
      role: "staff",
      staffId: "staff-1",
    });

    assert.deepEqual(scoped.appointments.map((appointment) => appointment.id), ["appt-1"]);
    assert.deepEqual(scoped.guardians.map((guardian) => guardian.id), ["guardian-1"]);
    assert.equal(scoped.guardians[0].phone, "****-5678");
    assert.equal(scoped.guardians[0].phone.includes("01012345678"), false);
    assert.deepEqual(scoped.staffMembers.map((staff) => staff.id), ["staff-1"]);
    assert.equal(scoped.staffMembers[0].phone, "");
    assert.equal(scoped.ownerProfile, null);
    assert.deepEqual(scoped.deletedGuardians, []);
    assert.deepEqual(scoped.appointmentChangeEvents?.map((event) => event.appointment_id), ["appt-1"]);
    assert.deepEqual(scoped.petStaffNotes?.map((note) => note.id), ["note-1"]);
    assert.equal(scoped.notifications[0].recipient_phone, null);
  });
});
