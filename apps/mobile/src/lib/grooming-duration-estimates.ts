import {
  resolveDurationEstimate,
  summarizeDurationMinutes,
  type DurationEstimate,
} from "@petmanager/shared/lib/duration-statistics";

import type { Appointment, GroomingRecord, Pet, Service } from "@/types/domain";

type DurationContext = {
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  service: Service;
  pet: Pet | undefined;
};

function validCompletedRecords({ appointments, groomingRecords, service }: DurationContext) {
  const appointmentById = new Map(appointments.map((appointment) => [appointment.id, appointment]));
  const recordCountByAppointment = new Map<string, number>();

  for (const record of groomingRecords) {
    if (!record.appointment_id) continue;
    recordCountByAppointment.set(
      record.appointment_id,
      (recordCountByAppointment.get(record.appointment_id) ?? 0) + 1,
    );
  }

  return groomingRecords.filter((record) => {
    if (!record.appointment_id || recordCountByAppointment.get(record.appointment_id) !== 1) return false;
    const appointment = appointmentById.get(record.appointment_id);
    return Boolean(
      appointment &&
      appointment.status === "completed" &&
      appointment.service_id === service.id &&
      record.service_id === service.id,
    );
  });
}

export function getGroomingDurationEstimate(context: DurationContext): DurationEstimate {
  const records = validCompletedRecords(context);
  const targetWeight = typeof context.pet?.weight === "number"
    ? Math.round(context.pet.weight)
    : null;
  const petStats = summarizeDurationMinutes(
    records
      .filter((record) => record.pet_id === context.pet?.id)
      .map((record) => record.actual_duration_minutes),
  );
  const serviceWeightStats = summarizeDurationMinutes(
    records
      .filter((record) =>
        targetWeight !== null &&
        typeof record.pet_weight_snapshot === "number" &&
        Math.round(record.pet_weight_snapshot) === targetWeight,
      )
      .map((record) => record.actual_duration_minutes),
  );
  const serviceStats = summarizeDurationMinutes(
    records.map((record) => record.actual_duration_minutes),
  );

  return resolveDurationEstimate({
    baselineMinutes: context.service.duration_minutes,
    petStats,
    serviceWeightStats,
    serviceStats,
  });
}
