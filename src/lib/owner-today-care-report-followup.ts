import type { Appointment, GroomingRecord } from "@/types/domain";

type FollowupInput = {
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  shopId: string;
  dateKey: string;
  hiddenFollowupKeys?: ReadonlySet<string>;
};

export function ownerTodayCareReportFollowupKey(appointment: Pick<Appointment, "shop_id" | "id" | "guardian_id" | "pet_id">) {
  return [appointment.shop_id, appointment.id, appointment.guardian_id, appointment.pet_id].join(":");
}

function hasPublishedCareReport(record: GroomingRecord) {
  const reportText = record.care_report_data?.reportText;
  return Boolean(
    (typeof reportText === "string" && reportText.trim()) ||
    record.care_report_owner_confirmed_at,
  );
}

/**
 * Today follow-ups come from completed canonical work, never from draft presence.
 * Record matching stays fail-closed across shop, appointment, guardian, and pet.
 */
export function selectOwnerTodayCareReportFollowups({
  appointments,
  groomingRecords,
  shopId,
  dateKey,
  hiddenFollowupKeys = new Set<string>(),
}: FollowupInput) {
  const appointmentsById = new Map<string, Appointment>();
  for (const appointment of appointments) {
    if (appointment.shop_id !== shopId || appointment.appointment_date !== dateKey) continue;
    const previous = appointmentsById.get(appointment.id);
    if (!previous || appointment.status === "completed") appointmentsById.set(appointment.id, appointment);
  }

  return Array.from(appointmentsById.values())
    .filter((appointment) => {
      if (hiddenFollowupKeys.has(ownerTodayCareReportFollowupKey(appointment))) return false;
      const exactRecords = groomingRecords.filter(
        (record) =>
          record.shop_id === shopId &&
          record.appointment_id === appointment.id &&
          record.guardian_id === appointment.guardian_id &&
          record.pet_id === appointment.pet_id,
      );
      const groomingCompleted = appointment.status === "completed" || exactRecords.length > 0;
      return groomingCompleted && !exactRecords.some(hasPublishedCareReport);
    })
    .sort((first, second) => first.appointment_time.localeCompare(second.appointment_time));
}
