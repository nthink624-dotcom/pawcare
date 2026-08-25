import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload } from "@/types/domain";

const demoTimeSlots = [
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["12:00", "13:00"],
  ["13:00", "14:00"],
  ["17:00", "18:00"],
  ["18:00", "19:00"],
] as const;

const demoStatuses: AppointmentStatus[] = [
  "confirmed",
  "confirmed",
  "in_progress",
  "almost_done",
  "confirmed",
  "completed",
];

function atKoreanTime(date: string, time: string) {
  return `${date}T${time}:00.000+09:00`;
}

/**
 * Builds a busy-but-testable schedule for the owner demo only. This deliberately
 * stays in the page payload: it never writes to the development or production DB.
 */
export function buildOwnerReservationTestBootstrap(data: BootstrapPayload): BootstrapPayload {
  const targetDate = addDate(currentDateInTimeZone(), 1);
  const guardians = data.guardians;
  const pets = data.pets;
  const services = data.services.filter((service) => service.is_active !== false);
  const staffMembers = data.staffMembers ?? [];

  if (!guardians.length || !pets.length || !services.length || !staffMembers.length) {
    return { ...data, mode: "mock" };
  }

  const now = new Date().toISOString();
  const testAppointments = staffMembers.flatMap((staff, staffIndex) =>
    demoTimeSlots.map(([startTime, endTime], slotIndex): Appointment => {
      const pet = pets[(staffIndex * demoTimeSlots.length + slotIndex) % pets.length]!;
      const guardian = guardians.find((item) => item.id === pet.guardian_id) ?? guardians[(staffIndex + slotIndex) % guardians.length]!;
      const service = services[(staffIndex + slotIndex) % services.length]!;

      return {
        id: `owner-test-${targetDate}-${staff.id}-${slotIndex + 1}`,
        shop_id: data.shop.id,
        guardian_id: guardian.id,
        pet_id: pet.id,
        service_id: service.id,
        staff_id: staff.id,
        appointment_date: targetDate,
        appointment_time: startTime,
        status: demoStatuses[slotIndex] ?? "confirmed",
        memo: slotIndex === 0 ? "테스트용 예약입니다. 필요하면 직접 수정하거나 취소해 보세요." : "",
        rejection_reason: null,
        start_at: atKoreanTime(targetDate, startTime),
        end_at: atKoreanTime(targetDate, endTime),
        source: slotIndex % 2 === 0 ? "customer" : "owner",
        created_at: now,
        updated_at: now,
      };
    }),
  );

  return {
    ...data,
    mode: "mock",
    appointments: [
      ...data.appointments.filter((appointment) => appointment.appointment_date !== targetDate),
      ...testAppointments,
    ],
  };
}
